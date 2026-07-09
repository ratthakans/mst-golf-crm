import { describe, expect, it } from "vitest";
import { buildDemoDataset } from "./fixture";
import { computeRfm, segmentCounts } from "./rfm";
import { acquisitionFunnel, overviewStats } from "./stats";

// Fixed reference "now" so tests are deterministic.
const NOW = new Date("2026-07-05T00:00:00.000Z");
const { members, events, org } = buildDemoDataset(NOW);

describe("RFM", () => {
  const scores = computeRfm(members, events, NOW);
  const byId = new Map(scores.map((s) => [s.memberId, s]));

  it("labels the champion correctly (recent, frequent, high spend)", () => {
    expect(byId.get("U_champion_001")?.segment).toBe("Champion");
  });

  it("labels a brand-new member with no purchases as New", () => {
    const kenji = byId.get("U_new_003");
    expect(kenji?.frequency).toBe(0);
    expect(kenji?.segment).toBe("New");
  });

  it("labels a lapsed multi-purchaser as At-Risk", () => {
    expect(byId.get("U_atrisk_004")?.segment).toBe("At-Risk");
  });

  it("labels a long-inactive member as Dormant", () => {
    expect(byId.get("U_dormant_005")?.segment).toBe("Dormant");
  });

  it("monetary equals the sum of purchase amounts", () => {
    expect(byId.get("U_champion_001")?.monetary).toBe(15192 + 5120 + 17600);
  });

  it("segmentCounts sums to member total", () => {
    const counts = segmentCounts(scores);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(members.length);
  });
});

describe("overviewStats", () => {
  const stats = overviewStats(members, events, {
    now: NOW,
    churnDays: org.churnDays,
    currency: org.currency,
  });

  it("counts all members", () => {
    expect(stats.totalMembers).toBe(5);
  });

  it("flags members past the churn window as at-risk", () => {
    // Suresh (120d) and Nurul (260d) are beyond churnDays=90
    expect(stats.atRiskMembers).toBe(2);
  });

  it("sums revenue from PURCHASE events", () => {
    const expected = 15192 + 5120 + 17600 + 3600 + 6240 + 2560 + 12000 + 1680;
    expect(stats.revenue).toBe(expected);
  });
});

describe("acquisitionFunnel", () => {
  const funnel = acquisitionFunnel(events);

  it("has all 4 members registered", () => {
    const registered = funnel.find((s) => s.stage === "Registered");
    expect(registered?.members).toBe(5);
  });

  it("counts members who purchased (4 of 5)", () => {
    const purchased = funnel.find((s) => s.stage === "Purchased");
    expect(purchased?.members).toBe(4);
  });

  it("counts repeat buyers (3 of 5 have 2+ purchases)", () => {
    const repeat = funnel.find((s) => s.stage === "Repeat");
    expect(repeat?.members).toBe(3);
  });
});
