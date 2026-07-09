import type { EventLike, MemberLike, RfmSegment } from "./types";
import { computeRfm } from "./rfm";
import { productAffinity } from "./affinity";

const DAY = 24 * 60 * 60 * 1000;

// A worst→best ladder for RFM segments, used to decide whether a member moved
// up or down between two snapshots. "New" sits mid-ladder: better than churned
// buckets, below an engaged Loyal/Champion.
const SEGMENT_RANK: Record<RfmSegment, number> = {
  Dormant: 0,
  "At-Risk": 1,
  Regular: 2,
  New: 3,
  Potential: 4,
  Loyal: 5,
  Champion: 6,
};

// ────────────────────────────────────────────────────────────────────────────
// 1. Segment migration — how members moved between RFM segments over a window.
// ────────────────────────────────────────────────────────────────────────────

export interface MigrationRow {
  memberId: string;
  displayName: string | null;
  from: RfmSegment | "entry"; // "entry" = joined during the window
  to: RfmSegment;
  direction: "up" | "down" | "same" | "entry";
}

export interface SegmentDelta {
  segment: RfmSegment;
  before: number;
  after: number;
  delta: number;
}

export interface MigrationReport {
  windowDays: number;
  upgraders: MigrationRow[];
  downgraders: MigrationRow[];
  perSegment: SegmentDelta[];
  upCount: number;
  downCount: number;
  entryCount: number;
}

/**
 * Compares each member's RFM segment now vs `windowDays` ago (computed by
 * replaying only the events up to that date), so the dashboard can show
 * movement — who climbed, who slipped — not just a static snapshot. This is
 * what `RfmSnapshot` is designed to persist nightly; here we derive it live.
 */
