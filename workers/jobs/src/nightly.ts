import { prisma, forOrg } from "@mstgolf/database";
import type { OrgSettings } from "@mstgolf/shared";
import { isMonthlyTierReview, resolveTiers, reviewTier, tierRank } from "@mstgolf/shared/tiers";
import {
  buildProfiles,
  computeChurn,
  computeClv,
  computeRfm,
  DEFAULT_AUTOMATIONS,
  eligibleMembers,
  spendByMember,
  type EventLike,
  type EventTypeName,
  type MemberLike,
} from "@mstgolf/analytics";

export interface NightlySummary {
  orgSlug: string;
  members: number;
  snapshotsWritten: number;
  tierChanges: { up: number; down: number };
  automationHits: Record<string, number>;
}

/**
 * Nightly analytics refresh for one org. Recomputes RFM / CLV / churn from the
 * event log (reusing the SAME pure functions the dashboard uses), persists a
 * per-member RfmSnapshot for trend & segment-migration analysis, then evaluates
 * each automation and reports its audience. A real deployment would enqueue the
 * resulting messages/coupons here.
 *
 * Tiers are reviewed against 12-month spend: upgrades apply every night,
 * downgrades only on the 1st of the month (org timezone).
 */
export async function runNightlyAnalytics(orgSlug: string): Promise<NightlySummary> {
  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) throw new Error(`Organization '${orgSlug}' not found`);
  const settings = org.settings as unknown as OrgSettings;
  const client = forOrg(org.id);
  const now = new Date();
  const snapshotDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const memberRows = await client.member.findMany();
  const eventRows = await client.event.findMany();

  const members: MemberLike[] = memberRows.map((m) => ({
    id: m.id,
    displayName: m.displayName,
    tier: m.tier,
    points: m.points,
    lastSeenAt: m.lastSeenAt,
    createdAt: m.createdAt,
    phone: m.phone,
    email: m.email,
    attributes: (m.attributes as Record<string, unknown>) ?? {},
  }));
  const events: EventLike[] = eventRows.map((e) => ({
    memberId: e.memberId,
    type: e.type as EventTypeName,
    occurredAt: e.occurredAt,
    payload: (e.payload as EventLike["payload"]) ?? {},
  }));

  const rfm = computeRfm(members, events, now);
  const clv = computeClv(members, events, now);
  const churn = computeChurn(members, events, now, { churnDays: settings.crm.churnDays });
  const clvById = new Map(clv.map((c) => [c.memberId, c]));
  const churnById = new Map(churn.map((c) => [c.memberId, c]));

  let snapshotsWritten = 0;
  for (const r of rfm) {
    await client.rfmSnapshot.upsert({
      where: {
        orgId_memberId_snapshotDate: {
          orgId: org.id,
          memberId: r.memberId,
          snapshotDate,
        },
      },
      update: {
        r: r.r, f: r.f, m: r.m, segment: r.segment, monetary: Math.round(r.monetary),
        clv: Math.round(clvById.get(r.memberId)?.predictedLifetime ?? 0),
        churnProbability: churnById.get(r.memberId)?.probability ?? 0,
      },
      create: {
        orgId: org.id,
        memberId: r.memberId,
        snapshotDate,
        r: r.r, f: r.f, m: r.m, segment: r.segment, monetary: Math.round(r.monetary),
        clv: Math.round(clvById.get(r.memberId)?.predictedLifetime ?? 0),
        churnProbability: churnById.get(r.memberId)?.probability ?? 0,
      },
    });
    snapshotsWritten += 1;
  }

  const tiers = resolveTiers(settings.tiers);
  const spend12m = spendByMember(events, now);
  const allowDowngrade = isMonthlyTierReview(now, settings.timezone);
  const tierChanges = { up: 0, down: 0 };
  for (const m of members) {
    const next = reviewTier(m.tier, spend12m.get(m.id) ?? 0, tiers, { allowDowngrade });
    if (next.name === m.tier) continue;
    const from = tierRank(m.tier, tiers);
    const up = tierRank(next.name, tiers) > from;
    await client.member.update({ where: { id: m.id }, data: { tier: next.name } });
    if (up && from >= 0) {
      await client.event.create({
        data: { orgId: org.id, memberId: m.id, type: "TIER_UP", payload: { from: m.tier, to: next.name } },
      });
    }
    if (up) tierChanges.up += 1;
    else tierChanges.down += 1;
    m.tier = next.name;
  }

  const profiles = buildProfiles(members, rfm, clv, churn, { spend12m, tiers });
  const automationHits: Record<string, number> = {};
  for (const a of DEFAULT_AUTOMATIONS) {
    if (!a.enabled) continue;
    const audience = eligibleMembers(profiles, a.trigger);
    automationHits[a.name] = audience.length;
    // TODO: enqueue a.action for each audience member (message/coupon/points).
  }

  return {
    orgSlug,
    members: members.length,
    snapshotsWritten,
    tierChanges,
    automationHits,
  };
}
