import type { EventLike } from "./types";

export interface AffinityPair {
  a: string;
  b: string;
  count: number; // baskets containing both
  support: number; // count / totalBaskets
  lift: number; // P(A∩B) / (P(A)·P(B)); >1 = bought together more than chance
}

export interface CategoryStat {
  category: string;
  baskets: number;
  units: number;
  revenue: number;
}

interface AffinityReport {
  totalBaskets: number;
  categories: CategoryStat[];
  pairs: AffinityPair[];
}

/**
 * Market-basket analysis over PURCHASE items. Treats each purchase as a basket
 * of item categories, then finds category pairs bought together more than
 * chance (lift > 1) — the basis for cross-sell recommendations.
 */
export function productAffinity(events: EventLike[]): AffinityReport {
  const baskets: string[][] = [];
  const catStats = new Map<string, CategoryStat>();

  for (const e of events) {
    if (e.type !== "PURCHASE") continue;
    const items = e.payload?.items ?? [];
    if (items.length === 0) continue;

    const cats = new Set<string>();
    for (const it of items) {
      cats.add(it.category);
      const s = catStats.get(it.category) ?? {
        category: it.category,
        baskets: 0,
        units: 0,
        revenue: 0,
      };
      s.units += it.qty;
      s.revenue += it.qty * it.unitPrice;
      catStats.set(it.category, s);
    }
    for (const c of cats) catStats.get(c)!.baskets += 1;
    baskets.push([...cats]);
  }

  const totalBaskets = baskets.length;
  const singleCount = new Map<string, number>();
  for (const b of baskets) for (const c of b) singleCount.set(c, (singleCount.get(c) ?? 0) + 1);

  const pairCount = new Map<string, number>();
  for (const b of baskets) {
    const sorted = [...b].sort();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]}||${sorted[j]}`;
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
      }
    }
  }

  const pairs: AffinityPair[] = [...pairCount.entries()]
    .map(([key, count]) => {
      const [a, b] = key.split("||") as [string, string];
      const pa = (singleCount.get(a) ?? 0) / totalBaskets;
      const pb = (singleCount.get(b) ?? 0) / totalBaskets;
      const pab = count / totalBaskets;
      const lift = pa > 0 && pb > 0 ? pab / (pa * pb) : 0;
      return { a, b, count, support: pab, lift };
    })
    .sort((x, y) => y.lift - x.lift || y.count - x.count);

  return {
    totalBaskets,
    categories: [...catStats.values()].sort((a, b) => b.revenue - a.revenue),
    pairs,
  };
}
