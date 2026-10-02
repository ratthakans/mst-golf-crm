import type { NotificationKind } from "@mstgolf/shared";
import { decrypt } from "@mstgolf/shared";
import { prisma } from "@mstgolf/database";
import { db } from "../db";
import { resolveSettings } from "../settings";
import { pushMessage, retryKeyFor } from "./line-api";
import { renderNotification, type RenderContext } from "./templates";

const MAX_ATTEMPTS = 5;
const STALE_MS = 48 * 60 * 60_000; // a message this late would confuse more than help

export interface OutboxRun {
  sent: number;
  skipped: number;
  failed: number;
  retrying: number;
}

export interface LineConfig {
  accessToken: string;
  liffId: string | null;
  loginChannelId: string | null;
}

/** The org's active Messaging API channel, decrypted — null until the LINE agency hands it over. */
export async function lineConfig(orgId: string): Promise<LineConfig | null> {
  const ch = await db(orgId).lineChannel.findFirst({ where: { isActive: true }, orderBy: { updatedAt: "desc" } });
  if (!ch) return null;
  try {
    return { accessToken: decrypt(ch.channelAccessTokenEnc), liffId: ch.liffId, loginChannelId: ch.loginChannelId };
  } catch {
    return null; // ENCRYPTION_KEY rotated or missing — treat as not configured
  }
}

export function liffUrl(liffId: string | null, path: string, siteUrl?: string): string | null {
  if (liffId) return `https://liff.line.me/${liffId}${path}`;
  if (siteUrl) return `${siteUrl.replace(/\/$/, "")}/app${path}`;
  return null;
}

/** Delivers pending notifications for every active org. Safe to run concurrently (rows are claimed). */
export async function processOutbox(opts: { limit?: number; fetchImpl?: typeof fetch; now?: Date } = {}): Promise<OutboxRun> {
  const run: OutboxRun = { sent: 0, skipped: 0, failed: 0, retrying: 0 };
  const orgs = await prisma.organization.findMany({ where: { isActive: true }, select: { id: true, settings: true } });
  for (const org of orgs) {
    const r = await processOrgOutbox(org.id, org.settings, opts);
    run.sent += r.sent;
    run.skipped += r.skipped;
    run.failed += r.failed;
    run.retrying += r.retrying;
  }
  return run;
}

async function processOrgOutbox(
  orgId: string,
  rawSettings: unknown,
  opts: { limit?: number; fetchImpl?: typeof fetch; now?: Date },
): Promise<OutboxRun> {
  const run: OutboxRun = { sent: 0, skipped: 0, failed: 0, retrying: 0 };
  const client = db(orgId);
  const now = opts.now ?? new Date();
  const pending = await client.notification.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 50,
  });
  if (pending.length === 0) return run;

  const settings = resolveSettings(rawSettings);
  const line = await lineConfig(orgId);
  const store = await client.store.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  const ctx: RenderContext = {
    brandColor: settings.brandColor,
    storeName: store?.name ?? "MST Golf",
    memberUrl: liffUrl(line?.liffId ?? null, "/member", settings.site.siteUrl),
    bookingUrl: liffUrl(line?.liffId ?? null, "/booking", settings.site.siteUrl),
    rewardsUrl: liffUrl(line?.liffId ?? null, "/rewards", settings.site.siteUrl),
  };

  const skip = async (id: string, reason: string) => {
    await client.notification.updateMany({ where: { id, status: "PENDING" }, data: { status: "SKIPPED", lastError: reason } });
    run.skipped++;
  };

  for (const n of pending) {
    const kind = n.kind as NotificationKind;
    if (!settings.notifications[kind]) {
      await skip(n.id, "ปิดข้อความประเภทนี้ใน Settings");
      continue;
    }
    if (now.getTime() - n.createdAt.getTime() > STALE_MS) {
      await skip(n.id, "เกิน 48 ชั่วโมง ไม่ส่งแล้ว");
      continue;
    }
    if (!line) {
      await skip(n.id, "ยังไม่ได้ตั้งค่า LINE Messaging API");
      continue;
    }
    const member = await client.member.findFirst({
      where: { id: n.memberId },
      select: { status: true, lineReachable: true, identities: { where: { type: "LINE" }, select: { value: true } } },
    });
    const to = member?.identities[0]?.value;
    if (!member || member.status !== "ACTIVE" || !to) {
      await skip(n.id, "สมาชิกไม่มี LINE");
      continue;
    }
    if (kind === "BOOKING_REMINDER" || kind === "BOOKING_CONFIRMED") {
      const startAt = new Date(String((n.payload as { startAt?: string }).startAt ?? 0));
      if (startAt.getTime() < now.getTime()) {
        await skip(n.id, "เลยเวลาจองแล้ว");
        continue;
      }
    }

    // Claim the row so a concurrent run cannot send it too.
    const claimed = await client.notification.updateMany({
      where: { id: n.id, status: "PENDING", attempts: n.attempts },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;

    const messages = renderNotification(kind, n.payload, ctx);
    const res = await pushMessage(line.accessToken, to, messages, retryKeyFor(n.id), opts.fetchImpl);
    if (res.ok) {
      await client.notification.updateMany({ where: { id: n.id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
      if (!member.lineReachable) await client.member.updateMany({ where: { id: n.memberId }, data: { lineReachable: true } });
      run.sent++;
    } else if (res.unreachable) {
      await client.notification.updateMany({ where: { id: n.id }, data: { status: "FAILED", lastError: res.error } });
      await client.member.updateMany({ where: { id: n.memberId }, data: { lineReachable: false } });
      run.failed++;
    } else if (res.retry && n.attempts + 1 < MAX_ATTEMPTS) {
      await client.notification.updateMany({ where: { id: n.id }, data: { lastError: res.error } });
      run.retrying++;
    } else {
      await client.notification.updateMany({ where: { id: n.id }, data: { status: "FAILED", lastError: res.error } });
      run.failed++;
    }
  }
  return run;
}
