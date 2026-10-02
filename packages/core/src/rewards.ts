import { randomInt } from "node:crypto";
import type { Prisma, RedemptionStatus, RewardKind } from "@mstgolf/database";
import { writeAudit } from "./audit";
import type { Actor } from "./context";
import { db, inTx, type Tx } from "./db";
import { CoreError, isUniqueViolation } from "./errors";
import { recordEvent } from "./events";
import { enqueueEmail } from "./notify/email";
import { enqueue } from "./notify/outbox";
import { postPoints } from "./points";
import { getOrg, type ResolvedSettings } from "./settings";
import { DAY_MS } from "./time";

// Rewards (docs/PRODUCT.md §11). Members spend points on a catalogue MST keeps
// in the back office. Two kinds:
//   COUPON   — issued on the spot with a unique code shown as a QR. Staff scan
//              or type it in the back office, which marks it used; the cashier
//              applies the discount in the POS (the POS link is read-only).
//   PHYSICAL — a request: Marketing gets an email, reviews it, the back office
//              fulfils it and every status change reaches the member in LINE.
// Points leave the balance when the member redeems (REDEEM) and come back
// (REDEEM_REFUND) if the request is rejected or cancelled — every move is a
// ledger row linked to the redemption.

export type { RedemptionStatus, RewardKind };

export const REDEMPTION_STATUS_LABEL: Record<RedemptionStatus, string> = {
  ISSUED: "พร้อมใช้",
  USED: "ใช้แล้ว",
  EXPIRED: "หมดอายุ",
  SUBMITTED: "ได้รับคำขอแล้ว",
  UNDER_REVIEW: "กำลังตรวจสอบ",
  APPROVED: "อนุมัติแล้ว",
  PROCESSING: "กำลังเตรียมของ",
  SHIPPED: "จัดส่งแล้ว",
  COMPLETED: "เสร็จสิ้น",
  REJECTED: "ไม่อนุมัติ",
  CANCELLED: "ยกเลิก",
};

/** Where a physical request may go next. Coupons move only by use, expiry or a staff cancel. */
export const NEXT_STATUS: Partial<Record<RedemptionStatus, RedemptionStatus[]>> = {
  SUBMITTED: ["UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["PROCESSING", "SHIPPED", "COMPLETED", "CANCELLED"],
  PROCESSING: ["SHIPPED", "COMPLETED", "CANCELLED"],
  SHIPPED: ["COMPLETED"],
  ISSUED: ["CANCELLED"],
};

/** Statuses that hand the points back and put the item back in stock. */
const REFUNDED: RedemptionStatus[] = ["REJECTED", "CANCELLED"];
/** Still waiting on someone — the back-office queue. */
export const OPEN_STATUSES: RedemptionStatus[] = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "PROCESSING", "SHIPPED"];

export interface Delivery {
  method: "PICKUP" | "SHIP";
  name: string;
  phone: string;
  address?: string;
  storeId?: string;
}

interface HistoryEntry {
  status: RedemptionStatus;
  at: string;
  by: string; // "member" · "system" · staff user id
  note?: string | null;
}

// ---------------------------------------------------------------------------
// Catalogue (back office)
// ---------------------------------------------------------------------------

export interface RewardInput {
  kind: RewardKind;
  name: string;
  description?: string;
  terms?: string;
  imageUrl?: string | null;
  costPoints: number;
  valueBaht?: number | null;
  minSpendBaht?: number | null;
  validDays?: number | null;
  fulfilment?: string | null;
  stock?: number | null;
  perMemberLimit?: number | null;
  minTier?: string | null;
  startsAt?: string | null; // YYYY-MM-DD, Bangkok
  endsAt?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

const intOrNull = (v: unknown, min: number, max: number, label: string): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new CoreError("INVALID_INPUT", `${label} ต้องเป็นจำนวนเต็ม ${min.toLocaleString("en-US")}–${max.toLocaleString("en-US")}`);
  return n;
};

const dateOrNull = (v: unknown, endOfDay: boolean): Date | null => {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  if (!m) throw new CoreError("INVALID_INPUT", "วันที่ไม่ถูกต้อง");
  // Bangkok midnight (UTC+7) — or the last millisecond of that day for an end date.
  const start = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - 7 * 3600_000;
  return new Date(endOfDay ? start + DAY_MS - 1 : start);
};

