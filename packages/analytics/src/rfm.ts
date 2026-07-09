import type { EventLike, MemberLike, RfmScore, RfmSegment } from "./types";
import { quintileScore } from "./stats-core";

const DAY = 24 * 60 * 60 * 1000;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY);
}

// Fixed-threshold scoring (1..5) — used when the population is too small for
// stable quantiles (< 20 members).
function recencyThreshold(days: number): number {
  if (days <= 7) return 5;
  if (days <= 30) return 4;
  if (days <= 60) return 3;
  if (days <= 90) return 2;
  return 1;
}
function frequencyThreshold(count: number): number {
  if (count >= 5) return 5;
  if (count >= 3) return 4;
  if (count >= 2) return 3;
  if (count >= 1) return 2;
  return 1;
}
function monetaryThreshold(amount: number): number {
  if (amount >= 3000) return 5;
  if (amount >= 1500) return 4;
  if (amount >= 700) return 3;
  if (amount >= 1) return 2;
  return 1;
}

export function segmentFor(
  r: number,
  f: number,
  m: number,
  frequency: number,
): RfmSegment {
  if (r >= 4 && f >= 4 && m >= 4) return "Champion";
  if (r >= 3 && f >= 3) return "Loyal";
  if (r >= 4 && frequency <= 1) return "New";
  if (r <= 2 && f >= 3) return "At-Risk";
  if (r <= 1) return "Dormant";
  if (r >= 3 && m >= 3) return "Potential";
  return "Regular";
}

interface RawRfm {
  member: MemberLike;
  recencyDays: number;
  frequency: number;
  monetary: number;
}

export type RfmMethod = "auto" | "quantile" | "threshold";

const QUANTILE_MIN_N = 20;

/**
 * Computes RFM scores. With enough members it scores each dimension by its
 * position in the population's distribution (quintiles) — the statistically
 * correct approach. Below QUANTILE_MIN_N it falls back to fixed thresholds so
 * scores stay stable for tiny tenants.
 */
export function computeRfm(
  members: MemberLike[],
  events: EventLike[],
  now: Date,
  method: RfmMethod = "auto",
): RfmScore[] {
  const purchasesByMember = new Map<string, EventLike[]>();
  for (const e of events) {
    if (e.type !== "PURCHASE") continue;
    const list = purchasesByMember.get(e.memberId) ?? [];
    list.push(e);
    purchasesByMember.set(e.memberId, list);
  }

  const raw: RawRfm[] = members.map((member) => {
    const purchases = purchasesByMember.get(member.id) ?? [];
    const frequency = purchases.length;
    const monetary = purchases.reduce((s, p) => s + (p.payload?.amount ?? 0), 0);
    const lastPurchaseAt = purchases.reduce<Date | null>(
      (latest, p) => (!latest || p.occurredAt > latest ? p.occurredAt : latest),
      null,
    );
    const recencyRef = lastPurchaseAt ?? member.lastSeenAt ?? member.createdAt;
    const recencyDays = Math.max(0, daysBetween(now, recencyRef));
    return { member, recencyDays, frequency, monetary };
  });

  const useQuantile =
    method === "quantile" ||
    (method === "auto" && members.length >= QUANTILE_MIN_N);

  const recPop = raw.map((x) => x.recencyDays);
  const freqPop = raw.map((x) => x.frequency);
  const monPop = raw.map((x) => x.monetary);

  return raw.map(({ member, recencyDays, frequency, monetary }) => {
    const r = useQuantile
      ? quintileScore(recPop, recencyDays, false)
      : recencyThreshold(recencyDays);
    const f = useQuantile
      ? quintileScore(freqPop, frequency, true)
      : frequencyThreshold(frequency);
    const m = useQuantile
      ? quintileScore(monPop, monetary, true)
      : monetaryThreshold(monetary);

    return {
      memberId: member.id,
      displayName: member.displayName,
      recencyDays,
      frequency,
      monetary,
      r,
      f,
      m,
      segment: segmentFor(r, f, m, frequency),
    };
  });
}

export function segmentCounts(scores: RfmScore[]): Record<RfmSegment, number> {
  const counts: Record<RfmSegment, number> = {
    Champion: 0,
    Loyal: 0,
    Potential: 0,
    New: 0,
    "At-Risk": 0,
    Dormant: 0,
    Regular: 0,
  };
  for (const s of scores) counts[s.segment] += 1;
  return counts;
}
