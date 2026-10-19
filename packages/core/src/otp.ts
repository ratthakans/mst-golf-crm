import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { CoreError } from "./errors";
import { newId } from "./ids";
import { parsePhone } from "./members";
import { sendSms, smsShowsCode } from "./notify/sms";
import { getOrg } from "./settings";

// Website sign-in with a mobile number (docs/PRODUCT.md §3). The phone is the
// identity the store already uses at the counter, so proving you hold it is
// what lets you see — and spend — that member's points.

const CODE_TTL_MS = 5 * 60_000;
const RESEND_AFTER_MS = 60_000;
// Per number from one IP, and per number overall: someone typing a stranger's
// number can use up their own share, not lock the owner out for the day.
const MAX_PER_PHONE_PER_IP_PER_DAY = 5;
const MAX_PER_PHONE_PER_DAY = 15;
const MAX_PER_IP_PER_HOUR = 20;
const MAX_TRIES = 5;

const hash = (id: string, code: string) => createHash("sha256").update(`${id}:${code}`).digest("hex");

export interface OtpRequestResult {
  phone: string;
  expiresInSec: number;
  resendInSec: number;
  /** Only with the mock SMS outside the production database, so previews can be tested. */
  devCode?: string;
}

export async function requestOtp(orgId: string, rawPhone: string, opts: { ip?: string | null; now?: Date; fetchImpl?: typeof fetch } = {}): Promise<OtpRequestResult> {
  const phone = parsePhone(rawPhone);
  const now = opts.now ?? new Date();
  const client = db(orgId);
  const last = await client.otpCode.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } });
  if (last && now.getTime() - last.createdAt.getTime() < RESEND_AFTER_MS) {
    const wait = Math.ceil((RESEND_AFTER_MS - (now.getTime() - last.createdAt.getTime())) / 1000);
    throw new CoreError("OTP_RATE", `ขอรหัสใหม่ได้ในอีก ${wait} วินาที`, { retryAfter: wait });
  }
  const dayAgo = new Date(now.getTime() - 24 * 3600_000);
  const today = await client.otpCode.count({ where: { phone, createdAt: { gte: dayAgo } } });
  const todayHere = opts.ip ? await client.otpCode.count({ where: { phone, ip: opts.ip, createdAt: { gte: dayAgo } } }) : today;
  if (today >= MAX_PER_PHONE_PER_DAY || todayHere >= MAX_PER_PHONE_PER_IP_PER_DAY) {
    throw new CoreError("OTP_RATE", "ขอรหัสครบจำนวนต่อวันแล้ว กรุณาลองพรุ่งนี้หรือติดต่อร้าน");
  }
  if (opts.ip) {
    const fromIp = await client.otpCode.count({ where: { ip: opts.ip, createdAt: { gte: new Date(now.getTime() - 3600_000) } } });
    if (fromIp >= MAX_PER_IP_PER_HOUR) throw new CoreError("OTP_RATE", "มีการขอรหัสจากเครื่องนี้มากเกินไป กรุณาลองใหม่ภายหลัง");
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // The hash is written with the row: a verify can never meet a row without one.
  const id = newId();
  const row = await client.otpCode.create({ data: { id, orgId, phone, codeHash: hash(id, code), expiresAt: new Date(now.getTime() + CODE_TTL_MS), ip: opts.ip ?? null, createdAt: now } });
  const { name } = await getOrg(orgId);
  try {
    await sendSms(phone, `รหัสเข้าสู่ระบบ ${name}: ${code} (ใช้ได้ 5 นาที) อย่าบอกรหัสนี้กับผู้อื่น`, opts.fetchImpl);
  } catch (e) {
    await client.otpCode.deleteMany({ where: { id: row.id } }); // a code nobody received must not block a resend
    throw e;
  }
  return { phone, expiresInSec: CODE_TTL_MS / 1000, resendInSec: RESEND_AFTER_MS / 1000, ...(smsShowsCode() ? { devCode: code } : {}) };
}

/** Checks the latest code for the phone. Returns the normalised phone on success; each code works once. */
export async function verifyOtp(orgId: string, rawPhone: string, rawCode: string, now = new Date()): Promise<string> {
  const phone = parsePhone(rawPhone);
  const code = rawCode.replace(/\D/g, "");
  if (code.length !== 6) throw new CoreError("OTP_INVALID", "รหัสต้องเป็นตัวเลข 6 หลัก");
  const client = db(orgId);
  const row = await client.otpCode.findFirst({ where: { phone, usedAt: null }, orderBy: { createdAt: "desc" } });
  if (!row || row.expiresAt < now) throw new CoreError("OTP_INVALID", "รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่");
  if (row.attempts >= MAX_TRIES) throw new CoreError("OTP_INVALID", "ใส่รหัสผิดหลายครั้ง กรุณาขอรหัสใหม่");
  // Count the try before comparing, conditionally, so parallel guesses cannot exceed the limit.
  const counted = await client.otpCode.updateMany({ where: { id: row.id, usedAt: null, attempts: { lt: MAX_TRIES } }, data: { attempts: { increment: 1 } } });
  if (!counted.count) throw new CoreError("OTP_INVALID", "ใส่รหัสผิดหลายครั้ง กรุณาขอรหัสใหม่");
  const ok = timingSafeEqual(Buffer.from(hash(row.id, code), "hex"), Buffer.from(row.codeHash, "hex"));
  if (!ok) {
    const left = MAX_TRIES - row.attempts - 1;
    throw new CoreError("OTP_INVALID", left > 0 ? `รหัสไม่ถูกต้อง ลองได้อีก ${left} ครั้ง` : "ใส่รหัสผิดหลายครั้ง กรุณาขอรหัสใหม่");
  }
  const used = await client.otpCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
  if (!used.count) throw new CoreError("OTP_INVALID", "รหัสนี้ถูกใช้ไปแล้ว กรุณาขอรหัสใหม่");
  return phone;
}

/** Nightly: codes older than a day are useless; keep the table small. */
export async function pruneOtpCodes(orgId: string, now = new Date()): Promise<number> {
  const r = await db(orgId).otpCode.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 2 * 24 * 3600_000) } } });
  return r.count;
}
