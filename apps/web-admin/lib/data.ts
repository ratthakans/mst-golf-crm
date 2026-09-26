import {
  acquisitionFunnel,
  buildProfiles,
  cohortRetention,
  computeChurn,
  computeClv,
  computeRfm,
  DEFAULT_AUTOMATIONS,
  eligibleMembers,
  monthlySeries,
  overviewStats,
  productAffinity,
  segmentCounts,
  spendByMember,
  type Automation,
  type ChurnResult,
  type ClvResult,
  type DemoOrg,
  type MemberLike,
  type MemberProfile,
  type RfmScore,
  type EventLike,
} from "@mstgolf/analytics";
import { analyticsEvents, analyticsMembers, analyticsOrg } from "./analytics-source";

export interface AutomationView {
  automation: Automation;
  eligible: MemberProfile[];
}

export interface CrmData {
  org: DemoOrg;
  members: MemberLike[];
  events: EventLike[];
  stats: ReturnType<typeof overviewStats>;
  segments: ReturnType<typeof segmentCounts>;
  funnel: ReturnType<typeof acquisitionFunnel>;
  rfm: RfmScore[];
  clv: ClvResult[];
  churn: ChurnResult[];
  profiles: MemberProfile[];
  timeseries: ReturnType<typeof monthlySeries>;
  cohort: ReturnType<typeof cohortRetention>;
  affinity: ReturnType<typeof productAffinity>;
  automations: AutomationView[];
}

export async function getCrmData(): Promise<CrmData> {
  const now = new Date();
  const [org, members, events] = await Promise.all([analyticsOrg(), analyticsMembers(), analyticsEvents()]);

  const rfm = computeRfm(members, events, now);
  const clv = computeClv(members, events, now);
  const churn = computeChurn(members, events, now, { churnDays: org.churnDays });
  const profiles = buildProfiles(members, rfm, clv, churn, {
    spend12m: spendByMember(events, now),
    tiers: org.tiers,
  });

  return {
    org,
    members,
    events,
    stats: overviewStats(members, events, {
      now,
      churnDays: org.churnDays,
      currency: org.currency,
    }),
    segments: segmentCounts(rfm),
    funnel: acquisitionFunnel(events),
    rfm,
    clv,
    churn,
    profiles,
    // 7 months requested, current (partial) month dropped → 6 COMPLETE months,
    // so trend lines never end on a misleading half-month dip.
    timeseries: monthlySeries(members, events, now, 7).slice(0, -1),
    cohort: cohortRetention(members, events, now, 6),
    affinity: productAffinity(events),
    automations: DEFAULT_AUTOMATIONS.map((automation) => ({
      automation,
      eligible: eligibleMembers(profiles, automation.trigger),
    })),
  };
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-TH", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-TH").format(n);
}

export function formatPct(x: number, digits = 0): string {
  return `${(x * 100).toFixed(digits)}%`;
}
