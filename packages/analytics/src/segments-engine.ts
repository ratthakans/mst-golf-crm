import type { MemberLike, RfmScore, RfmSegment } from "./types";
import type { ClvResult } from "./clv";
import type { ChurnResult } from "./churn";

// A flattened view of a member + all computed metrics, so segment rules can
// reference behavioural and statistical fields uniformly.
export interface MemberProfile {
  memberId: string;
  displayName: string | null;
  tier: string | null;
  points: number;
  recencyDays: number;
  frequency: number;
  monetary: number;
  rfmSegment: RfmSegment;
  clv: number; // predicted lifetime value
  churnProbability: number;
  attributes: Record<string, unknown>;
}

export function buildProfiles(
  members: MemberLike[],
  rfm: RfmScore[],
  clv: ClvResult[],
  churn: ChurnResult[],
): MemberProfile[] {
  const rfmById = new Map(rfm.map((r) => [r.memberId, r]));
  const clvById = new Map(clv.map((c) => [c.memberId, c]));
  const churnById = new Map(churn.map((c) => [c.memberId, c]));
  return members.map((m) => {
    const r = rfmById.get(m.id);
    return {
      memberId: m.id,
      displayName: m.displayName,
      tier: m.tier,
      points: m.points,
      recencyDays: r?.recencyDays ?? 0,
      frequency: r?.frequency ?? 0,
      monetary: r?.monetary ?? 0,
      rfmSegment: r?.segment ?? "Regular",
      clv: clvById.get(m.id)?.predictedLifetime ?? 0,
      churnProbability: churnById.get(m.id)?.probability ?? 0,
      attributes: m.attributes ?? {},
    };
  });
}

export type Operator =
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";

export interface Condition {
  field: string; // MemberProfile key, or "attributes.<key>"
  op: Operator;
  value: unknown;
}

// Rule: all of `all` AND any of `any` must hold (either may be omitted).
export interface SegmentRule {
  all?: Condition[];
  any?: Condition[];
}

function resolveField(profile: MemberProfile, field: string): unknown {
  if (field.startsWith("attributes.")) {
    return profile.attributes[field.slice("attributes.".length)];
  }
  return (profile as unknown as Record<string, unknown>)[field];
}

export function evaluateCondition(profile: MemberProfile, c: Condition): boolean {
  const actual = resolveField(profile, c.field);
  switch (c.op) {
    case "eq": return actual === c.value;
    case "neq": return actual !== c.value;
    case "gt": return typeof actual === "number" && actual > (c.value as number);
    case "gte": return typeof actual === "number" && actual >= (c.value as number);
    case "lt": return typeof actual === "number" && actual < (c.value as number);
    case "lte": return typeof actual === "number" && actual <= (c.value as number);
    case "in": return Array.isArray(c.value) && c.value.includes(actual);
    case "contains":
      return Array.isArray(actual) && actual.includes(c.value);
    default: return false;
  }
}

export function matchesRule(profile: MemberProfile, rule: SegmentRule): boolean {
  const allOk = (rule.all ?? []).every((c) => evaluateCondition(profile, c));
  const anyOk =
    rule.any === undefined || rule.any.length === 0
      ? true
      : rule.any.some((c) => evaluateCondition(profile, c));
  return allOk && anyOk;
}

/** Resolve a dynamic segment rule to the matching members. */
export function resolveSegment(
  profiles: MemberProfile[],
  rule: SegmentRule,
): MemberProfile[] {
  return profiles.filter((p) => matchesRule(p, rule));
}
