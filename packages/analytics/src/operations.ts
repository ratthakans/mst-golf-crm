import type { EventLike } from "./types";

// Operational analytics computed from the raw event log — the "use cases" a
// shop owner cares about: where sales come from, what sells, when it's busy,
// and how the points economy is doing.

export interface ChannelStat { channel: string; revenue: number; orders: number; }
export interface ProductStat { name: string; category: string; brand?: string; units: number; revenue: number; }
export interface BranchStat { branch: string; revenue: number; orders: number; visits: number; }
export interface HourStat { hour: number; count: number; }
export interface PointsEconomy { earned: number; redeemed: number; outstanding: number; redemptionRate: number; }

const CHANNEL_LABEL: Record<string, string> = { store: "หน้าร้าน", online: "ออนไลน์", arena: "อารีนา" };
export const channelLabel = (c: string) => CHANNEL_LABEL[c] ?? c;

export function channelMix(events: EventLike[]): ChannelStat[] {
  const m = new Map<string, ChannelStat>();
  for (const e of events) {
    if (e.type !== "PURCHASE") continue;
    const ch = e.payload?.channel ?? "store";
    const s = m.get(ch) ?? { channel: ch, revenue: 0, orders: 0 };
    s.revenue += e.payload?.amount ?? 0;
    s.orders += 1;
    m.set(ch, s);
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue);
}

export function topProducts(events: EventLike[], limit = 8): ProductStat[] {
  const m = new Map<string, ProductStat>();
  for (const e of events) {
    if (e.type !== "PURCHASE") continue;
    for (const it of e.payload?.items ?? []) {
      const s = m.get(it.name) ?? { name: it.name, category: it.category, brand: it.brand, units: 0, revenue: 0 };
      s.units += it.qty;
      s.revenue += it.qty * it.unitPrice;
      m.set(it.name, s);
    }
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export function branchPerformance(events: EventLike[]): BranchStat[] {
  const m = new Map<string, BranchStat>();
  const get = (b: string) => {
    let s = m.get(b);
    if (!s) { s = { branch: b, revenue: 0, orders: 0, visits: 0 }; m.set(b, s); }
    return s;
  };
  for (const e of events) {
    const b = e.payload?.branch;
    if (!b) continue;
    if (e.type === "PURCHASE") { const s = get(b); s.revenue += e.payload?.amount ?? 0; s.orders += 1; }
    else if (e.type === "VISIT") { get(b).visits += 1; }
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue);
}

/** Activity by hour of day (footfall + purchases) — reveals peak trading hours. */
export function hourDistribution(events: EventLike[]): HourStat[] {
  const counts = new Array(24).fill(0) as number[];
  for (const e of events) {
    if (e.type === "PURCHASE" || e.type === "VISIT" || e.type === "SCAN_QR") {
      counts[e.occurredAt.getHours()] = (counts[e.occurredAt.getHours()] ?? 0) + 1;
    }
  }
  const out: HourStat[] = [];
  for (let h = 8; h <= 21; h++) out.push({ hour: h, count: counts[h] ?? 0 });
  return out;
}

export function pointsEconomy(events: EventLike[], memberPoints: number[]): PointsEconomy {
  let earned = 0;
  let redeemed = 0;
  for (const e of events) {
    if (e.type === "EARN_POINTS") earned += e.payload?.delta ?? 0;
    if (e.type === "REDEEM_POINTS") redeemed += Math.abs(e.payload?.delta ?? 0);
  }
  const outstanding = memberPoints.reduce((s, p) => s + Math.max(0, p), 0);
  const redemptionRate = earned > 0 ? redeemed / earned : 0;
  return { earned, redeemed, outstanding, redemptionRate };
}

export function eventTypeCounts(events: EventLike[]): Array<{ type: string; count: number }> {
  const m = new Map<string, number>();
  for (const e of events) m.set(e.type, (m.get(e.type) ?? 0) + 1);
  return [...m.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
}
