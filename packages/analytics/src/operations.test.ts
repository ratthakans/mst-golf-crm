import { describe, expect, it } from "vitest";
import { generateDataset } from "./generator";
import {
  branchPerformance,
  channelMix,
  eventTypeCounts,
  hourDistribution,
  pointsEconomy,
  topProducts,
} from "./operations";

const NOW = new Date("2026-07-05T12:00:00.000Z");
const { members, events } = generateDataset(NOW);

describe("operations analytics", () => {
  it("channel mix covers store/online/arena and sums to purchase revenue", () => {
    const mix = channelMix(events);
    const channels = mix.map((c) => c.channel).sort();
    expect(channels).toContain("store");
    expect(channels).toContain("online");
    const totalRev = mix.reduce((s, c) => s + c.revenue, 0);
    const purchaseRev = events.filter((e) => e.type === "PURCHASE").reduce((s, e) => s + (e.payload?.amount ?? 0), 0);
    expect(totalRev).toBe(purchaseRev);
  });

  it("top products returns ranked SKUs", () => {
    const top = topProducts(events, 5);
    expect(top.length).toBeGreaterThan(0);
    expect(top.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < top.length; i++) expect(top[i - 1]!.revenue).toBeGreaterThanOrEqual(top[i]!.revenue);
  });

  it("branch performance splits across multiple branches", () => {
    const branches = branchPerformance(events);
    expect(branches.length).toBeGreaterThanOrEqual(3);
    expect(branches.every((b) => b.revenue >= 0)).toBe(true);
  });

  it("hour distribution is bounded to shop hours 8–21", () => {
    const hours = hourDistribution(events);
    expect(hours[0]?.hour).toBe(8);
    expect(hours[hours.length - 1]?.hour).toBe(21);
    expect(hours.reduce((s, h) => s + h.count, 0)).toBeGreaterThan(0);
  });

  it("points economy: earned > redeemed, rate between 0 and 1", () => {
    const pe = pointsEconomy(events, members.map((m) => m.points));
    expect(pe.earned).toBeGreaterThan(0);
    expect(pe.redeemed).toBeGreaterThan(0);
    expect(pe.redeemed).toBeLessThan(pe.earned);
    expect(pe.redemptionRate).toBeGreaterThan(0);
    expect(pe.redemptionRate).toBeLessThan(1);
  });

  it("event log now has many event types", () => {
    const types = eventTypeCounts(events).map((t) => t.type);
    expect(types).toContain("PURCHASE");
    expect(types).toContain("EARN_POINTS");
    expect(types).toContain("REDEEM_POINTS");
    expect(types).toContain("SCAN_QR");
    expect(types).toContain("OPEN_MENU");
    expect(types.length).toBeGreaterThanOrEqual(6);
  });
});
