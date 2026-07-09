import { describe, expect, it } from "vitest";
import { generateDataset } from "./generator";
import {
  segmentMigration,
  topMovers,
  nextBestActions,
  walletShare,
  repeatSurvival,
} from "./insights";

const NOW = new Date("2026-07-05T00:00:00.000Z");
const DATA = generateDataset(NOW);

describe("segmentMigration", () => {
  it("classifies every current member as up/down/same/entry", () => {
    const rep = segmentMigration(DATA.members, DATA.events, NOW, 45);
    const total = rep.upCount + rep.downCount + rep.entryCount;
    expect(rep.perSegment.length).toBe(7);
    // Movement happens in a base this size.
    expect(rep.upCount + rep.downCount).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(DATA.members.length);
  });

  it("perSegment before/after sum to plausible totals", () => {
    const rep = segmentMigration(DATA.members, DATA.events, NOW, 45);
    const after = rep.perSegment.reduce((s, p) => s + p.after, 0);
    expect(after).toBe(DATA.members.length);
  });

  it("upgraders actually moved to a better segment", () => {
    const rep = segmentMigration(DATA.members, DATA.events, NOW, 60);
    for (const u of rep.upgraders.slice(0, 20)) {
      expect(u.direction).toBe("up");
      expect(u.from).not.toBe("entry");
    }
  });
});

describe("topMovers", () => {
  it("returns climbers with positive delta and fallers with negative", () => {
    const rep = topMovers(DATA.members, DATA.events, NOW, 90, 10);
    expect(rep.climbers.length).toBeGreaterThan(0);
    expect(rep.climbers.every((r) => r.delta > 0)).toBe(true);
    expect(rep.fallers.every((r) => r.delta < 0)).toBe(true);
    // climbers sorted descending by delta
    const deltas = rep.climbers.map((r) => r.delta);
    expect([...deltas].sort((a, b) => b - a)).toEqual(deltas);
  });
});

describe("nextBestActions", () => {
  it("recommends a category the member does not already own", () => {
    const nba = nextBestActions(DATA.members, DATA.events, 15);
    expect(nba.length).toBeGreaterThan(0);
    for (const a of nba) {
      expect(a.owns).toContain(a.because);
      expect(a.owns).not.toContain(a.recommend);
      expect(a.lift).toBeGreaterThanOrEqual(1.1);
    }
  });
});

describe("walletShare", () => {
  it("computes penetration and a coverage histogram", () => {
    const w = walletShare(DATA.events);
    expect(w.totalBuyers).toBeGreaterThan(100);
    expect(w.categories.length).toBeGreaterThan(0);
    for (const c of w.categories) {
      expect(c.penetration).toBeGreaterThanOrEqual(0);
      expect(c.penetration).toBeLessThanOrEqual(1);
    }
    const histoSum = w.coverage.reduce((s, c) => s + c.members, 0);
    expect(histoSum).toBe(w.totalBuyers);
    expect(w.avgCategories).toBeGreaterThan(0);
  });
});

describe("repeatSurvival", () => {
  it("produces a monotonically non-increasing survival curve", () => {
    const s = repeatSurvival(DATA.members, DATA.events, NOW, 180);
    expect(s.points.length).toBe(181);
    expect(s.points[0]!.survival).toBe(1);
    for (let i = 1; i < s.points.length; i++) {
      expect(s.points[i]!.survival).toBeLessThanOrEqual(s.points[i - 1]!.survival);
    }
    expect(s.repeatRate).toBeGreaterThan(0);
    expect(s.repeatRate).toBeLessThanOrEqual(1);
    expect(s.sampleSize).toBeGreaterThan(0);
  });
});
