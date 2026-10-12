import type { Prisma } from "@mstgolf/database";
import { prisma } from "@mstgolf/database";
import { db, type Tx } from "../db";
import { resolveSettings } from "../settings";
import { formatThaiDate, formatHm } from "../time";
import type { OutboxRun } from "./sender";
import type { NotificationContent } from "./templates";

// Email to staff (never to customers — they hear from us in LINE). Written to
// EmailMessage inside the transaction that caused it and delivered afterwards
// through Resend (RESEND_API_KEY, EMAIL_FROM). Until both are set every email
// is SKIPPED with the reason, and the request is still in the back-office queue.
//
// Per the client's proposal, the email carries no personal details: the
// Redemption ID, the member code and a link to the permission-controlled record.

export interface EmailItem {
  to: string[];
  kind: "REDEMPTION_REQUEST" | "CONTACT";
  dedupeKey: string;
  payload: Record<string, unknown>;
}

export async function enqueueEmail(tx: Tx, orgId: string, item: EmailItem): Promise<void> {
  if (!item.to.length) return;
  await tx.emailMessage.createMany({
    data: [{ orgId, to: item.to, kind: item.kind, dedupeKey: item.dedupeKey, payload: item.payload as Prisma.InputJsonValue }],
    skipDuplicates: true,
  });
}

export interface RedemptionRequestPayload {
  redemptionId: string;
  code: string;
  rewardName: string;
  memberCode: string;
  points: number;
  method: "PICKUP" | "SHIP" | null;
  storeName: string | null;
  at: string;
}

/** A message from the website contact form. Personal details are what the sender typed in, sent to Marketing only. */
export interface ContactPayload {
  name: string;
  phone: string | null;
  email: string | null;
  topic: string;
  message: string;
  memberCode: string | null;
  at: string;
}

