import { db } from "./db";
import { CoreError } from "./errors";

// Durable rate limits. Route handlers run on serverless instances that share
// no memory, so the attempts are rows (RateHit) — counted per bucket and key
// over a sliding window, pruned nightly. Not a strict counter (two requests in
// the same instant can both pass the count), which is fine for a brake.

const HOUR = 3600_000;

export interface Limit {
  /** what is limited: an email, an IP, a phone — null skips the key (e.g. no IP header) */
  key: string | null;
  max: number;
  windowMs: number;
}

/** Throws OTP_RATE (429) with `message` when any key is at its limit within its window. */
export async function assertUnderLimit(orgId: string, bucket: string, limits: Limit[], message: string, now = new Date()): Promise<void> {
  const client = db(orgId);
  for (const l of limits) {
    if (!l.key) continue;
    const n = await client.rateHit.count({ where: { bucket, key: l.key, createdAt: { gte: new Date(now.getTime() - l.windowMs) } } });
    if (n >= l.max) throw new CoreError("OTP_RATE", message);
  }
}

/** Counts one attempt against each key. */
export async function recordHit(orgId: string, bucket: string, keys: Array<string | null>, now = new Date()): Promise<void> {
  const rows = keys.filter((k): k is string => !!k).map((key) => ({ orgId, bucket, key, createdAt: now }));
  if (rows.length) await db(orgId).rateHit.createMany({ data: rows });
}

/** Forgets the attempts for a key (e.g. a successful login clears that email's failures). */
export async function clearHits(orgId: string, bucket: string, key: string): Promise<void> {
  await db(orgId).rateHit.deleteMany({ where: { bucket, key } });
}

/** Check, then count — for attempts that are limited whether or not they succeed. */
export async function takeHit(orgId: string, bucket: string, limits: Limit[], message: string, now = new Date()): Promise<void> {
  await assertUnderLimit(orgId, bucket, limits, message, now);
  await recordHit(orgId, bucket, limits.map((l) => l.key), now);
}

/**
 * Count first, then check — for limits that must hold under a burst (staff
 * login). Each request inserts its own hit before counting, so parallel
 * requests all see each other and at most `max` get through. The caller
 * clears the key when the attempt succeeds.
 */
export async function claimAttempt(orgId: string, bucket: string, limits: Limit[], message: string, now = new Date()): Promise<void> {
  await recordHit(orgId, bucket, limits.map((l) => l.key), now);
  const client = db(orgId);
  for (const l of limits) {
    if (!l.key) continue;
    const n = await client.rateHit.count({ where: { bucket, key: l.key, createdAt: { gte: new Date(now.getTime() - l.windowMs) } } });
    if (n > l.max) throw new CoreError("OTP_RATE", message);
  }
}

/** Nightly: attempts older than two days no longer count for anything. */
export async function pruneRateHits(orgId: string, now = new Date()): Promise<number> {
  return (await db(orgId).rateHit.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 48 * HOUR) } } })).count;
}

export const RATE = { HOUR, MINUTE: 60_000 } as const;