function cleanReward(input: RewardInput, settings: ResolvedSettings): Prisma.RewardUncheckedCreateInput {
  const kind = input.kind === "COUPON" || input.kind === "PHYSICAL" ? input.kind : null;
  if (!kind) throw new CoreError("INVALID_INPUT", "เลือกประเภทรางวัล");
  const name = String(input.name ?? "").trim();
  if (!name) throw new CoreError("INVALID_INPUT", "ใส่ชื่อรางวัล");
  const costPoints = intOrNull(input.costPoints, 1, 10_000_000, "แต้มที่ใช้แลก");
  if (costPoints === null) throw new CoreError("INVALID_INPUT", "ใส่แต้มที่ใช้แลก");
  const valueBaht = intOrNull(input.valueBaht, 1, 1_000_000, "มูลค่าคูปอง");
  if (kind === "COUPON" && valueBaht === null) throw new CoreError("INVALID_INPUT", "ใส่มูลค่าคูปอง (บาท)");
  const validDays = intOrNull(input.validDays, 1, 730, "อายุคูปอง");
  if (kind === "COUPON" && validDays === null) throw new CoreError("INVALID_INPUT", "ใส่อายุคูปอง (วัน)");
  const minTier = input.minTier?.trim() || null;
  if (minTier && !settings.tiers.some((t) => t.key === minTier)) throw new CoreError("INVALID_INPUT", "ไม่พบระดับสมาชิกนี้");
  const image = input.imageUrl?.trim() || null;
  if (image && !/^(https:\/\/|\/)[^\s]+$/.test(image)) throw new CoreError("INVALID_INPUT", "ลิงก์รูปต้องขึ้นต้นด้วย https://");
  const startsAt = dateOrNull(input.startsAt, false);
  const endsAt = dateOrNull(input.endsAt, true);
  if (startsAt && endsAt && endsAt < startsAt) throw new CoreError("INVALID_INPUT", "วันสิ้นสุดต้องอยู่หลังวันเริ่ม");
  return {
    orgId: "",
    kind,
    name: name.slice(0, 80),
    description: String(input.description ?? "").trim().slice(0, 1000),
    terms: String(input.terms ?? "").trim().slice(0, 2000),
    imageUrl: image,
    costPoints,
    valueSatang: kind === "COUPON" && valueBaht !== null ? valueBaht * 100 : null,
    minSpendSatang: kind === "COUPON" ? (intOrNull(input.minSpendBaht, 0, 10_000_000, "ยอดซื้อขั้นต่ำ") ?? 0) * 100 || null : null,
    validDays: kind === "COUPON" ? validDays : null,
    fulfilment: kind === "PHYSICAL" ? input.fulfilment?.trim().slice(0, 200) || null : null,
    stock: intOrNull(input.stock, 0, 1_000_000, "สต็อก"),
    perMemberLimit: intOrNull(input.perMemberLimit, 1, 1000, "จำกัดต่อคน"),
    minTier,
    startsAt,
    endsAt,
    isActive: input.isActive ?? true,
    sortOrder: intOrNull(input.sortOrder, 0, 9999, "ลำดับ") ?? 0,
  };
}

export async function saveReward(orgId: string, actor: Actor, id: string | null, input: RewardInput) {
  const { settings } = await getOrg(orgId);
  const data = cleanReward(input, settings);
  return inTx(orgId, async (tx) => {
    if (!id) {
      const created = await tx.reward.create({ data: { ...data, orgId } });
      await writeAudit(tx, orgId, actor, { action: "reward.create", entity: "reward", entityId: created.id, after: data });
      return created;
    }
    const before = await tx.reward.findFirst({ where: { id } });
    if (!before) throw new CoreError("NOT_FOUND", "ไม่พบรางวัล");
    if (before.kind !== data.kind) {
      const used = await tx.redemption.count({ where: { rewardId: id } });
      if (used) throw new CoreError("INVALID_INPUT", "รางวัลนี้มีคนแลกแล้ว เปลี่ยนประเภทไม่ได้ — สร้างรางวัลใหม่แทน");
    }
    const { orgId: _o, ...patch } = data;
    const updated = await tx.reward.update({ where: { id: before.id }, data: patch });
    await writeAudit(tx, orgId, actor, { action: "reward.update", entity: "reward", entityId: id, before, after: patch });
    return updated;
  });
}

/** Adds to (or takes from) the stock without overwriting what redemptions did meanwhile. */
export async function adjustRewardStock(orgId: string, actor: Actor, id: string, delta: number, note: string) {
  if (!Number.isInteger(delta) || delta === 0) throw new CoreError("INVALID_INPUT", "ใส่จำนวนที่จะเพิ่มหรือลด");
  return inTx(orgId, async (tx) => {
    const r = await tx.reward.findFirst({ where: { id } });
    if (!r) throw new CoreError("NOT_FOUND", "ไม่พบรางวัล");
    if (r.stock === null) throw new CoreError("INVALID_INPUT", "รางวัลนี้ไม่จำกัดจำนวน — ใส่สต็อกในหน้าแก้ไขก่อน");
    if (r.stock + delta < 0) throw new CoreError("INVALID_INPUT", `สต็อกเหลือ ${r.stock} — ลดได้ไม่เกินนั้น`);
    const updated = await tx.reward.update({ where: { id: r.id }, data: { stock: { increment: delta } } });
    await writeAudit(tx, orgId, actor, { action: "reward.stock", entity: "reward", entityId: id, before: { stock: r.stock }, after: { stock: updated.stock }, reason: note.trim() || null });
    return updated;
  });
}

export async function listRewards(orgId: string) {
  const client = db(orgId);
  const [rewards, counts] = await Promise.all([
    client.reward.findMany({ orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }] }),
    client.redemption.groupBy({ by: ["rewardId"], where: { status: { notIn: REFUNDED } }, _count: { _all: true } }),
  ]);
  const redeemed = new Map(counts.map((c) => [c.rewardId, c._count._all]));
  return rewards.map((r) => ({ ...r, redeemed: redeemed.get(r.id) ?? 0 }));
}

