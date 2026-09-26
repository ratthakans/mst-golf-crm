import type { TierSettings } from "./types";

// Membership tiers — pure logic shared by the dashboard, the API, the nightly
// job and the sample-data generator. Imported via "@mstgolf/shared/tiers" so
// client bundles never pull in the node-only crypto helpers.

/** Trailing window used to rank members. */
export const TIER_WINDOW_DAYS = 365;

// Three tiers ranked by net spend over the last 12 months. Thresholds, point
// rates and benefits are defaults until MST confirms them (docs/PRODUCT.md §6 #4);
// every org overrides them in Organization.settings.tiers.
export const DEFAULT_TIERS: TierSettings[] = [
  {
    key: "member",
    name: "Member",
    minSpend12m: 0,
    pointRate: 1,
    benefits: {
      discountPct: 0,
      birthdayPointMultiplier: 2,
      simDiscountPct: 0,
      simBookingDaysAhead: 14,
      exclusiveCampaigns: false,
    },
  },
  {
    key: "silver",
    name: "Silver",
    minSpend12m: 100_000,
    pointRate: 1.25,
    benefits: {
      discountPct: 5,
      birthdayPointMultiplier: 2,
      simDiscountPct: 10,
      simBookingDaysAhead: 14,
      exclusiveCampaigns: false,
    },
  },
  {
    key: "gold",
    name: "Gold",
    minSpend12m: 1_000_000,
    pointRate: 1.5,
    benefits: {
      discountPct: 10,
      birthdayPointMultiplier: 2,
      simDiscountPct: 20,
      simBookingDaysAhead: 21,
      exclusiveCampaigns: true,
    },
  },
];

function isTierSettings(t: unknown): t is TierSettings {
  const v = t as Partial<TierSettings> | null;
  return (
    !!v &&
    typeof v.key === "string" &&
    typeof v.name === "string" &&
    typeof v.minSpend12m === "number" &&
    typeof v.pointRate === "number" &&
    !!v.benefits
  );
}

/**
 * The org's tiers, lowest threshold first. Settings written before tiers moved
 * to 12-month spend (the old `{ name, minPoints }` shape) fall back to the
 * defaults instead of silently ranking members by points.
 */
export function resolveTiers(raw: unknown): TierSettings[] {
  const list = Array.isArray(raw) && raw.length > 0 && raw.every(isTierSettings) ? raw : DEFAULT_TIERS;
  return [...list].sort((a, b) => a.minSpend12m - b.minSpend12m);
}

/** Look a tier up by key or display name (case-insensitive). */
export function findTier(nameOrKey: string | null | undefined, tiers: TierSettings[]): TierSettings | undefined {
  if (!nameOrKey) return undefined;
  const needle = nameOrKey.toLowerCase();
  return tiers.find((t) => t.key.toLowerCase() === needle || t.name.toLowerCase() === needle);
}

/** Position in the ladder (0 = entry tier), or -1 when the name is unknown. */
export function tierRank(nameOrKey: string | null | undefined, tiers: TierSettings[]): number {
  const t = findTier(nameOrKey, tiers);
  return t ? resolveTiers(tiers).indexOf(t) : -1;
}

export function lowestTier(tiers: TierSettings[]): TierSettings {
  const first = resolveTiers(tiers)[0];
  if (!first) throw new Error("No tiers configured");
  return first;
}

/** The tier a 12-month spend qualifies for. */
export function tierForSpend(spend12m: number, tiers: TierSettings[]): TierSettings {
  let earned = lowestTier(tiers);
  for (const t of resolveTiers(tiers)) if (spend12m >= t.minSpend12m) earned = t;
  return earned;
}

export interface TierProgress {
  tier: TierSettings;
  next: TierSettings | null;
  /** Spend still needed to reach `next`; null at the top tier. */
  remaining: number | null;
  /** 0–1 share of the way from this tier's threshold to the next; 1 at the top. */
  pct: number;
}

export function tierProgress(spend12m: number, tiers: TierSettings[]): TierProgress {
  const ranked = resolveTiers(tiers);
  const tier = tierForSpend(spend12m, ranked);
  const next = ranked[ranked.indexOf(tier) + 1] ?? null;
  if (!next) return { tier, next: null, remaining: null, pct: 1 };
  const span = next.minSpend12m - tier.minSpend12m;
  const pct = span > 0 ? Math.min(1, Math.max(0, (spend12m - tier.minSpend12m) / span)) : 1;
  return { tier, next, remaining: Math.max(0, next.minSpend12m - spend12m), pct };
}

/**
 * Upgrades apply the moment spend crosses a threshold; downgrades wait for the
 * monthly review so a member never loses a tier mid-month. An unknown current
 * tier (e.g. a legacy name) is recomputed from spend in either direction.
 */
export function reviewTier(
  current: string | null | undefined,
  spend12m: number,
  tiers: TierSettings[],
  opts: { allowDowngrade: boolean },
): TierSettings {
  const earned = tierForSpend(spend12m, tiers);
  const held = findTier(current, tiers);
  if (!held) return earned;
  if (tierRank(earned.key, tiers) > tierRank(held.key, tiers)) return earned;
  return opts.allowDowngrade ? earned : held;
}

/** Base points scaled by the tier's rate, rounded down. */
export function applyTierRate(basePoints: number, tier: TierSettings): number {
  return Math.floor(basePoints * tier.pointRate);
}

/**
 * Sum of purchase amounts inside the trailing window ending at `now`. Purchases
 * stamped slightly after `now` (clock skew, later today) still count.
 */
export function spendInWindow(
  purchases: Array<{ amount: number; at: Date }>,
  now: Date,
  days = TIER_WINDOW_DAYS,
): number {
  const from = now.getTime() - days * 24 * 60 * 60 * 1000;
  let sum = 0;
  for (const p of purchases) {
    const t = p.at.getTime();
    if (t >= from && Number.isFinite(p.amount)) sum += p.amount;
  }
  return sum;
}

/** Downgrades run on the 1st of the month in the org's timezone. */
export function isMonthlyTierReview(now: Date, timeZone = "Asia/Bangkok"): boolean {
  const day = new Intl.DateTimeFormat("en-US", { timeZone, day: "numeric" }).format(now);
  return day === "1";
}
