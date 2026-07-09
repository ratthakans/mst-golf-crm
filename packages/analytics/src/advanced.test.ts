import { describe, expect, it } from "vitest";
import { buildDemoDataset } from "./fixture";
import { computeRfm } from "./rfm";
import { computeClv } from "./clv";
import { computeChurn } from "./churn";
import { monthlySeries } from "./timeseries";
import { cohortRetention } from "./cohort";
import { productAffinity } from "./affinity";
import { buildProfiles, resolveSegment } from "./segments-engine";
import { eligibleMembers, isEligible } from "./automation";
import {
  mean, median, quantileSorted, quintileScore, twoProportionZTest,
} from "./stats-core";

const NOW = new Date("2026-07-05T00:00:00.000Z");
const { members, events, org } = buildDemoDataset(NOW);

describe("stats-core", () => {
  it("mean & median", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("quantileSorted interpolates", () => {
    expect(quantileSorted([0, 10], 0.5)).toBe(5);
    expect(quantileSorted([0, 100], 0.9)).toBe(90);
  });
  it("quintileScore: higher value → higher score when ascending", () => {
    const pop = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(quintileScore(pop, 9, true)).toBe(5);
    expect(quintileScore(pop, 0, true)).toBe(1);
    // descending: low value → high score (recency)
    expect(quintileScore(pop, 0, false)).toBe(5);
  });
  it("two-proportion z-test flags a real lift", () => {
    const r = twoProportionZTest(50, 1000, 90, 1000); // 5% vs 9%
    expect(r.significant).toBe(true);
    expect(r.lift).toBeCloseTo(0.04, 5);
  });
  it("two-proportion z-test: tiny difference not significant", () => {
    const r = twoProportionZTest(50, 1000, 52, 1000);
    expect(r.significant).toBe(false);
  });
});

describe("CLV", () => {
  const clv = computeClv(members, events, NOW);
  const byId = new Map(clv.map((c) => [c.memberId, c]));
  it("historical spend = sum of purchases", () => {
    expect(byId.get("U_champion_001")?.historical).toBe(15192 + 5120 + 17600);
  });
  it("champion has the highest predicted lifetime value", () => {
    const sorted = [...clv].sort((a, b) => b.predictedLifetime - a.predictedLifetime);
    expect(sorted[0]?.memberId).toBe("U_champion_001");
  });
  it("a member with no orders has zero CLV", () => {
    expect(byId.get("U_new_003")?.predictedLifetime).toBe(0);
  });
});

describe("churn", () => {
  const churn = computeChurn(members, events, NOW, { churnDays: org.churnDays });
  const byId = new Map(churn.map((c) => [c.memberId, c]));
  it("recently active member is 'active' with low probability", () => {
    const champ = byId.get("U_champion_001")!;
    expect(champ.status).toBe("active");
    expect(champ.probability).toBeLessThan(0.3);
  });
  it("long-inactive member is 'churned' with high probability", () => {
    const dormant = byId.get("U_dormant_005")!;
    expect(dormant.status).toBe("churned");
    expect(dormant.probability).toBeGreaterThan(0.7);
  });
});

describe("time-series", () => {
  const series = monthlySeries(members, events, NOW, 6);
  it("returns one point per month", () => {
    expect(series).toHaveLength(6);
  });
  it("counts signups within the window (4 of 5; dormant is older)", () => {
    const totalSignups = series.reduce((s, p) => s + p.signups, 0);
    expect(totalSignups).toBe(4);
  });
});

describe("cohort retention", () => {
  const report = cohortRetention(members, events, NOW, 6);
  it("all members land in a cohort", () => {
    const total = report.rows.reduce((s, r) => s + r.size, 0);
    expect(total).toBe(5);
  });
  it("month-0 retention is a fraction between 0 and 1", () => {
    for (const row of report.rows) {
      const m0 = row.retention[0];
      if (m0 !== null) expect(m0).toBeGreaterThanOrEqual(0), expect(m0).toBeLessThanOrEqual(1);
    }
  });
});

describe("product affinity", () => {
  const report = productAffinity(events);
  it("counts baskets (purchases with items)", () => {
    expect(report.totalBaskets).toBe(8);
  });
  it("finds accessories+balls bought together (lift > 0)", () => {
    const pair = report.pairs.find(
      (p) => [p.a, p.b].sort().join(",") === "accessories,balls",
    );
    expect(pair).toBeDefined();
    expect(pair!.count).toBeGreaterThanOrEqual(2);
    expect(pair!.lift).toBeGreaterThan(0);
  });
});

describe("segment engine", () => {
  const rfm = computeRfm(members, events, NOW);
  const clv = computeClv(members, events, NOW);
  const churn = computeChurn(members, events, NOW, { churnDays: org.churnDays });
  const profiles = buildProfiles(members, rfm, clv, churn);

  it("resolves an RFM-segment rule", () => {
    const champs = resolveSegment(profiles, {
      all: [{ field: "rfmSegment", op: "eq", value: "Champion" }],
    });
    expect(champs).toHaveLength(1);
    expect(champs[0]?.memberId).toBe("U_champion_001");
  });
  it("resolves an attribute 'contains' rule (Titleist fans)", () => {
    const fans = resolveSegment(profiles, {
      all: [{ field: "attributes.preferredBrands", op: "contains", value: "titleist" }],
    });
    expect(fans.map((p) => p.memberId).sort()).toEqual([
      "U_atrisk_004",
      "U_champion_001",
    ]);
  });
});

describe("automation eligibility", () => {
  const rfm = computeRfm(members, events, NOW);
  const clv = computeClv(members, events, NOW);
  const churn = computeChurn(members, events, NOW, { churnDays: org.churnDays });
  const profiles = buildProfiles(members, rfm, clv, churn);

  it("win-back targets members inactive ≥ 60 days", () => {
    const eligible = eligibleMembers(profiles, { type: "no_activity_days", days: 60 });
    expect(eligible.map((p) => p.memberId).sort()).toEqual([
      "U_atrisk_004",
      "U_dormant_005",
    ]);
  });
  it("near_tier_up matches only the 1700–1999 band", () => {
    const base = profiles[0]!;
    expect(isEligible({ ...base, points: 1800 }, { type: "near_tier_up", withinPoints: 300, tierThreshold: 2000 })).toBe(true);
    expect(isEligible({ ...base, points: 1500 }, { type: "near_tier_up", withinPoints: 300, tierThreshold: 2000 })).toBe(false);
    expect(isEligible({ ...base, points: 2100 }, { type: "near_tier_up", withinPoints: 300, tierThreshold: 2000 })).toBe(false);
  });
});