export function renderContactEmail(p: ContactPayload): RenderedEmail {
  const at = new Date(p.at);
  const rows: Array<[string, string]> = [
    ["ชื่อ", p.name],
    ["เบอร์", p.phone ?? "–"],
    ["อีเมล", p.email ?? "–"],
    ["เรื่อง", p.topic],
    ["รหัสสมาชิก", p.memberCode ?? "ไม่ได้เข้าสู่ระบบ"],
    ["เวลา", `${formatThaiDate(at)} ${formatHm(at)}`],
  ];
  const text = ["ข้อความจากหน้าติดต่อเรา บนเว็บไซต์", "", ...rows.map(([k, v]) => `${k}: ${v}`), "", p.message].join("\n");
  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,sans-serif;color:#1a1a1a;line-height:1.55">
<p>ข้อความจากหน้าติดต่อเรา บนเว็บไซต์</p>
<table cellpadding="6" style="border-collapse:collapse;font-size:14px">${rows.map(([k, v]) => `<tr><td style="color:#666;border-bottom:1px solid #eee">${esc(k)}</td><td style="border-bottom:1px solid #eee"><b>${esc(v)}</b></td></tr>`).join("")}</table>
<p style="white-space:pre-line;border-left:3px solid #ddd;padding-left:12px">${esc(p.message)}</p>
</body></html>`;
  return { subject: `ติดต่อจากเว็บไซต์: ${p.topic} · ${p.name}`, text, html };
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderRedemptionEmail(p: RedemptionRequestPayload, backofficeUrl: string | undefined): RenderedEmail {
  const at = new Date(p.at);
  const link = backofficeUrl ? `${backofficeUrl.replace(/\/$/, "")}/rewards/redemptions/${p.redemptionId}` : null;
  const rows: Array<[string, string]> = [
    ["Redemption ID", p.code],
    ["Member ID", p.memberCode],
    ["Reward", p.rewardName],
    ["Points reserved", `${p.points.toLocaleString("en-US")} (deducted; refunded if rejected or cancelled)`],
    ["Delivery", p.method === "SHIP" ? "Ship to address" : p.method === "PICKUP" ? `Pick up${p.storeName ? ` at ${p.storeName}` : ""}` : "—"],
    ["Request date", `${formatThaiDate(at)} ${formatHm(at)} (Bangkok)`],
  ];
  const steps = [
    "Verify eligibility and reward availability.",
    "Confirm delivery details through the back-office record.",
    "Advise the customer of the fulfilment window, subject to stock and delivery confirmation.",
    "Update the case status through completion — the customer is notified in LINE at each step.",
  ];
  const subject = `New reward request: ${p.rewardName} · ${p.code}`;
  const text = [
    "A new reward redemption request has been submitted.",
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    "Required actions:",
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    link ? `Open the case: ${link}` : "Open the case in the back office › Rewards.",
    "Customer details are kept in the secure back-office record, not in this email.",
  ].join("\n");
  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,sans-serif;color:#1a1a1a;line-height:1.5">
<p>A new reward redemption request has been submitted.</p>
<table cellpadding="6" style="border-collapse:collapse;font-size:14px">${rows
    .map(([k, v]) => `<tr><td style="color:#666;border-bottom:1px solid #eee">${esc(k)}</td><td style="border-bottom:1px solid #eee"><b>${esc(v)}</b></td></tr>`)
    .join("")}</table>
<p style="margin-top:18px"><b>Required actions</b></p>
<ol>${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
${link ? `<p><a href="${esc(link)}" style="display:inline-block;background:#00854D;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open the case</a></p>` : "<p>Open the case in the back office › Rewards.</p>"}
<p style="color:#666;font-size:12px">Customer details are kept in the secure back-office record, not in this email.</p>
</body></html>`;
  return { subject, text, html };
}

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export interface OutgoingEmail extends RenderedEmail {
  to: string[];
  idempotencyKey: string;
}

/** One POST to Resend. retry = worth trying again later (rate limit, outage). */
export async function postEmail(mail: OutgoingEmail, fetchImpl: typeof fetch = fetch): Promise<{ ok: true } | { ok: false; retry: boolean; error: string }> {
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": mail.idempotencyKey },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html }),
    });
    if (res.ok) return { ok: true };
    return { ok: false, retry: res.status === 429 || res.status >= 500, error: `HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}` };
  } catch (e) {
    return { ok: false, retry: true, error: e instanceof Error ? e.message : String(e) };
  }
}

/** A member notification (the same content as the website inbox) as an email. */
export function renderMemberEmail(x: NotificationContent, brand: { storeName: string; brandColor: string }): RenderedEmail {
  const rows = x.rows.map((r) => [r.label, r.value] as const);
  const text = [x.title, x.lead, "", ...rows.map(([k, v]) => `${k}: ${v}`), x.foot ? `\n${x.foot}` : "", x.button.url ? `\n${x.button.label}: ${x.button.url}` : ""]
    .filter((l) => l !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,sans-serif;color:#1a1a1a;line-height:1.55;max-width:520px">
<p style="color:${esc(brand.brandColor)};font-weight:700;letter-spacing:.04em;font-size:12px;margin:0 0 8px">${esc(brand.storeName.toUpperCase())}</p>
<h1 style="font-size:20px;margin:0 0 6px">${esc(x.title)}</h1>
${x.lead ? `<p style="color:#555;margin:0 0 14px">${esc(x.lead)}</p>` : ""}
${rows.length ? `<table cellpadding="6" style="border-collapse:collapse;font-size:14px;width:100%">${rows.map(([k, v]) => `<tr><td style="color:#666;border-bottom:1px solid #eee">${esc(k)}</td><td style="border-bottom:1px solid #eee;text-align:right"><b>${esc(v)}</b></td></tr>`).join("")}</table>` : ""}
${x.foot ? `<p style="color:#666;font-size:13px">${esc(x.foot)}</p>` : ""}
${x.button.url ? `<p><a href="${esc(x.button.url)}" style="display:inline-block;background:${esc(brand.brandColor)};color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${esc(x.button.label)}</a></p>` : ""}
<p style="color:#999;font-size:12px">ปิดการแจ้งเตือนทางอีเมลได้ที่หน้าโปรไฟล์สมาชิก</p>
</body></html>`;
  return { subject: x.title, text, html };
}

const MAX_ATTEMPTS = 5;

/** Sends pending staff emails for every active org. Rows are claimed, so concurrent runs are safe. */
export async function processEmails(opts: { limit?: number; fetchImpl?: typeof fetch } = {}): Promise<OutboxRun> {
  const run: OutboxRun = { sent: 0, skipped: 0, failed: 0, retrying: 0 };
  const orgs = await prisma.organization.findMany({ where: { isActive: true }, select: { id: true, settings: true } });
  for (const org of orgs) {
    const client = db(org.id);
    const pending = await client.emailMessage.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: opts.limit ?? 50 });
    if (!pending.length) continue;
    const settings = resolveSettings(org.settings);
    for (const m of pending) {
      if (!emailConfigured()) {
        await client.emailMessage.updateMany({ where: { id: m.id, status: "PENDING" }, data: { status: "SKIPPED", lastError: "ยังไม่ได้ตั้งค่าบริการส่งอีเมล (RESEND_API_KEY, EMAIL_FROM)" } });
        run.skipped++;
        continue;
      }
      const claimed = await client.emailMessage.updateMany({ where: { id: m.id, status: "PENDING", attempts: m.attempts }, data: { attempts: { increment: 1 } } });
      if (!claimed.count) continue;
      const mail = m.kind === "CONTACT" ? renderContactEmail(m.payload as unknown as ContactPayload) : renderRedemptionEmail(m.payload as unknown as RedemptionRequestPayload, settings.redemption.backofficeUrl);
      const res = await postEmail({ to: m.to, ...mail, idempotencyKey: m.id }, opts.fetchImpl);
      if (res.ok) {
        await client.emailMessage.updateMany({ where: { id: m.id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
        run.sent++;
      } else if (res.retry && m.attempts + 1 < MAX_ATTEMPTS) {
        await client.emailMessage.updateMany({ where: { id: m.id }, data: { lastError: res.error } });
        run.retrying++;
      } else {
        await client.emailMessage.updateMany({ where: { id: m.id }, data: { status: "FAILED", lastError: res.error } });
        run.failed++;
      }
    }
  }
  return run;
}