// ---------------------------------------------------------------------------
// Member side
// ---------------------------------------------------------------------------

export interface CatalogueItem {
  id: string;
  kind: RewardKind;
  name: string;
  description: string;
  terms: string;
  imageUrl: string | null;
  costPoints: number;
  valueSatang: number | null;
  minSpendSatang: number | null;
  validDays: number | null;
  fulfilment: string | null;
  stockLeft: number | null;
  minTierName: string | null;
  endsAt: Date | null;
  /** null = can redeem now; otherwise why not, in Thai. */
  blocked: string | null;
  shortBy: number; // points still needed (0 when enough)
}

function tierRank(settings: ResolvedSettings, key: string | null | undefined): number {
  const i = settings.tiers.findIndex((t) => t.key === key);
  return i < 0 ? 0 : i;
}

function liveWhere(now: Date): Prisma.RewardWhereInput {
  return {
    isActive: true,
    AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
  };
}

export async function rewardCatalogue(orgId: string, memberId: string, now = new Date()): Promise<{ balance: number; items: CatalogueItem[] }> {
  const { settings } = await getOrg(orgId);
  const client = db(orgId);
  const member = await client.member.findFirst({ where: { id: memberId, status: "ACTIVE" }, select: { points: true, tier: true } });
  if (!member) throw new CoreError("NOT_FOUND", "ไม่พบสมาชิก");
  const [rewards, mine] = await Promise.all([
    client.reward.findMany({ where: liveWhere(now), orderBy: [{ sortOrder: "asc" }, { costPoints: "asc" }] }),
    client.redemption.groupBy({ by: ["rewardId"], where: { memberId, status: { notIn: REFUNDED } }, _count: { _all: true } }),
  ]);
  const taken = new Map(mine.map((m) => [m.rewardId, m._count._all]));
  const rank = tierRank(settings, member.tier);
  return {
    balance: member.points,
    items: rewards.map((r) => {
      const minTier = r.minTier ? settings.tiers.find((t) => t.key === r.minTier) ?? null : null;
      const shortBy = Math.max(0, r.costPoints - member.points);
      let blocked: string | null = null;
      if (r.stock !== null && r.stock <= 0) blocked = "หมดแล้ว";
      else if (minTier && rank < tierRank(settings, minTier.key)) blocked = `เฉพาะระดับ ${minTier.name} ขึ้นไป`;
      else if (r.perMemberLimit !== null && (taken.get(r.id) ?? 0) >= r.perMemberLimit) blocked = `แลกครบ ${r.perMemberLimit} ครั้งแล้ว`;
      else if (shortBy > 0) blocked = `ขาดอีก ${shortBy.toLocaleString("en-US")} แต้ม`;
      return {
        id: r.id,
        kind: r.kind,
        name: r.name,
        description: r.description,
        terms: r.terms,
        imageUrl: r.imageUrl,
        costPoints: r.costPoints,
        valueSatang: r.valueSatang,
        minSpendSatang: r.minSpendSatang,
        validDays: r.validDays,
        fulfilment: r.fulfilment,
        stockLeft: r.stock,
        minTierName: minTier?.name ?? null,
        endsAt: r.endsAt,
        blocked,
        shortBy,
      };
    }),
  };
}

// Coupon tokens: no 0/O/1/I/L so a cashier can type one off a cracked screen.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function newCouponCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `MST-${s.slice(0, 4)}-${s.slice(4)}`;
}

/** What a scanner or a person typed → the stored form ("mst 7kq4x9pd" → "MST-7KQ4-X9PD"). */
export function normalizeCouponCode(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^MST/, "");
  if (s.length !== 8) return null;
  return `MST-${s.slice(0, 4)}-${s.slice(4)}`;
}

async function nextRedemptionCode(tx: Tx, orgId: string): Promise<string> {
  const c = await tx.counter.upsert({
    where: { orgId_key: { orgId, key: "redemption_code" } },
    create: { orgId, key: "redemption_code", value: 1 },
    update: { value: { increment: 1 } },
  });
  return `RD-${String(c.value).padStart(6, "0")}`;
}

function cleanDelivery(raw: unknown, stores: Array<{ id: string }>): Delivery {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const method = d.method === "SHIP" ? "SHIP" : d.method === "PICKUP" ? "PICKUP" : null;
  if (!method) throw new CoreError("INVALID_INPUT", "เลือกวิธีรับของ");
  const name = String(d.name ?? "").trim().slice(0, 80);
  const phone = String(d.phone ?? "").replace(/[^\d+]/g, "").slice(0, 15);
  if (name.length < 2) throw new CoreError("INVALID_INPUT", "ใส่ชื่อผู้รับ");
  if (phone.length < 9) throw new CoreError("INVALID_INPUT", "ใส่เบอร์ติดต่อผู้รับ");
  if (method === "SHIP") {
    const address = String(d.address ?? "").trim().slice(0, 400);
    if (address.length < 10) throw new CoreError("INVALID_INPUT", "ใส่ที่อยู่จัดส่งให้ครบ");
    return { method, name, phone, address };
  }
  const storeId = String(d.storeId ?? stores[0]?.id ?? "");
  if (!stores.some((s) => s.id === storeId)) throw new CoreError("INVALID_INPUT", "เลือกสาขาที่จะรับของ");
  return { method, name, phone, storeId };
}