export function segmentMigration(
  members: MemberLike[],
  events: EventLike[],
  now: Date,
  windowDays = 30,
): MigrationReport {
  const asOf = new Date(now.getTime() - windowDays * DAY);

  // Past snapshot: only members who existed then, replaying past events only.
  const pastMembers = members.filter((m) => m.createdAt <= asOf);
  const pastEvents = events.filter((e) => e.occurredAt <= asOf);
  const beforeScores = computeRfm(pastMembers, pastEvents, asOf);
  const beforeSeg = new Map(beforeScores.map((s) => [s.memberId, s.segment]));

  const nowScores = computeRfm(members, events, now);

  const rows: MigrationRow[] = nowScores.map((s) => {
    const from = beforeSeg.get(s.memberId);
    if (!from) {
      return { memberId: s.memberId, displayName: s.displayName, from: "entry" as const, to: s.segment, direction: "entry" as const };
    }
    const diff = SEGMENT_RANK[s.segment] - SEGMENT_RANK[from];
    const direction = diff > 0 ? "up" : diff < 0 ? "down" : "same";
    return { memberId: s.memberId, displayName: s.displayName, from, to: s.segment, direction };
  });

  const before = new Map<RfmSegment, number>();
  const after = new Map<RfmSegment, number>();
  for (const s of beforeScores) before.set(s.segment, (before.get(s.segment) ?? 0) + 1);
  for (const s of nowScores) after.set(s.segment, (after.get(s.segment) ?? 0) + 1);
  const segs = Object.keys(SEGMENT_RANK) as RfmSegment[];
  const perSegment: SegmentDelta[] = segs.map((segment) => {
    const b = before.get(segment) ?? 0;
    const a = after.get(segment) ?? 0;
    return { segment, before: b, after: a, delta: a - b };
  });

  const upgraders = rows
    .filter((r) => r.direction === "up")
    .sort((a, b) => SEGMENT_RANK[b.to] - SEGMENT_RANK[a.to]);
  const downgraders = rows
    .filter((r) => r.direction === "down")
    .sort((a, b) => SEGMENT_RANK[a.to] - SEGMENT_RANK[b.to]);

  return {
    windowDays,
    upgraders,
    downgraders,
    perSegment,
    upCount: upgraders.length,
    downCount: downgraders.length,
    entryCount: rows.filter((r) => r.direction === "entry").length,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Movers & shakers — biggest spend swings recent-window vs prior-window.
// ────────────────────────────────────────────────────────────────────────────

export interface MoverRow {
  memberId: string;
  displayName: string | null;
  recent: number; // spend in the most recent window
  prior: number; // spend in the window before that
  delta: number; // recent − prior
}

export interface MoversReport {
  windowDays: number;
  climbers: MoverRow[];
  fallers: MoverRow[];
}

/**
 * Ranks members by how much their spend changed between the last `windowDays`
 * and the `windowDays` before that — surfacing accounts heating up (upsell) or
 * cooling down (save) so the team focuses on movement, not just totals.
 */
export function topMovers(
  members: MemberLike[],
  events: EventLike[],
  now: Date,
  windowDays = 90,
  n = 10,
): MoversReport {
  const recentStart = now.getTime() - windowDays * DAY;
  const priorStart = now.getTime() - 2 * windowDays * DAY;

  const recent = new Map<string, number>();
  const prior = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "PURCHASE") continue;
    const amt = e.payload?.amount ?? 0;
    const t = e.occurredAt.getTime();
    if (t >= recentStart) recent.set(e.memberId, (recent.get(e.memberId) ?? 0) + amt);
    else if (t >= priorStart) prior.set(e.memberId, (prior.get(e.memberId) ?? 0) + amt);
  }

  const nameOf = new Map(members.map((m) => [m.id, m.displayName]));
  const ids = new Set([...recent.keys(), ...prior.keys()]);
  const rows: MoverRow[] = [...ids].map((id) => {
    const r = recent.get(id) ?? 0;
    const p = prior.get(id) ?? 0;
    return { memberId: id, displayName: nameOf.get(id) ?? null, recent: r, prior: p, delta: r - p };
  });

  const climbers = rows.filter((r) => r.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, n);
  const fallers = rows.filter((r) => r.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, n);
  return { windowDays, climbers, fallers };
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Next-best-action — per member, the highest-lift category they haven't
//    bought yet, given a category they already own (market-basket driven).
// ────────────────────────────────────────────────────────────────────────────

export interface NextBestAction {
  memberId: string;
  displayName: string | null;
  owns: string[]; // categories the member has bought
  recommend: string; // category to cross-sell next
  because: string; // category that anchors the recommendation
  lift: number; // affinity lift of because→recommend
  spend: number; // member's historical spend (prioritisation)
}

/**
 * Turns market-basket affinity into a per-member recommendation: for each
 * member we find the category pair (a,b) with the strongest lift where they own
 * `a` but not `b`, and recommend `b`. Sorted by lift × spend so the team works
 * the highest-value, highest-confidence opportunities first.
 */
export function nextBestActions(
  members: MemberLike[],
  events: EventLike[],
  n = 10,
  minLift = 1.1,
): NextBestAction[] {
  const affinity = productAffinity(events);
  const strongPairs = affinity.pairs.filter((p) => p.lift >= minLift);
  if (strongPairs.length === 0) return [];

  // categories & spend per member
  const owns = new Map<string, Set<string>>();
  const spend = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "PURCHASE") continue;
    spend.set(e.memberId, (spend.get(e.memberId) ?? 0) + (e.payload?.amount ?? 0));
    const set = owns.get(e.memberId) ?? new Set<string>();
    for (const it of e.payload?.items ?? []) set.add(it.category);
    owns.set(e.memberId, set);
  }

  const nameOf = new Map(members.map((m) => [m.id, m.displayName]));
  const out: NextBestAction[] = [];
  for (const [memberId, cats] of owns) {
    let best: { recommend: string; because: string; lift: number } | null = null;
    for (const p of strongPairs) {
      // consider both directions of the undirected pair
      const cands: Array<[string, string]> = [
        [p.a, p.b],
        [p.b, p.a],
      ];
      for (const [have, want] of cands) {
        if (cats.has(have) && !cats.has(want)) {
          if (!best || p.lift > best.lift) best = { recommend: want, because: have, lift: p.lift };
        }
      }
    }
    if (best) {
      out.push({
        memberId,
        displayName: nameOf.get(memberId) ?? null,
        owns: [...cats],
        recommend: best.recommend,
        because: best.because,
        lift: best.lift,
        spend: spend.get(memberId) ?? 0,
      });
    }
  }

  return out
    .sort((a, b) => b.lift * b.spend - a.lift * a.spend)
    .slice(0, n);
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Wallet share — category penetration & how many categories each member buys
//    (single-category buyers are the biggest cross-sell pool).
// ────────────────────────────────────────────────────────────────────────────

export interface CategoryShare {
  category: string;
  buyers: number;
  penetration: number; // buyers / totalBuyers
  revenue: number;
}

export interface WalletShareReport {
  totalBuyers: number;
  categories: CategoryShare[];
  coverage: Array<{ categories: number; members: number }>; // histogram: #cats → #members
  singleCategoryBuyers: number;
  avgCategories: number;
}

/**
 * Measures how deep each customer's wallet reaches across product categories.
 * Members who only ever buy one category are the highest-leverage cross-sell
 * pool — the report exposes that count plus per-category penetration & revenue.
 */
