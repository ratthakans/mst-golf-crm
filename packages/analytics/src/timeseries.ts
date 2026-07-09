import type { EventLike, MemberLike } from "./types";

export interface MonthPoint {
  month: string; // "YYYY-MM"
  label: string; // "Jul"
  revenue: number;
  signups: number;
  activeMembers: number; // distinct members with any event that month
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Monthly revenue / signups / active-member series over the last `monthsBack`. */
export function monthlySeries(
  members: MemberLike[],
  events: EventLike[],
  now: Date,
  monthsBack = 6,
): MonthPoint[] {
  const buckets: string[] = [];
  const active = new Map<string, Set<string>>();
  const revenue = new Map<string, number>();
  const signups = new Map<string, number>();

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = monthKey(d);
    buckets.push(key);
    active.set(key, new Set());
    revenue.set(key, 0);
    signups.set(key, 0);
  }
  const inWindow = (key: string) => active.has(key);

  for (const e of events) {
    const key = monthKey(e.occurredAt);
    if (!inWindow(key)) continue;
    active.get(key)!.add(e.memberId);
    if (e.type === "PURCHASE") {
      revenue.set(key, revenue.get(key)! + (e.payload?.amount ?? 0));
    }
  }

  for (const m of members) {
    const key = monthKey(m.createdAt);
    if (inWindow(key)) signups.set(key, signups.get(key)! + 1);
  }

  return buckets.map((key) => {
    const monthIdx = Number(key.slice(5, 7)) - 1;
    return {
      month: key,
      label: MONTHS[monthIdx] ?? key,
      revenue: revenue.get(key) ?? 0,
      signups: signups.get(key) ?? 0,
      activeMembers: active.get(key)?.size ?? 0,
    };
  });
}
