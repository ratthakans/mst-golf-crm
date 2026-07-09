import type { EventLike, MemberLike } from "./types";

const DAY = 24 * 60 * 60 * 1000;

export type ChurnStatus = "active" | "cooling" | "at_risk" | "churned";

export interface ChurnResult {
  memberId: string;
  displayName: string | null;
  recencyDays: number;
  probability: number; // 0..1 likelihood the member has churned
  status: ChurnStatus;
}

/**
 * Recency-based churn scoring. Probability follows a logistic curve centred on
 * the org's churn window: at `churnDays` of inactivity p≈0.5, rising as the gap
 * widens. `status` buckets it for quick triage / win-back targeting.
 */
export function computeChurn(
  members: MemberLike[],
  events: EventLike[],
  now: Date,
  opts: { churnDays: number; steepness?: number },
): ChurnResult[] {
  const { churnDays } = opts;
  const k = opts.steepness ?? 4;

  const lastActivity = new Map<string, Date>();
  for (const e of events) {
    const prev = lastActivity.get(e.memberId);
    if (!prev || e.occurredAt > prev) lastActivity.set(e.memberId, e.occurredAt);
  }

  return members.map((member) => {
    const ref =
      lastActivity.get(member.id) ?? member.lastSeenAt ?? member.createdAt;
    const recencyDays = Math.max(0, Math.floor((now.getTime() - ref.getTime()) / DAY));

    const ratio = recencyDays / Math.max(1, churnDays);
    const probability = 1 / (1 + Math.exp(-k * (ratio - 1)));

    let status: ChurnStatus;
    if (recencyDays < churnDays * 0.5) status = "active";
    else if (recencyDays < churnDays) status = "cooling";
    else if (recencyDays < churnDays * 2) status = "at_risk";
    else status = "churned";

    return {
      memberId: member.id,
      displayName: member.displayName,
      recencyDays,
      probability,
      status,
    };
  });
}