export interface RedeemResult {
  id: string;
  code: string;
  kind: RewardKind;
  status: RedemptionStatus;
  couponCode: string | null;
  balance: number;
}

/** A member spends points on a reward. Coupons are issued at once; physical rewards become a request. */
export async function redeemReward(
  orgId: string,
  memberId: string,
  input: { rewardId: string; delivery?: unknown; acceptTerms?: boolean },
  now = new Date(),
): Promise<RedeemResult> {
  const { settings } = await getOrg(orgId);
  if (!settings.features.rewards) throw new CoreError("FORBIDDEN", "ยังไม่เปิดให้แลกรางวัล");
  if (!input.acceptTerms) throw new CoreError("INVALID_INPUT", "กรุณายอมรับเงื่อนไขก่อนแลก");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await inTx(orgId, async (tx) => {
        // Lock the member row first: a double tap waits here and then sees the first redemption.
        const locked = await tx.member.updateMany({ where: { id: memberId, status: "ACTIVE" }, data: { lastSeenAt: now } });
        if (!locked.count) throw new CoreError("NOT_FOUND", "ไม่พบสมาชิก");
        const member = await tx.member.findFirstOrThrow({ where: { id: memberId }, select: { id: true, code: true, displayName: true, points: true, tier: true } });
        const reward = await tx.reward.findFirst({ where: { id: input.rewardId, ...liveWhere(now) } });
        if (!reward) throw new CoreError("NOT_FOUND", "รางวัลนี้ไม่เปิดให้แลกแล้ว");
        if (reward.minTier && tierRank(settings, member.tier) < tierRank(settings, reward.minTier)) {
          const t = settings.tiers.find((x) => x.key === reward.minTier);
          throw new CoreError("REWARD_RULE", `รางวัลนี้สำหรับสมาชิกระดับ ${t?.name ?? reward.minTier} ขึ้นไป`);
        }
        if (member.points < reward.costPoints) {
          throw new CoreError("REWARD_RULE", `แต้มไม่พอ — ขาดอีก ${(reward.costPoints - member.points).toLocaleString("en-US")} แต้ม`);
        }
        if (reward.perMemberLimit !== null) {
          const n = await tx.redemption.count({ where: { memberId, rewardId: reward.id, status: { notIn: REFUNDED } } });
          if (n >= reward.perMemberLimit) throw new CoreError("REWARD_RULE", `แลกรางวัลนี้ได้คนละ ${reward.perMemberLimit} ครั้ง`);
        }
        if (reward.stock !== null) {
          const took = await tx.reward.updateMany({ where: { id: reward.id, stock: { gt: 0 } }, data: { stock: { decrement: 1 } } });
          if (!took.count) throw new CoreError("REWARD_RULE", "ขออภัย รางวัลนี้หมดแล้ว");
        }

        const stores = await tx.store.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } });
        const isCoupon = reward.kind === "COUPON";
        const delivery = isCoupon ? null : cleanDelivery(input.delivery, stores);
        const status: RedemptionStatus = isCoupon ? "ISSUED" : "SUBMITTED";
        const code = await nextRedemptionCode(tx, orgId);
        const history: HistoryEntry[] = [{ status, at: now.toISOString(), by: "member" }];
        const red = await tx.redemption.create({
          data: {
            orgId,
            code,
            memberId,
            rewardId: reward.id,
            kind: reward.kind,
            rewardName: reward.name,
            costPoints: reward.costPoints,
            status,
            couponCode: isCoupon ? newCouponCode() : null,
            valueSatang: reward.valueSatang,
            expiresAt: isCoupon ? new Date(now.getTime() + (reward.validDays ?? 30) * DAY_MS) : null,
            delivery: delivery ? (delivery as unknown as Prisma.InputJsonValue) : undefined,
            history: history as unknown as Prisma.InputJsonValue,
          },
        });
        await postPoints(tx, orgId, { memberId, type: "REDEEM", delta: -reward.costPoints, reason: "REDEEM", note: `${reward.name} · ${code}`, redemptionId: red.id });
        await recordEvent(tx, orgId, memberId, "REDEEM_POINTS", { redemptionId: red.id, code, rewardId: reward.id, kind: reward.kind, points: reward.costPoints }, now);
        await enqueue(tx, orgId, [
          {
            memberId,
            kind: "REDEMPTION_RECEIVED",
            dedupeKey: `REDEMPTION_RECEIVED:${red.id}`,
            payload: {
              code,
              kind: reward.kind,
              rewardName: reward.name,
              points: reward.costPoints,
              balance: member.points - reward.costPoints,
              couponCode: red.couponCode,
              valueSatang: red.valueSatang,
              expiresAt: red.expiresAt?.toISOString() ?? null,
              fulfilment: reward.fulfilment,
            },
          },
        ]);
        if (!isCoupon && settings.redemption.alertEmails.length) {
          await enqueueEmail(tx, orgId, {
            to: settings.redemption.alertEmails,
            kind: "REDEMPTION_REQUEST",
            dedupeKey: `REDEMPTION_REQUEST:${red.id}`,
            payload: {
              redemptionId: red.id,
              code,
              rewardName: reward.name,
              memberCode: member.code,
              points: reward.costPoints,
              method: delivery?.method ?? null,
              storeName: delivery?.storeId ? stores.find((s) => s.id === delivery.storeId)?.name ?? null : null,
              at: now.toISOString(),
            },
          });
        }
        return { id: red.id, code, kind: reward.kind, status, couponCode: red.couponCode, balance: member.points - reward.costPoints };
      });
    } catch (e) {
      // Two coupons drew the same token (1 in ~850 billion) — draw again.
      if (isUniqueViolation(e) && attempt < 2) continue;
      throw e;
    }
  }
  throw new CoreError("REWARD_RULE", "ระบบไม่ว่าง กรุณาลองใหม่");
}

