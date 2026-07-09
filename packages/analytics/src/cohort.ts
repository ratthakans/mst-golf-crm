import type { EventLike, MemberLike } from "./types";

export interface CohortRow {
  cohort: string; // signup month "YYYY-MM"
  label: string;
  size: number;
  retention: Array<number | null>; // retention[k] = fraction active k months after signup
}

export interface CohortReport {
  months: number; // number of "months since signup" columns
  rows: CohortRow[];
}

function monthIndex(d: Date): number {
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/**
 * Cohort retention: group members by signup month, then measure the fraction of
 * each cohort that had ANY activity (PURCHASE or VISIT) k months later.
 * Cells past "now" are null (not yet observable).
 */
export function cohortRetention(
  members: MemberLike[],
  events: EventLike[],
  now: Date,
  monthsTracked = 6,
): CohortReport {
  const nowIdx = monthIndex(now);
  const activityByMember = new Map<string, Set<number>>();
  for (const e of events) {
    if (e.type !== "PURCHASE" && e.type !== "VISIT") continue;
    const set = activityByMember.get(e.memberId) ?? new Set<number>();
    set.add(monthIndex(e.occurredAt));
    activityByMember.set(e.memberId, set);
  }

  const cohorts = new Map<number, MemberLike[]>();
  for (const m of members) {
    const idx = monthIndex(m.createdAt);
    const list = cohorts.get(idx) ?? [];
    list.push(m);
    cohorts.set(idx, list);
  }

  const rows: CohortRow[] = [...cohorts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([cohortIdx, cohortMembers]) => {
      const retention: Array<number | null> = [];
      for (let k = 0; k < monthsTracked; k++) {
        const targetMonth = cohortIdx + k;
        if (targetMonth > nowIdx) {
          retention.push(null);
          continue;
        }
        const activeCount = cohortMembers.filter((m) =>
          activityByMember.get(m.id)?.has(targetMonth),
        ).length;
        retention.push(activeCount / cohortMembers.length);
      }
      const monthNum = ((cohortIdx % 12) + 12) % 12;
      const year = Math.floor(cohortIdx / 12);
      return {
        cohort: `${year}-${String(monthNum + 1).padStart(2, "0")}`,
        label: `${MONTHS[monthNum]} ${year}`,
        size: cohortMembers.length,
        retention,
      };
    });

  return { months: monthsTracked, rows };
}