export function walletShare(events: EventLike[]): WalletShareReport {
  const catsByMember = new Map<string, Set<string>>();
  const buyers = new Map<string, number>();
  const revenue = new Map<string, number>();

  for (const e of events) {
    if (e.type !== "PURCHASE") continue;
    const set = catsByMember.get(e.memberId) ?? new Set<string>();
    for (const it of e.payload?.items ?? []) {
      set.add(it.category);
      revenue.set(it.category, (revenue.get(it.category) ?? 0) + it.qty * it.unitPrice);
    }
    catsByMember.set(e.memberId, set);
  }

  const totalBuyers = catsByMember.size;
  for (const cats of catsByMember.values()) {
    for (const c of cats) buyers.set(c, (buyers.get(c) ?? 0) + 1);
  }

  const categories: CategoryShare[] = [...buyers.keys()]
    .map((category) => ({
      category,
      buyers: buyers.get(category) ?? 0,
      penetration: totalBuyers > 0 ? (buyers.get(category) ?? 0) / totalBuyers : 0,
      revenue: revenue.get(category) ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const histo = new Map<number, number>();
  let totalCats = 0;
  for (const cats of catsByMember.values()) {
    histo.set(cats.size, (histo.get(cats.size) ?? 0) + 1);
    totalCats += cats.size;
  }
  const coverage = [...histo.entries()]
    .map(([categories, membersN]) => ({ categories, members: membersN }))
    .sort((a, b) => a.categories - b.categories);

  return {
    totalBuyers,
    categories,
    coverage,
    singleCategoryBuyers: histo.get(1) ?? 0,
    avgCategories: totalBuyers > 0 ? totalCats / totalBuyers : 0,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Repeat-purchase survival (Kaplan-Meier) — of customers who bought once,
//    what share have NOT yet bought again by day t. Median = activation speed.
// ────────────────────────────────────────────────────────────────────────────

export interface SurvivalPoint {
  day: number;
  survival: number; // share still on their first purchase (not yet repeated)
}

export interface SurvivalReport {
  points: SurvivalPoint[];
  medianDays: number | null; // day survival first drops to ≤ 0.5 (null if never)
  repeatRate: number; // share of one-time buyers who eventually repeated
  sampleSize: number;
}

/**
 * Kaplan-Meier estimate of time-to-second-purchase. Each member with ≥1 order
 * contributes either an event (days from 1st→2nd order) or a right-censored
 * observation (days from 1st order → now, if never repeated). The survival
 * curve answers "how fast do first-time buyers come back?" — the key
 * activation metric for a pro shop.
 */
export function repeatSurvival(
  members: MemberLike[],
  events: EventLike[],
  now: Date,
  maxDay = 180,
): SurvivalReport {
  const firsts = new Map<string, Date>();
  const seconds = new Map<string, Date>();
  const purchasesByMember = new Map<string, Date[]>();
  for (const e of events) {
    if (e.type !== "PURCHASE") continue;
    const list = purchasesByMember.get(e.memberId) ?? [];
    list.push(e.occurredAt);
    purchasesByMember.set(e.memberId, list);
  }
  for (const [id, dates] of purchasesByMember) {
    const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
    firsts.set(id, sorted[0]!);
    if (sorted.length >= 2) seconds.set(id, sorted[1]!);
  }

  // Build (time, event) observations.
  const obs: Array<{ time: number; event: boolean }> = [];
  let repeated = 0;
  for (const [id, first] of firsts) {
    const second = seconds.get(id);
    if (second) {
      // Floor a repeat at day 1 so the curve starts at S(0)=1 (a same-day
      // second order still counts as "came back", just on day one).
      obs.push({ time: Math.max(1, Math.round((second.getTime() - first.getTime()) / DAY)), event: true });
      repeated += 1;
    } else {
      obs.push({ time: Math.max(0, Math.round((now.getTime() - first.getTime()) / DAY)), event: false });
    }
  }

  const sampleSize = obs.length;
  // Kaplan-Meier: iterate distinct event times ascending.
  const eventTimes = [...new Set(obs.filter((o) => o.event).map((o) => o.time))].sort((a, b) => a - b);
  let survival = 1;
  const stepAt = new Map<number, number>();
  for (const t of eventTimes) {
    const atRisk = obs.filter((o) => o.time >= t).length;
    const deaths = obs.filter((o) => o.event && o.time === t).length;
    if (atRisk > 0) survival *= 1 - deaths / atRisk;
    stepAt.set(t, survival);
  }

  // Sample the step function onto 0..maxDay for a smooth chart.
  const points: SurvivalPoint[] = [];
  let cur = 1;
  let medianDays: number | null = null;
  for (let d = 0; d <= maxDay; d++) {
    if (stepAt.has(d)) cur = stepAt.get(d)!;
    if (medianDays === null && cur <= 0.5) medianDays = d;
    points.push({ day: d, survival: cur });
  }

  return {
    points,
    medianDays,
    repeatRate: sampleSize > 0 ? repeated / sampleSize : 0,
    sampleSize,
  };
}