export interface RedemptionView {
  id: string;
  code: string;
  kind: RewardKind;
  rewardName: string;
  imageUrl: string | null;
  costPoints: number;
  status: RedemptionStatus;
  statusLabel: string;
  couponCode: string | null;
  valueSatang: number | null;
  minSpendSatang: number | null;
  terms: string;
  expiresAt: Date | null;
  usedAt: Date | null;
  fulfilment: string | null;
  delivery: Delivery | null;
  carrier: string | null;
  trackingNo: string | null;
  note: string | null;
  history: HistoryEntry[];
  createdAt: Date;
  canCancel: boolean;
}

type RedemptionRow = Prisma.RedemptionGetPayload<{ include: { reward: true } }>;

function toView(r: RedemptionRow, now: Date): RedemptionView {
  // A coupon past its date reads as expired even before the nightly job flips it.
  const status: RedemptionStatus = r.status === "ISSUED" && r.expiresAt && r.expiresAt < now ? "EXPIRED" : r.status;
  return {
    id: r.id,
    code: r.code,
    kind: r.kind,
    rewardName: r.rewardName,
    imageUrl: r.reward.imageUrl,
    costPoints: r.costPoints,
    status,
    statusLabel: REDEMPTION_STATUS_LABEL[status],
    couponCode: r.couponCode,
    valueSatang: r.valueSatang,
    minSpendSatang: r.reward.minSpendSatang,
    terms: r.reward.terms,
    expiresAt: r.expiresAt,
    usedAt: r.usedAt,
    fulfilment: r.reward.fulfilment,
    delivery: (r.delivery as Delivery | null) ?? null,
    carrier: r.carrier,
    trackingNo: r.trackingNo,
    note: r.note,
    history: (r.history as unknown as HistoryEntry[]) ?? [],
    createdAt: r.createdAt,
    canCancel: r.kind === "PHYSICAL" && r.status === "SUBMITTED",
  };
}

export async function memberRedemptions(orgId: string, memberId: string, now = new Date()): Promise<RedemptionView[]> {
  const rows = await db(orgId).redemption.findMany({ where: { memberId }, orderBy: { createdAt: "desc" }, take: 100, include: { reward: true } });
  return rows.map((r) => toView(r, now));
}

// ---------------------------------------------------------------------------
// Status changes (staff, member cancel, expiry)
// ---------------------------------------------------------------------------

async function moveStatus(
  tx: Tx,
  orgId: string,
  r: RedemptionRow,
  to: RedemptionStatus,
  by: string,
  extra: { note?: string | null; carrier?: string | null; trackingNo?: string | null; ownerId?: string | null; usedStoreId?: string | null; usedInvoiceNo?: string | null; usedById?: string | null },
  now: Date,
  notify: boolean,
): Promise<void> {
  const history = [...((r.history as unknown as HistoryEntry[]) ?? []), { status: to, at: now.toISOString(), by, note: extra.note ?? null }];
  // Conditional on the status we read, so two people pressing at once cannot both win.
  const moved = await tx.redemption.updateMany({
    where: { id: r.id, status: r.status },
    data: {
      status: to,
      history: history as unknown as Prisma.InputJsonValue,
      ...(extra.note !== undefined ? { note: extra.note } : {}),
      ...(extra.carrier !== undefined ? { carrier: extra.carrier } : {}),
      ...(extra.trackingNo !== undefined ? { trackingNo: extra.trackingNo } : {}),
      ...(extra.ownerId !== undefined ? { ownerId: extra.ownerId } : {}),
      ...(to === "USED" ? { usedAt: now, usedStoreId: extra.usedStoreId ?? null, usedInvoiceNo: extra.usedInvoiceNo ?? null, usedById: extra.usedById ?? null } : {}),
    },
  });
  if (!moved.count) throw new CoreError("COUPON_STATE", "รายการนี้เพิ่งถูกเปลี่ยนสถานะ — โหลดหน้าใหม่แล้วลองอีกครั้ง");

  if (REFUNDED.includes(to)) {
    await postPoints(tx, orgId, { memberId: r.memberId, type: "REVERSAL", delta: r.costPoints, reason: "REDEEM_REFUND", note: `${r.rewardName} · ${r.code}`, redemptionId: r.id, createdById: by === "member" || by === "system" ? null : by });
    if (r.reward.stock !== null) await tx.reward.updateMany({ where: { id: r.rewardId }, data: { stock: { increment: 1 } } });
  }
  await recordEvent(tx, orgId, r.memberId, to === "USED" ? "COUPON_USED" : "REDEMPTION_STATUS", { redemptionId: r.id, code: r.code, from: r.status, to }, now);
  if (notify) {
    await enqueue(tx, orgId, [
      {
        memberId: r.memberId,
        kind: "REDEMPTION_STATUS",
        dedupeKey: `REDEMPTION_STATUS:${r.id}:${to}`,
        payload: {
          code: r.code,
          kind: r.kind,
          rewardName: r.rewardName,
          status: to,
          note: extra.note ?? null,
          carrier: extra.carrier ?? r.carrier,
          trackingNo: extra.trackingNo ?? r.trackingNo,
          refunded: REFUNDED.includes(to) ? r.costPoints : 0,
          method: (r.delivery as Delivery | null)?.method ?? null,
        },
      },
    ]);
  }
}

