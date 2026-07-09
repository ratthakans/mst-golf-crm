// Reusable statistical primitives. Pure and dependency-free so they run in the
// browser (dashboard) and on the server (jobs / API) alike, and are easy to test.

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: number[]): number {
  return quantileSorted([...xs].sort((a, b) => a - b), 0.5);
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/** Linear-interpolated quantile of an already-sorted ascending array. p in [0,1]. */
export function quantileSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

/** Fraction of the population strictly below `value` (0..1). */
export function percentileRank(population: number[], value: number): number {
  if (population.length === 0) return 0;
  const below = population.filter((x) => x < value).length;
  return below / population.length;
}

/**
 * Quintile score 1..5 based on where `value` sits in the population.
 * `ascending=true` → higher value = higher score (Frequency, Monetary).
 * `ascending=false` → lower value = higher score (Recency days).
 */
export function quintileScore(
  population: number[],
  value: number,
  ascending = true,
): number {
  const rank = percentileRank(population, value); // 0..1
  const raw = ascending ? rank : 1 - rank;
  return Math.min(5, Math.max(1, Math.floor(raw * 5) + 1));
}

export interface ZTestResult {
  z: number;
  pValue: number; // two-tailed
  significant: boolean; // at alpha = 0.05
  lift: number; // pB - pA
}

/** Two-proportion z-test — compare conversion rates of two campaign variants. */
export function twoProportionZTest(
  successA: number,
  nA: number,
  successB: number,
  nB: number,
): ZTestResult {
  if (nA === 0 || nB === 0) {
    return { z: 0, pValue: 1, significant: false, lift: 0 };
  }
  const pA = successA / nA;
  const pB = successB / nB;
  const pPool = (successA + successB) / (nA + nB);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / nA + 1 / nB));
  const z = se === 0 ? 0 : (pB - pA) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  return { z, pValue, significant: pValue < 0.05, lift: pB - pA };
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 approximation). */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}
