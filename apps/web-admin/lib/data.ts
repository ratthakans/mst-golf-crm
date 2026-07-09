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
  nextBestActions,
  overviewStats,
  productAffinity,
  repeatSurvival,
  segmentCounts,
  segmentMigration,
  topMovers,
  walletShare,
  type Automation,
  type ChurnResult,
  type ClvResult,
  type DemoOrg,
  type MemberLike,
  type MemberProfile,
  type RfmScore,
} from "@mstgolf/analytics";
import { getRepo } from "./repo";

export interface AutomationView {
  automation: Automation;
  eligible: MemberProfile[];
}

export interface CrmData {
  source: "sample" | "database";
  org: DemoOrg;
  members: MemberLike[];
  events: Awaited<ReturnType<Awaited<ReturnType<typeof getRepo>>["listEvents"]>>;
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
  const repo = await getRepo();
  const now = new Date();
  const [org, members, events] = await Promise.all([
    repo.getOrg(),
    repo.listMembers(),
    repo.listEvents(),
  ]);

  const rfm = computeRfm(members, events, now);
  const clv = computeClv(members, events, now);
  const churn = computeChurn(members, events, now, { churnDays: org.churnDays });
  const profiles = buildProfiles(members, rfm, clv, churn);

  return {
    source: repo.source,
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

export interface InsightsData {
  org: DemoOrg;
  totalMembers: number;
  migration: ReturnType<typeof segmentMigration>;
  movers: ReturnType<typeof topMovers>;
  nba: ReturnType<typeof nextBestActions>;
  wallet: ReturnType<typeof walletShare>;
  survival: ReturnType<typeof repeatSurvival>;
  clvForecast: { total: number; top: { displayName: string | null; predictedAnnual: number; historical: number }[] };
}

/**
 * Heavier "signals & movement" analytics, computed only for the /insights page
 * so the rest of the dashboard stays fast. All derived from the same members +
 * events as everything else, so the numbers stay consistent across pages.
 */
export async function getInsightsData(): Promise<InsightsData> {
  const repo = await getRepo();
  const now = new Date();
  const [org, members, events] = await Promise.all([
    repo.getOrg(),
    repo.listMembers(),
    repo.listEvents(),
  ]);

  const clv = computeClv(members, events, now);
  const forecastTotal = clv.reduce((s, c) => s + c.predictedAnnual, 0);
  const top = [...clv]
    .sort((a, b) => b.predictedAnnual - a.predictedAnnual)
    .slice(0, 8)
    .map((c) => ({ displayName: c.displayName, predictedAnnual: c.predictedAnnual, historical: c.historical }));

  return {
    org,
    totalMembers: members.length,
    migration: segmentMigration(members, events, now, 30),
    movers: topMovers(members, events, now, 90, 8),
    nba: nextBestActions(members, events, 12),
    wallet: walletShare(events),
    survival: repeatSurvival(members, events, now, 180),
    clvForecast: { total: forecastTotal, top },
  };
}

export interface QuoteData {
  org: DemoOrg;
  totalMembers: number;
  atRiskCount: number; // members past the churn window (win-back pool)
  moneyAtRisk: number; // their combined 12-month projected value — revenue at stake
  avgAnnualValue: number; // per at-risk member
  projectedAnnual: number; // whole-base 12-month projected revenue
}

/**
 * Numbers for the in-app quotation / ROI page. Uses the SAME CLV + churn engine
 * as every other page, so the ROI a salesperson shows is the customer's real
 * data — not a made-up figure.
 */
export async function getQuoteData(): Promise<QuoteData> {
  const repo = await getRepo();
  const now = new Date();
  const [org, members, events] = await Promise.all([
    repo.getOrg(),
    repo.listMembers(),
    repo.listEvents(),
  ]);

  const clv = computeClv(members, events, now);
  const churn = computeChurn(members, events, now, { churnDays: org.churnDays });
  const clvById = new Map(clv.map((c) => [c.memberId, c]));

  const atRisk = churn.filter((c) => c.status === "at_risk" || c.status === "churned");
  const moneyAtRisk = atRisk.reduce((s, c) => s + (clvById.get(c.memberId)?.predictedAnnual ?? 0), 0);
  const projectedAnnual = clv.reduce((s, c) => s + c.predictedAnnual, 0);

  return {
    org,
    totalMembers: members.length,
    atRiskCount: atRisk.length,
    moneyAtRisk,
    avgAnnualValue: atRisk.length > 0 ? moneyAtRisk / atRisk.length : 0,
    projectedAnnual,
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