export async function updateRedemption(
  orgId: string,
  actor: Actor,
  id: string,
  input: { status?: RedemptionStatus; note?: string; carrier?: string; trackingNo?: string; takeOwnership?: boolean },
  now = new Date(),
): Promise<void> {
  if (actor.kind !== "staff") throw new CoreError("FORBIDDEN", "เฉพาะพนักงานเท่านั้น");
  await inTx(orgId, async (tx) => {
    const r = await tx.redemption.findFirst({ where: { id }, include: { reward: true } });
    if (!r) throw new CoreError("NOT_FOUND", "ไม่พบรายการแลก");
    const note = input.note?.trim().slice(0, 500) || null;
    const carrier = input.carrier?.trim().slice(0, 60) || null;
    const trackingNo = input.trackingNo?.trim().slice(0, 60) || null;
    if (!input.status || input.status === r.status) {
      // Details only: tracking number, owner, a note — no message to the member.
      const data: Prisma.RedemptionUpdateManyMutationInput = {};
      if (input.carrier !== undefined) data.carrier = carrier;
      if (input.trackingNo !== undefined) data.trackingNo = trackingNo;
      if (input.takeOwnership) data.ownerId = actor.userId;
      if (input.note !== undefined) data.note = note;
      await tx.redemption.updateMany({ where: { id: r.id }, data });
      await writeAudit(tx, orgId, actor, { action: "redemption.update", entity: "redemption", entityId: r.id, before: { carrier: r.carrier, trackingNo: r.trackingNo, ownerId: r.ownerId, note: r.note }, after: data });
      return;
    }
    const allowed = NEXT_STATUS[r.status] ?? [];
    if (!allowed.includes(input.status)) {
      throw new CoreError("INVALID_INPUT", `เปลี่ยนจาก "${REDEMPTION_STATUS_LABEL[r.status]}" เป็น "${REDEMPTION_STATUS_LABEL[input.status]}" ไม่ได้`);
    }
    if (REFUNDED.includes(input.status) && !note) throw new CoreError("INVALID_INPUT", "ใส่เหตุผล — ลูกค้าจะเห็นข้อความนี้ใน LINE");
    if (input.status === "SHIPPED" && !trackingNo && !r.trackingNo) throw new CoreError("INVALID_INPUT", "ใส่เลขพัสดุก่อนเปลี่ยนเป็นจัดส่งแล้ว");
    await moveStatus(
      tx,
      orgId,
      r,
      input.status,
      actor.userId,
      {
        note,
        ...(input.carrier !== undefined ? { carrier } : {}),
        ...(input.trackingNo !== undefined ? { trackingNo } : {}),
        ...(r.ownerId ? {} : { ownerId: actor.userId }),
      },
      now,
      true,
    );
    await writeAudit(tx, orgId, actor, {
      action: "redemption.status",
      entity: "redemption",
      entityId: r.id,
      before: { status: r.status },
      after: { status: input.status, refunded: REFUNDED.includes(input.status) ? r.costPoints : 0 },
      reason: note,
    });
  });
}

/** The member withdraws a physical request before anyone has looked at it. */
export async function cancelMyRedemption(orgId: string, memberId: string, id: string, now = new Date()): Promise<void> {
  await inTx(orgId, async (tx) => {
    const r = await tx.redemption.findFirst({ where: { id, memberId }, include: { reward: true } });
    if (!r) throw new CoreError("NOT_FOUND", "ไม่พบรายการ");
    if (!(r.kind === "PHYSICAL" && r.status === "SUBMITTED")) throw new CoreError("COUPON_STATE", "ทีมงานรับเรื่องแล้ว ยกเลิกเองไม่ได้ — ติดต่อร้าน");
    await moveStatus(tx, orgId, r, "CANCELLED", "member", { note: "ลูกค้ายกเลิกเอง" }, now, false);
  });
}

// ---------------------------------------------------------------------------
// Coupons at the counter
// ---------------------------------------------------------------------------

export interface CouponCheck {
  redemptionId: string;
  code: string;
  couponCode: string;
  rewardName: string;
  valueSatang: number | null;
  minSpendSatang: number | null;
  terms: string;
  status: RedemptionStatus;
  statusLabel: string;
  usable: boolean;
  problem: string | null;
  expiresAt: Date | null;
  usedAt: Date | null;
  usedStoreName: string | null;
  usedInvoiceNo: string | null;
  member: { id: string; code: string; displayName: string; tier: string } | null;
}

