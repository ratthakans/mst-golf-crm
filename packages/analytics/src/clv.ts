import type { EventLike, MemberLike } from "./types";

const YEAR = 365 * 24 * 60 * 60 * 1000;

export interface ClvResult {
  memberId: string;
  displayName: string | null;
  historical: number; // total spend to date
  orders: number;
  avgOrderValue: number;
  annualFrequency: number; // orders per year over the member's tenure
  predictedAnnual: number; // AOV * annualFrequency
  predictedLifetime: number; // predictedAnnual * expected lifespan
}

/**
 * Customer Lifetime Value. `historical` is realised spend; `predictedLifetime`
 * is a simple non-contractual estimate: average order value × annual purchase
 * frequency × expected lifespan (years). Good enough to rank customers; swap in
 * BG/NBD + Gamma-Gamma once there's volume.
 */
export function computeClv(
  members: MemberLike[],
  events: EventLike[],
  now: Date,
  opts: { expectedLifespanYears?: number } = {},
): ClvResult[] {
  const lifespan = opts.expectedLifespanYears ?? 3;

  const purchasesByMember = new Map<string, EventLike[]>();
  for (const e of events) {
    if (e.type !== "PURCHASE") continue;
    const list = purchasesByMember.get(e.memberId) ?? [];
    list.push(e);
    purchasesByMember.set(e.memberId, list);
  }

  return members.map((member) => {
    const purchases = purchasesByMember.get(member.id) ?? [];
    const orders = purchases.length;
    const historical = purchases.reduce((s, p) => s + (p.payload?.amount ?? 0), 0);
    const avgOrderValue = orders > 0 ? historical / orders : 0;

    // Floor the observation window at 1 year so a burst of orders from a
    // just-joined member doesn't annualize into an absurd frequency.
    const tenureYears = Math.max(
      1,
      (now.getTime() - member.createdAt.getTime()) / YEAR,
    );
    const annualFrequency = orders / tenureYears;
    const predictedAnnual = avgOrderValue * annualFrequency;
    const predictedLifetime = predictedAnnual * lifespan;

    return {
      memberId: member.id,
      displayName: member.displayName,
      historical,
      orders,
      avgOrderValue,
      annualFrequency,
      predictedAnnual,
      predictedLifetime,
    };
  });
}
