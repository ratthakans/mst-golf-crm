import { CoreError } from "../errors";

// SMS for sign-in codes. One provider at a time, chosen by environment:
//   SMS_PROVIDER=thaibulksms  SMS_API_KEY  SMS_API_SECRET  SMS_SENDER (registered sender name, e.g. "MSTGOLF")
//   SMS_PROVIDER=mock         no message leaves the server; the code is logged and, outside the
//                             production database, shown on screen so previews can be tested.
// Nothing set: mock in development, refused in production.

export type SmsProvider = "thaibulksms" | "mock";

export function smsProvider(): SmsProvider | null {
  const p = process.env.SMS_PROVIDER?.trim().toLowerCase();
  if (p === "thaibulksms") return process.env.SMS_API_KEY && process.env.SMS_API_SECRET ? "thaibulksms" : null;
  if (p === "mock") return "mock";
  return process.env.NODE_ENV === "production" ? null : "mock";
}

/** The mock may reveal the code on screen — never against the production database. */
export function smsShowsCode(): boolean {
  const schema = process.env.DATABASE_SCHEMA || "public";
  return smsProvider() === "mock" && schema !== "public";
}

export async function sendSms(to: string, message: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const provider = smsProvider();
  if (!provider) throw new CoreError("SMS_UNAVAILABLE", "ระบบส่ง SMS ยังไม่พร้อม กรุณาติดต่อร้าน");
  if (provider === "mock") {
    // The code never goes to the logs; the mock shows it on screen instead (smsShowsCode).
    console.info(`[sms:mock] to ${to.slice(0, 3)}xxxx${to.slice(-3)}: ${message.replace(/\d{6}/g, "••••••")}`);
    return;
  }
  // ThaiBulkSMS API v2 — Basic auth with the key/secret pair, form-encoded body.
  const auth = Buffer.from(`${process.env.SMS_API_KEY}:${process.env.SMS_API_SECRET}`).toString("base64");
  const body = new URLSearchParams({ msisdn: to, message, sender: process.env.SMS_SENDER || "MSTGOLF" });
  let res: Response;
  try {
    res = await fetchImpl("https://api-v2.thaibulksms.com/sms", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
  } catch (e) {
    console.error("[sms] network", e instanceof Error ? e.message : e);
    throw new CoreError("SMS_UNAVAILABLE", "ส่ง SMS ไม่สำเร็จ กรุณาลองใหม่");
  }
  if (!res.ok) {
    console.error("[sms] provider", res.status, (await res.text().catch(() => "")).slice(0, 200));
    throw new CoreError("SMS_UNAVAILABLE", "ส่ง SMS ไม่สำเร็จ กรุณาลองใหม่");
  }
}