export async function checkCoupon(orgId: string, raw: string, now = new Date()): Promise<CouponCheck> {
  const couponCode = normalizeCouponCode(raw);
  if (!couponCode) throw new CoreError("INVALID_INPUT", "รหัสคูปองไม่ถูกต้อง — ต้องเป็น MST-XXXX-XXXX");
  const r = await db(orgId).redemption.findFirst({
    where: { couponCode },
    include: { reward: true, usedStore: { select: { name: true } }, member: { select: { id: true, code: true, displayName: true, tier: true, status: true } } },
  });
  if (!r) throw new CoreError("NOT_FOUND", "ไม่พบคูปองนี้");
  const expired = r.status === "ISSUED" && !!r.expiresAt && r.expiresAt < now;
  const status: RedemptionStatus = expired ? "EXPIRED" : r.status;
  const problem =
    status === "USED"
      ? "คูปองนี้ใช้ไปแล้ว"
      : status === "EXPIRED"
        ? "คูปองหมดอายุแล้ว"
        : status === "CANCELLED"
          ? "คูปองถูกยกเลิกแล้ว"
          : r.member.status !== "ACTIVE"
            ? "บัญชีสมาชิกนี้ถูกปิดแล้ว"
            : null;
  return {
    redemptionId: r.id,
    code: r.code,
    couponCode,
    rewardName: r.rewardName,
    valueSatang: r.valueSatang,
    minSpendSatang: r.reward.minSpendSatang,
    terms: r.reward.terms,
    status,
    statusLabel: REDEMPTION_STATUS_LABEL[status],
    usable: problem === null,
    problem,
    expiresAt: r.expiresAt,
    usedAt: r.usedAt,
    usedStoreName: r.usedStore?.name ?? null,
    usedInvoiceNo: r.usedInvoiceNo,
    member: r.member.status === "ACTIVE" ? { id: r.member.id, code: r.member.code, displayName: r.member.displayName, tier: r.member.tier } : null,
  };
}

/** Staff mark a coupon used. Works once: a second scan, anywhere, is refused. */
export async function useCoupon(
  orgId: string,
  actor: Actor,
  input: { couponCode: string; storeId?: string | null; invoiceNo?: string | null },
  now = new Date(),
): Promise<CouponCheck> {
  if (actor.kind !== "staff") throw new CoreError("FORBIDDEN", "เฉพาะพนักงานเท่านั้น");
  const check = await checkCoupon(orgId, input.couponCode, now);
  if (!check.usable) throw new CoreError("COUPON_STATE", check.problem ?? "ใช้คูปองนี้ไม่ได้");
  const invoiceNo = input.invoiceNo?.trim().slice(0, 40) || null;
  await inTx(orgId, async (tx) => {
    const r = await tx.redemption.findFirst({ where: { id: check.redemptionId }, include: { reward: true } });
    if (!r || r.status !== "ISSUED") throw new CoreError("COUPON_STATE", "คูปองนี้เพิ่งถูกใช้หรือยกเลิก");
    let storeId: string | null = null;
    if (input.storeId) {
      const store = await tx.store.findFirst({ where: { id: input.storeId }, select: { id: true } });
      if (!store) throw new CoreError("INVALID_INPUT", "ไม่พบสาขา");
      storeId = store.id;
    }
    await moveStatus(tx, orgId, r, "USED", actor.userId, { usedStoreId: storeId, usedInvoiceNo: invoiceNo, usedById: actor.userId }, now, true);
    await writeAudit(tx, orgId, actor, { action: "coupon.use", entity: "redemption", entityId: r.id, after: { couponCode: r.couponCode, storeId, invoiceNo } });
  });
  return checkCoupon(orgId, input.couponCode, now);
}

/** Nightly: coupons past their date become EXPIRED. Points are not returned — the member had the coupon. */
export async function expireCoupons(orgId: string, now = new Date()): Promise<number> {
  const client = db(orgId);
  const due = await client.redemption.findMany({ where: { status: "ISSUED", expiresAt: { lt: now } }, select: { id: true, history: true, memberId: true, code: true } });
  for (const r of due) {
    const history = [...((r.history as unknown as HistoryEntry[]) ?? []), { status: "EXPIRED", at: now.toISOString(), by: "system" }];
    await client.redemption.updateMany({ where: { id: r.id, status: "ISSUED" }, data: { status: "EXPIRED", history: history as unknown as Prisma.InputJsonValue } });
  }
  return due.length;
}

// ---------------------------------------------------------------------------
// Back-office lists and the report
// ---------------------------------------------------------------------------

export interface RedemptionListFilter {
  view?: "open" | "coupons" | "closed" | "all";
  kind?: RewardKind;
  q?: string;
  take?: number;
}

