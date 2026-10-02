import { isMonthlyTierReview } from "@mstgolf/shared/tiers";
import { prisma } from "@mstgolf/database";
import { closeFinishedBookings, queueReminders } from "./booking";
import { SYSTEM } from "./context";
import { db, inTx } from "./db";
import { recordEvent } from "./events";
import { refreshMemberSpend } from "./members";
import { processOutbox, type OutboxRun } from "./notify/sender";
import { ledgerDrift } from "./points";
import { pruneJobRuns } from "./ops";
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
  // Spend changes overnight only for members whose purchases are ageing out of the window.
  const members = await client.member.findMany({
    where: { status: "ACTIVE", lastPurchaseAt: { gte: new Date(now.getTime() - THIRTEEN_MONTHS) } },
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
    ledgerDrift: drift.length,
    monthlyReview: monthly,
    shopify,
  };
}

/** Every 15 minutes: queue booking reminders, then deliver whatever is waiting. */
export async function runFrequent(now = new Date()): Promise<{ reminders: number; outbox: OutboxRun }> {
  const orgs = await prisma.organization.findMany({ where: { isActive: true }, select: { id: true } });
  let reminders = 0;
  for (const o of orgs) reminders += await queueReminders(o.id, now);
  const outbox = await processOutbox({ limit: 200, now });
  return { reminders, outbox };
}

export async function runNightlyAll(now = new Date()): Promise<NightlyReport[]> {
  const orgs = await prisma.organization.findMany({ where: { isActive: true }, select: { id: true } });
  const out: NightlyReport[] = [];
  for (const o of orgs) out.push(await runNightly(o.id, now));
  return out;
}
