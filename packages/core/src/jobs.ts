import { isMonthlyTierReview, lowestTier } from "@mstgolf/shared/tiers";
import { prisma } from "@mstgolf/database";
import { closeFinishedBookings, queueReminders } from "./booking";
import { SYSTEM } from "./context";
import { db, inTx } from "./db";
import { recordEvent } from "./events";
import { refreshMemberSpend } from "./members";
import { processEmails } from "./notify/email";
import { processOutbox, type OutboxRun } from "./notify/sender";
import { expireCoupons } from "./rewards";
import { queueBirthdays } from "./notify/inbox";
import { pruneOtpCodes } from "./otp";
import { pruneRateHits } from "./ratelimit";
import { ledgerDrift } from "./points";
import { pruneJobRuns, recordJobRun } from "./ops";
import { getOrg } from "./settings";
import { syncShopify, type SyncResult } from "./shopify/sync";

// Scheduled work. The cron routes call these; each is safe to run twice.

const THIRTEEN_MONTHS = 400 * 24 * 60 * 60_000;

export interface NightlyReport {
  orgId: string;
  spendRefreshed: number;
  tierDowns: number;
  tierUps: number;
  bookingsCompleted: number;
  holdsExpired: number;
  previewsCleared: number;
  couponsExpired: number;
  birthdays: number;
  ledgerDrift: number;
  monthlyReview: boolean;
  shopify: SyncResult | { error: string } | null; // null = no active online shop
}

/** 02:00 every night: 12-month spend slides forward; on the 1st, tiers may drop. */
export async function runNightly(orgId: string, now = new Date()): Promise<NightlyReport> {
  const { settings } = await getOrg(orgId);
  const client = db(orgId);
  const monthly = isMonthlyTierReview(now, settings.timezone);
  // Online orders first, so tonight's spend refresh already counts them. A shop
  // outage must not stop the rest of the night's work.
  let shopify: NightlyReport["shopify"] = null;
  try {
    shopify = await syncShopify(orgId, SYSTEM, { now });
  } catch (e) {
    shopify = { error: e instanceof Error ? e.message : String(e) };
    console.error(`[nightly] shopify sync failed for org ${orgId}`, shopify.error);
  }
  // Spend changes overnight only for members whose purchases are ageing out of the
  // window — plus anyone above the lowest tier, so a tier with no spend behind it
  // still meets the monthly review.
  const members = await client.member.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ lastPurchaseAt: { gte: new Date(now.getTime() - THIRTEEN_MONTHS) } }, { tier: { not: lowestTier(settings.tiers).key } }],
    },
    select: { id: true },
  });
  let tierDowns = 0;
  let tierUps = 0;
  for (const m of members) {
    const r = await inTx(orgId, async (tx) => {
      const res = await refreshMemberSpend(tx, orgId, m.id, settings, { allowDowngrade: monthly, now });
      if (res.tierChanged === "down") await recordEvent(tx, orgId, m.id, "TIER_DOWN", { tier: res.tier, review: "monthly" });
      return res;
    });
    if (r.tierChanged === "down") tierDowns++;
    if (r.tierChanged === "up") tierUps++;
  }
  const bookings = await closeFinishedBookings(orgId, now);
  const couponsExpired = await expireCoupons(orgId, now);
  const birthdays = await queueBirthdays(orgId, now);
  await pruneOtpCodes(orgId, now);
  await pruneRateHits(orgId, now);
  const cleared = await client.importBatch.deleteMany({ where: { status: "PREVIEW", createdAt: { lt: new Date(now.getTime() - 24 * 3600_000) } } });
  await pruneJobRuns(orgId, now);
  const drift = await ledgerDrift(orgId);
  if (drift.length) console.error(`[nightly] points cache drift for ${drift.length} member(s) in org ${orgId}`, drift.slice(0, 5));
  return {
    orgId,
    spendRefreshed: members.length,
    tierDowns,
    tierUps,
    bookingsCompleted: bookings.completed,
    holdsExpired: bookings.expired,
    previewsCleared: cleared.count,
    couponsExpired,
    birthdays,
    ledgerDrift: drift.length,
    monthlyReview: monthly,
    shopify,
  };
}

/** Every 15 minutes: queue booking reminders, then deliver whatever is waiting (LINE, then staff email). */
export async function runFrequent(now = new Date()): Promise<{ reminders: number; outbox: OutboxRun; email: OutboxRun }> {
  const orgs = await prisma.organization.findMany({ where: { isActive: true }, select: { id: true } });
  let reminders = 0;
  // One org's failure must not stop the others' reminders.
  for (const o of orgs) {
    try {
      reminders += await queueReminders(o.id, now);
    } catch (e) {
      console.error("[jobs] reminders failed for", o.id, e instanceof Error ? e.message : e);
    }
  }
  const outbox = await processOutbox({ limit: 200, now });
  const email = await processEmails({ limit: 50 });
  return { reminders, outbox, email };
}

export type NightlyOutcome = NightlyReport | { orgId: string; error: string };

/**
 * Every org's nightly run, each recorded on that org only (its own report, not
 * the others'), and one org's failure doesn't stop the rest.
 */
export async function runNightlyAll(now = new Date()): Promise<NightlyOutcome[]> {
  const orgs = await prisma.organization.findMany({ where: { isActive: true }, select: { id: true } });
  const out: NightlyOutcome[] = [];
  for (const o of orgs) {
    const startedAt = new Date();
    try {
      const report = await runNightly(o.id, now);
      out.push(report);
      await recordJobRun("nightly", { startedAt, ok: true, detail: report, orgIds: [o.id] });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      out.push({ orgId: o.id, error });
      await recordJobRun("nightly", { startedAt, ok: false, error, orgIds: [o.id] }).catch(() => undefined);
    }
  }
  return out;
}
