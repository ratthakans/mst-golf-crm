import type { NotificationKind } from "@mstgolf/shared";
import { findTier, lowestTier } from "@mstgolf/shared/tiers";
import { db, inTx, lockMembers } from "../db";
import { CoreError } from "../errors";
import { recordEvent } from "../events";
import { postPoints } from "../points";
import { cleanAlertEmails } from "../rewards";
import { getOrg } from "../settings";
import { localParts } from "../time";
import { emailConfigured, enqueueEmail } from "./email";
import { enqueue } from "./outbox";
import { notificationContent, type NotificationContent } from "./templates";

// The member's inbox on the website: every notification the platform queued
// for them, whatever channel (if any) also delivered it. Rendered from the
// stored payload with the same content as LINE and email.

export interface InboxItem extends NotificationContent {
  id: string;
  kind: NotificationKind;
  at: Date;
  read: boolean;
}

const WEB_LINKS = { memberUrl: "/app/member", bookingUrl: "/app/booking", rewardsUrl: "/app/rewards" };

export async function memberInbox(orgId: string, memberId: string, limit = 50): Promise<InboxItem[]> {
  const client = db(orgId);
  const [rows, store, { settings }] = await Promise.all([
    client.notification.findMany({ where: { memberId }, orderBy: { createdAt: "desc" }, take: limit }),
    client.store.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { name: true } }),
    getOrg(orgId),
  ]);
  const ctx = { brandColor: settings.brandColor, storeName: store?.name ?? "MST Golf", ...WEB_LINKS };
  return rows.map((n) => ({
    id: n.id,
    kind: n.kind as NotificationKind,
    at: n.createdAt,
    read: !!n.readAt,
    ...notificationContent(n.kind as NotificationKind, n.payload, ctx),
  }));
}

export async function unreadCount(orgId: string, memberId: string): Promise<number> {
  return db(orgId).notification.count({ where: { memberId, readAt: null } });
}

export async function markInboxRead(orgId: string, memberId: string, now = new Date()): Promise<void> {
  await db(orgId).notification.updateMany({ where: { memberId, readAt: null }, data: { readAt: now } });
}

/**
 * Daily: members whose birthday month is this month hear about their birthday
 * privileges once a year — and get the birthday bonus if MST set one. Running
 * daily means someone who signs up mid-month still gets it.
 */
export async function queueBirthdays(orgId: string, now = new Date()): Promise<number> {
  const { settings } = await getOrg(orgId);
  if (!settings.notifications.BIRTHDAY && settings.birthdayBonus <= 0) return 0;
  const { year, month } = localParts(now);
  const client = db(orgId);
  // Birthdays are @db.Date (UTC midnight); match on the month.
  const candidates = await client.member.findMany({
    where: { status: "ACTIVE", consentAt: { not: null }, birthday: { not: null } },
    select: { id: true, birthday: true, tier: true },
  });
  let queued = 0;
  for (const m of candidates) {
    if (m.birthday!.getUTCMonth() + 1 !== month) continue;
    const key = `BIRTHDAY:${m.id}:${year}`;
    const done = await client.notification.findFirst({ where: { dedupeKey: key }, select: { id: true } });
    if (done) continue;
    const tier = findTier(m.tier, settings.tiers) ?? lowestTier(settings.tiers);
    await inTx(orgId, async (tx) => {
      // Overlapping runs: the second waits here, then sees the first's bonus and skips it.
      await lockMembers(tx, orgId, [m.id]);
      const note = `โบนัสวันเกิด ${year}`;
      let bonus = 0;
      if (settings.birthdayBonus > 0 && !(await tx.pointTransaction.findFirst({ where: { memberId: m.id, reason: "BIRTHDAY", note } }))) {
        bonus = settings.birthdayBonus;
        await postPoints(tx, orgId, { memberId: m.id, type: "BONUS", delta: bonus, reason: "BIRTHDAY", note });
      }
      await enqueue(tx, orgId, [
        { memberId: m.id, kind: "BIRTHDAY", dedupeKey: key, payload: { multiplier: tier.benefits.birthdayPointMultiplier, bonus, tierName: tier.name } },
      ]);
      await recordEvent(tx, orgId, m.id, "EARN_POINTS", { reason: "BIRTHDAY", bonus, year }, now);
    });
    queued++;
  }
  return queued;
}

// ---------------------------------------------------------------------------
// Website contact form → Marketing's inbox
// ---------------------------------------------------------------------------

export const CONTACT_TOPICS = ["สอบถามสินค้า", "ฟิตติ้ง", "Golf Simulator", "สมาชิกและแต้ม", "อื่น ๆ"] as const;

export interface ContactInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  topic: string;
  message: string;
  memberCode?: string | null;
  ip?: string | null;
  website?: string | null; // honeypot — people never fill it
}

/**
 * Sends a contact-form message to the Marketing addresses (Settings › การแลกรางวัล).
 * Refuses honestly when nobody would receive it, so a visitor is never told
 * "sent" for a message that goes nowhere.
 */
export async function submitContact(orgId: string, input: ContactInput, now = new Date()): Promise<void> {
  const { settings } = await getOrg(orgId);
  const to = settings.redemption.alertEmails;
  if (!to.length || !emailConfigured()) {
    const phone = settings.site.phone;
    throw new CoreError("UNAVAILABLE", `ระบบรับข้อความทางเว็บยังไม่เปิด${phone ? ` กรุณาโทร ${phone}` : " กรุณาโทรหาร้าน"}`);
  }
  if (input.website) return; // a bot filled the hidden field: accept silently, send nothing
  const name = input.name.trim().slice(0, 80);
  const message = input.message.trim().slice(0, 2000);
  const phone = input.phone?.replace(/[^\d+]/g, "").slice(0, 15) || null;
  const email = input.email?.trim().toLowerCase().slice(0, 160) || null;
  const topic = (CONTACT_TOPICS as readonly string[]).includes(input.topic) ? input.topic : "อื่น ๆ";
  if (name.length < 2) throw new CoreError("INVALID_INPUT", "กรุณากรอกชื่อ");
  if (message.length < 5) throw new CoreError("INVALID_INPUT", "กรุณาพิมพ์ข้อความที่ต้องการติดต่อ");
  if (!phone && !email) throw new CoreError("INVALID_INPUT", "ใส่เบอร์โทรหรืออีเมลอย่างน้อยหนึ่งอย่าง เพื่อให้เราติดต่อกลับได้");
  if (email) cleanAlertEmails([email]); // same address check as staff emails
  if (phone && phone.replace(/\D/g, "").length < 9) throw new CoreError("INVALID_INPUT", "เบอร์โทรไม่ถูกต้อง");
  const client = db(orgId);
  if (input.ip) {
    const recent = await client.emailMessage.count({ where: { kind: "CONTACT", createdAt: { gte: new Date(now.getTime() - 3600_000) }, payload: { path: ["ip"], equals: input.ip } } });
    if (recent >= 5) throw new CoreError("OTP_RATE", "ส่งข้อความหลายครั้งแล้ว กรุณาลองใหม่ภายหลัง หรือโทรหาร้าน");
  }
  await inTx(orgId, (tx) =>
    enqueueEmail(tx, orgId, {
      to,
      kind: "CONTACT",
      dedupeKey: `CONTACT:${now.getTime()}:${Math.random().toString(36).slice(2, 8)}`,
      payload: { name, phone, email, topic, message, memberCode: input.memberCode ?? null, at: now.toISOString(), ip: input.ip ?? null },
    }),
  );
}
