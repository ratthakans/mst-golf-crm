import type { OpenHours } from "@mstgolf/shared";
import type { MemberSource as DbSource } from "@mstgolf/database";
import { db } from "./db";
import { CoreError } from "./errors";
import { getOrg } from "./settings";
import { addDays, DAY_MS, localDateKey, localParts, parseDateKey, startOfLocalDay } from "./time";
import { daySlots } from "./booking";

// Summary Dashboard (docs/PRODUCT.md §6.4). Every number is defined once here so
// the dashboard, the tests and a SQL spot-check agree.

export interface PeriodMetrics {
  newMembers: number;
  newBySource: Record<DbSource, number>;
  memberSpendSatang: number; // net of bills carrying a member
  allSalesSatang: number; // net of every imported bill
  identifiedPct: number | null; // memberSpend / allSales
  memberBills: number;
  bookings: number; // confirmed, checked-in, completed or no-show
  bookingsBySource: Record<"LINE" | "WEB" | "WALKIN" | "PHONE", number>;
  noShows: number;
  bookedHours: number;
  sellableHours: number;
  occupancyPct: number | null; // bookedHours / sellableHours
}

export interface DashboardSummary {
  from: string;
  to: string; // inclusive
  totalMembers: number;
  membersWithLine: number;
  tierCounts: Array<{ key: string; name: string; count: number }>;
  current: PeriodMetrics;
  previous: PeriodMetrics;
  weekly: Array<{ weekStart: string; newMembers: number; memberSpendSatang: number }>;
  heatmap: { hours: number[]; rows: Array<{ weekday: string; counts: number[] }> };
  pendingReviews: number;
  lastImportAt: Date | null;
}

const WEEKDAY_TH = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];
const SOURCES: DbSource[] = ["LINE", "WEB", "COUNTER", "POS", "IMPORT"];

async function period(orgId: string, from: Date, to: Date, hours: OpenHours, laneCount: number, slotMinutes: number): Promise<PeriodMetrics> {
  const client = db(orgId);
  const [members, sales, bookings, blocks] = await Promise.all([
    client.member.groupBy({ by: ["source"], where: { createdAt: { gte: from, lt: to }, status: { not: "MERGED" } }, _count: { _all: true } }),
    client.sale.findMany({ where: { status: "POSTED", occurredAt: { gte: from, lt: to } }, select: { memberId: true, netSatang: true, type: true } }),
    client.booking.findMany({
      where: { startAt: { gte: from, lt: to }, status: { in: ["CONFIRMED", "CHECKED_IN", "COMPLETED", "NO_SHOW"] } },
      select: { source: true, status: true, startAt: true, endAt: true },
    }),
    client.laneBlock.findMany({ where: { startAt: { lt: to }, endAt: { gt: from } }, select: { startAt: true, endAt: true } }),
  ]);
  const newBySource = Object.fromEntries(SOURCES.map((s) => [s, 0])) as Record<DbSource, number>;
  for (const g of members) newBySource[g.source] = g._count._all;
  let memberSpend = 0;
  let all = 0;
  let memberBills = 0;
  for (const s of sales) {
    all += s.netSatang;
    if (s.memberId) {
      memberSpend += s.netSatang;
      if (s.type === "SALE") memberBills++;
    }
  }
  const bySource = { LINE: 0, WEB: 0, WALKIN: 0, PHONE: 0 };
  let noShows = 0;
  let bookedHours = 0;
  for (const b of bookings) {
    bySource[b.source]++;
    if (b.status === "NO_SHOW") noShows++;
    else bookedHours += (b.endAt.getTime() - b.startAt.getTime()) / 3_600_000;
  }
  let sellable = 0;
  for (let d = startOfLocalDay(from); d < to; d = addDays(d, 1)) sellable += daySlots(d, hours, slotMinutes).length * (slotMinutes / 60) * laneCount;
  const blockedHours = blocks.reduce((s, b) => s + (Math.min(b.endAt.getTime(), to.getTime()) - Math.max(b.startAt.getTime(), from.getTime())) / 3_600_000, 0);
  sellable = Math.max(0, sellable - blockedHours);
  return {
    newMembers: members.reduce((s, g) => s + g._count._all, 0),
    newBySource,
    memberSpendSatang: memberSpend,
    allSalesSatang: all,
    identifiedPct: all > 0 ? memberSpend / all : null,
    memberBills,
    bookings: bookings.length,
    bookingsBySource: bySource,
    noShows,
    bookedHours,
    sellableHours: sellable,
    occupancyPct: sellable > 0 ? bookedHours / sellable : null,
  };
}

