import type {
  EventLike,
  FunnelStage,
  MemberLike,
  OverviewStats,
} from "./types";

const DAY = 24 * 60 * 60 * 1000;

export function overviewStats(
  members: MemberLike[],
  events: EventLike[],
  opts: { now: Date; churnDays: number; currency: string },
): OverviewStats {
  const { now, churnDays, currency } = opts;
  const cutoff30 = new Date(now.getTime() - 30 * DAY);
  const churnCutoff = new Date(now.getTime() - churnDays * DAY);

  const newMembers30d = members.filter((m) => m.createdAt >= cutoff30).length;
  const activeMembers30d = members.filter(
    (m) => m.lastSeenAt && m.lastSeenAt >= cutoff30,
  ).length;
  const atRiskMembers = members.filter(
    (m) => !m.lastSeenAt || m.lastSeenAt < churnCutoff,
  ).length;
  const pointsIssued = members.reduce((sum, m) => sum + Math.max(0, m.points), 0);
  const revenue = events
    .filter((e) => e.type === "PURCHASE")
    .reduce((sum, e) => sum + (e.payload?.amount ?? 0), 0);

  return {
    totalMembers: members.length,
    newMembers30d,
    activeMembers30d,
    atRiskMembers,
    pointsIssued,
    revenue,
    currency,
  };
}

/**
 * Acquisition funnel: SCAN_QR → REGISTER → PURCHASE → Repeat (2+ purchases).
 * Counts distinct members reaching each stage.
 */
export function acquisitionFunnel(events: EventLike[]): FunnelStage[] {
  const scanned = new Set<string>();
  const registered = new Set<string>();
  const purchaseCount = new Map<string, number>();

  for (const e of events) {
    if (e.type === "SCAN_QR") scanned.add(e.memberId);
    if (e.type === "REGISTER") registered.add(e.memberId);
    if (e.type === "PURCHASE") {
      purchaseCount.set(e.memberId, (purchaseCount.get(e.memberId) ?? 0) + 1);
    }
  }

  const purchased = [...purchaseCount.keys()].length;
  const repeat = [...purchaseCount.values()].filter((c) => c >= 2).length;

  // SCAN_QR is an ongoing loyalty check-in (happens after signup), not a
  // pre-registration step, so the acquisition funnel starts at Registered.
  // `scanned` stays computed for other analytics but is not a funnel stage.
  void scanned;
  const raw: Array<{ stage: string; members: number }> = [
    { stage: "Registered", members: registered.size },
    { stage: "Purchased", members: purchased },
    { stage: "Repeat", members: repeat },
  ];

  const firstNonZero = raw.findIndex((s) => s.members > 0);
  const stages = firstNonZero <= 0 ? raw : raw.slice(firstNonZero);

  let prev = 0;
  return stages.map((s, i) => {
    const conversionFromPrev = i === 0 ? 1 : prev > 0 ? s.members / prev : 0;
    prev = s.members;
    return { ...s, conversionFromPrev };
  });
}
