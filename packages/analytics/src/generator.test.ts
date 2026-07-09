import { describe, expect, it } from "vitest";
import { generateDataset } from "./generator";
import { computeRfm, segmentCounts } from "./rfm";
import { computeClv } from "./clv";
import { computeChurn } from "./churn";
import { productAffinity } from "./affinity";

const NOW = new Date("2026-07-05T00:00:00.000Z");

describe("synthetic generator", () => {
  it("is deterministic (same seed → same output)", () => {
    const a = generateDataset(NOW);
    const b = generateDataset(NOW);
    expect(a.members.length).toBe(b.members.length);
    expect(a.members[0]?.id).toBe(b.members[0]?.id);
    expect(a.events.length).toBe(b.events.length);
  });

  it("produces ~1,240 members", () => {
    const { members } = generateDataset(NOW);
    expect(members.length).toBeGreaterThan(1150);
    expect(members.length).toBeLessThan(1350);
  });

  it("spans a realistic RFM spread (all segments populated)", () => {
    const { members, events } = generateDataset(NOW);
    const counts = segmentCounts(computeRfm(members, events, NOW));
    // With 1,200+ members every major segment should have members.
    expect(counts.Champion).toBeGreaterThan(0);
    expect(counts["At-Risk"] + counts.Dormant).toBeGreaterThan(100);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(members.length);
  });

  it("has enough purchase baskets for affinity", () => {
    const { events } = generateDataset(NOW);
    const affinity = productAffinity(events);
    expect(affinity.totalBaskets).toBeGreaterThan(200);
    expect(affinity.pairs.length).toBeGreaterThan(0);
  });

  it("CLV and churn compute across the whole base", () => {
    const { members, events, org } = generateDataset(NOW);
    const clv = computeClv(members, events, NOW);
    const churn = computeChurn(members, events, NOW, { churnDays: org.churnDays });
    expect(clv.length).toBe(members.length);
    expect(churn.length).toBe(members.length);
    expect(churn.some((c) => c.probability >= 0.7)).toBe(true);
  });
});