export async function dashboardSummary(orgId: string, fromKey: string, toKey: string): Promise<DashboardSummary> {
  const from = parseDateKey(fromKey);
  const toDay = parseDateKey(toKey);
  if (!from || !toDay || toDay < from) throw new CoreError("INVALID_INPUT", "ช่วงวันที่ไม่ถูกต้อง");
  const to = addDays(toDay, 1);
  const span = to.getTime() - from.getTime();
  if (span > 400 * DAY_MS) throw new CoreError("INVALID_INPUT", "เลือกช่วงได้ไม่เกิน 400 วัน");
  const { settings } = await getOrg(orgId);
  const client = db(orgId);
  const store = await client.store.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  const hours = (store?.openHours ?? {}) as OpenHours;
  const laneCount = await client.lane.count({ where: { isActive: true } });
  const slot = settings.booking.slotMinutes;

  const [current, previous, totalMembers, membersWithLine, tiers, pendingReviews, lastImport] = await Promise.all([
    period(orgId, from, to, hours, laneCount, slot),
    period(orgId, new Date(from.getTime() - span), from, hours, laneCount, slot),
    client.member.count({ where: { status: "ACTIVE" } }),
    client.member.count({ where: { status: "ACTIVE", identities: { some: { type: "LINE" } } } }),
    client.member.groupBy({ by: ["tier"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    client.reviewItem.count({ where: { status: "OPEN" } }),
    client.importBatch.findFirst({ where: { status: "COMMITTED" }, orderBy: { committedAt: "desc" }, select: { committedAt: true } }),
  ]);

  // 12 weeks ending with the week that contains `toDay` (weeks start Monday).
  const p = localParts(toDay);
  const mondayOffset = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].indexOf(p.weekday);
  const lastMonday = addDays(toDay, -mondayOffset);
  const firstMonday = addDays(lastMonday, -11 * 7);
  const weekEnd = addDays(lastMonday, 7);
  const [wMembers, wSales, heatRows] = await Promise.all([
    client.member.findMany({ where: { createdAt: { gte: firstMonday, lt: weekEnd }, status: { not: "MERGED" } }, select: { createdAt: true } }),
    client.sale.findMany({ where: { status: "POSTED", memberId: { not: null }, occurredAt: { gte: firstMonday, lt: weekEnd } }, select: { occurredAt: true, netSatang: true } }),
    client.booking.findMany({ where: { startAt: { gte: from, lt: to }, status: { in: ["CONFIRMED", "CHECKED_IN", "COMPLETED"] } }, select: { startAt: true } }),
  ]);
  const weekly = Array.from({ length: 12 }, (_, i) => ({ weekStart: localDateKey(addDays(firstMonday, i * 7)), newMembers: 0, memberSpendSatang: 0 }));
  const weekIndex = (d: Date) => Math.floor((d.getTime() - firstMonday.getTime()) / (7 * DAY_MS));
  for (const m of wMembers) {
    const w = weekly[weekIndex(m.createdAt)];
    if (w) w.newMembers++;
  }
  for (const s of wSales) {
    const w = weekly[weekIndex(s.occurredAt)];
    if (w) w.memberSpendSatang += s.netSatang;
  }

  const hourSet = new Set<number>();
  for (let d = 0; d < 7; d++) for (const s of daySlots(addDays(lastMonday, d), hours, slot)) hourSet.add(localParts(s).hour);
  const hoursList = [...hourSet].sort((a, b) => a - b);
  const heat = WEEKDAY_TH.map((weekday) => ({ weekday, counts: hoursList.map(() => 0) }));
  for (const b of heatRows) {
    const lp = localParts(b.startAt);
    const row = heat[["mon", "tue", "wed", "thu", "fri", "sat", "sun"].indexOf(lp.weekday)];
    const col = hoursList.indexOf(lp.hour);
    if (row && col >= 0) row.counts[col]!++;
  }

  const tierCount = new Map(tiers.map((t) => [t.tier, t._count._all]));
  return {
    from: fromKey,
    to: toKey,
    totalMembers,
    membersWithLine,
    tierCounts: settings.tiers.map((t) => ({ key: t.key, name: t.name, count: tierCount.get(t.key) ?? 0 })),
    current,
    previous,
    weekly,
    heatmap: { hours: hoursList, rows: heat },
    pendingReviews,
    lastImportAt: lastImport?.committedAt ?? null,
  };
}

