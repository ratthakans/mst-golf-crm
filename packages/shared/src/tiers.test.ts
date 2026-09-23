import { describe, expect, it } from "vitest";
import {
  applyTierRate,
  DEFAULT_TIERS,
  isMonthlyTierReview,
  resolveTiers,
  reviewTier,
  spendInWindow,
  tierForSpend,
  tierProgress,
  tierRank,
} from "./tiers";

const T = DEFAULT_TIERS;

describe("tiers", () => {
  it("has exactly three tiers, lowest first", () => {
    expect(resolveTiers(T).map((t) => t.name)).toEqual(["Member", "Silver", "Gold"]);
  });

  it("ranks by 12-month spend at the thresholds", () => {
    expect(tierForSpend(0, T).name).toBe("Member");
    expect(tierForSpend(99_999, T).name).toBe("Member");
    expect(tierForSpend(100_000, T).name).toBe("Silver");
    expect(tierForSpend(999_999, T).name).toBe("Silver");
    expect(tierForSpend(1_000_000, T).name).toBe("Gold");
  });

  it("falls back to the defaults for the legacy points-based shape", () => {
    const legacy = [{ name: "Silver", minPoints: 0 }, { name: "Platinum", minPoints: 40000 }];
    expect(resolveTiers(legacy).map((t) => t.key)).toEqual(["member", "silver", "gold"]);
  });

  it("reports progress to the next tier", () => {
    const p = tierProgress(550_000, T);
    expect(p.tier.name).toBe("Silver");
    expect(p.next?.name).toBe("Gold");
    expect(p.remaining).toBe(450_000);
    expect(p.pct).toBeCloseTo(450_000 / 900_000);
    expect(tierProgress(1_500_000, T)).toMatchObject({ next: null, remaining: null, pct: 1 });
  });

  it("upgrades immediately but only downgrades at the monthly review", () => {
    expect(reviewTier("Member", 120_000, T, { allowDowngrade: false }).name).toBe("Silver");
    expect(reviewTier("Gold", 10_000, T, { allowDowngrade: false }).name).toBe("Gold");
    expect(reviewTier("Gold", 10_000, T, { allowDowngrade: true }).name).toBe("Member");
  });

  it("recomputes a legacy tier name from spend", () => {
    expect(reviewTier("Platinum", 150_000, T, { allowDowngrade: false }).name).toBe("Silver");
    expect(tierRank("Platinum", T)).toBe(-1);
  });

  it("applies the tier point rate, rounding down", () => {
    expect(applyTierRate(1_001, T[0]!)).toBe(1_001);
    expect(applyTierRate(1_001, T[1]!)).toBe(1_251);
    expect(applyTierRate(1_001, T[2]!)).toBe(1_501);
  });

  it("only counts spend inside the trailing 12 months", () => {
    const now = new Date("2026-09-23T00:00:00Z");
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
    const spend = spendInWindow(
      [
        { amount: 10_000, at: daysAgo(10) },
        { amount: 20_000, at: daysAgo(364) },
        { amount: 50_000, at: daysAgo(366) },
      ],
      now,
    );
    expect(spend).toBe(30_000);
  });

  it("runs the monthly review on the 1st in Bangkok time", () => {
    // 2026-09-30T18:00Z is 1 Oct 01:00 in Bangkok.
    expect(isMonthlyTierReview(new Date("2026-09-30T18:00:00Z"))).toBe(true);
    expect(isMonthlyTierReview(new Date("2026-09-30T10:00:00Z"))).toBe(false);
  });
});