export async function listRedemptions(orgId: string, f: RedemptionListFilter = {}) {
  const where: Prisma.RedemptionWhereInput = {};
  if (f.view === "open") Object.assign(where, { kind: "PHYSICAL", status: { in: OPEN_STATUSES } });
  else if (f.view === "coupons") where.kind = "COUPON";
  else if (f.view === "closed") Object.assign(where, { kind: "PHYSICAL", status: { notIn: OPEN_STATUSES } });
  if (f.kind) where.kind = f.kind;
  const q = f.q?.trim();
  if (q) {
    const coupon = normalizeCouponCode(q);
    where.OR = [
      { code: { equals: q.toUpperCase() } },
      ...(coupon ? [{ couponCode: coupon }] : []),
      { member: { code: { equals: q.toUpperCase() } } },
      { member: { displayName: { contains: q, mode: "insensitive" } } },
      { rewardName: { contains: q, mode: "insensitive" } },
    ];
  }
  return db(orgId).redemption.findMany({
    where,
    orderBy: { createdAt: f.view === "open" ? "asc" : "desc" },
    take: f.take ?? 200,
    include: { member: { select: { id: true, code: true, displayName: true, tier: true } }, usedStore: { select: { name: true } } },
  });
}

export async function getRedemption(orgId: string, id: string) {
  const client = db(orgId);
  const r = await client.redemption.findFirst({
    where: { id },
    include: {
      reward: true,
      usedStore: { select: { name: true } },
      member: { select: { id: true, code: true, displayName: true, tier: true, points: true, status: true } },
    },
  });
  if (!r) return null;
  const userIds = [
    r.ownerId,
    r.usedById,
    ...((r.history as unknown as HistoryEntry[]) ?? []).map((h) => h.by),
  ].filter((x): x is string => !!x && x !== "member" && x !== "system");
  const users = userIds.length ? await client.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [];
  const names = Object.fromEntries(users.map((u) => [u.id, u.name ?? u.email]));
  const delivery = (r.delivery as Delivery | null) ?? null;
  const pickupStore = delivery?.storeId ? await client.store.findFirst({ where: { id: delivery.storeId }, select: { name: true } }) : null;
  return { ...r, names, pickupStoreName: pickupStore?.name ?? null, next: NEXT_STATUS[r.status] ?? [] };
}

export interface RewardsReport {
  pointsEarned: number;
  pointsRedeemed: number; // net of refunds
  redemptions: number;
  couponsIssued: number;
  couponsUsed: number;
  couponUseRate: number | null;
  openRequests: number;
  avgFulfilmentDays: number | null;
  byReward: Array<{ rewardId: string; name: string; kind: RewardKind; count: number; points: number }>;
}

export async function rewardsReport(orgId: string, from: Date, to: Date): Promise<RewardsReport> {
  const client = db(orgId);
  const inRange = { gte: from, lt: to };
  const [earned, redeemed, refunded, rows, open, completed] = await Promise.all([
    client.pointTransaction.aggregate({ where: { createdAt: inRange, delta: { gt: 0 }, reason: { notIn: ["REDEEM_REFUND", "MERGE_IN"] } }, _sum: { delta: true } }),
    client.pointTransaction.aggregate({ where: { createdAt: inRange, reason: "REDEEM" }, _sum: { delta: true } }),
    client.pointTransaction.aggregate({ where: { createdAt: inRange, reason: "REDEEM_REFUND" }, _sum: { delta: true } }),
    client.redemption.findMany({ where: { createdAt: inRange }, select: { rewardId: true, rewardName: true, kind: true, status: true, costPoints: true } }),
    client.redemption.count({ where: { kind: "PHYSICAL", status: { in: OPEN_STATUSES } } }),
    client.redemption.findMany({ where: { kind: "PHYSICAL", status: "COMPLETED", updatedAt: inRange }, select: { createdAt: true, updatedAt: true } }),
  ]);
  const live = rows.filter((r) => !REFUNDED.includes(r.status));
  const coupons = live.filter((r) => r.kind === "COUPON");
  const used = coupons.filter((r) => r.status === "USED").length;
  const settledCoupons = coupons.filter((r) => r.status === "USED" || r.status === "EXPIRED").length;
  const by = new Map<string, RewardsReport["byReward"][number]>();
  for (const r of live) {
    const e = by.get(r.rewardId) ?? { rewardId: r.rewardId, name: r.rewardName, kind: r.kind, count: 0, points: 0 };
    e.count++;
    e.points += r.costPoints;
    by.set(r.rewardId, e);
  }
  return {
    pointsEarned: earned._sum.delta ?? 0,
    pointsRedeemed: -(redeemed._sum.delta ?? 0) - (refunded._sum.delta ?? 0),
    redemptions: live.length,
    couponsIssued: coupons.length,
    couponsUsed: used,
    couponUseRate: settledCoupons ? used / settledCoupons : null,
    openRequests: open,
    avgFulfilmentDays: completed.length
      ? completed.reduce((s, r) => s + (r.updatedAt.getTime() - r.createdAt.getTime()), 0) / completed.length / DAY_MS
      : null,
    byReward: [...by.values()].sort((a, b) => b.count - a.count),
  };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function cleanAlertEmails(raw: unknown): string[] {
  const list = (Array.isArray(raw) ? raw : String(raw ?? "").split(/[\s,;]+/)).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  for (const e of list) if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new CoreError("INVALID_INPUT", `อีเมลไม่ถูกต้อง: ${e}`);
  if (list.length > 10) throw new CoreError("INVALID_INPUT", "ใส่อีเมลได้ไม่เกิน 10 อีเมล");
  return [...new Set(list)];
}
