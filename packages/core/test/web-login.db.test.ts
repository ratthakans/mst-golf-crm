import { beforeAll, describe, expect, it } from "vitest";
import {
  createMemberAtCounter,
  db,
  findMemberByPhone,
  insertMember,
  inTx,
  getOrg,
  markInboxRead,
  memberInbox,
  processOutbox,
  queueBirthdays,
  requestOtp,
  signUp,
  submitContact,
  unreadCount,
  updateSettings,
  verifyOtp,
} from "../src";
import { fromLocal } from "../src/time";
import { makeOrg } from "./fixtures";

let t: Awaited<ReturnType<typeof makeOrg>>;
const at = (sec: number) => new Date(Date.UTC(2026, 9, 12, 3, 0, sec));

beforeAll(async () => {
  delete process.env.SMS_PROVIDER; // development default = mock
  t = await makeOrg("weblogin");
});

describe("SMS sign-in", () => {
  it("issues a 6-digit code, accepts it once, and limits resends", async () => {
    const r = await requestOtp(t.orgId, "089-777-0001", { ip: "1.1.1.1", now: at(0) });
    expect(r.phone).toBe("0897770001");
    expect(r.devCode).toMatch(/^\d{6}$/); // mock SMS on a non-production schema shows the code
    await expect(requestOtp(t.orgId, "0897770001", { now: at(30) })).rejects.toMatchObject({ code: "OTP_RATE" });
    const wrong = r.devCode === "000000" ? "111111" : "000000";
    await expect(verifyOtp(t.orgId, "0897770001", wrong, at(40))).rejects.toMatchObject({ code: "OTP_INVALID" });
    expect(await verifyOtp(t.orgId, "0897770001", r.devCode!, at(45))).toBe("0897770001");
    await expect(verifyOtp(t.orgId, "0897770001", r.devCode!, at(46))).rejects.toMatchObject({ code: "OTP_INVALID" }); // once only
  });

  it("expires codes after 5 minutes and locks after 5 wrong tries", async () => {
    const r = await requestOtp(t.orgId, "0897770002", { now: at(0) });
    await expect(verifyOtp(t.orgId, "0897770002", r.devCode!, new Date(at(0).getTime() + 6 * 60_000))).rejects.toMatchObject({ code: "OTP_INVALID" });
    const r2 = await requestOtp(t.orgId, "0897770002", { now: new Date(at(0).getTime() + 7 * 60_000) });
    const later = new Date(at(0).getTime() + 8 * 60_000);
    const wrong = r2.devCode === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await expect(verifyOtp(t.orgId, "0897770002", wrong, later)).rejects.toMatchObject({ code: "OTP_INVALID" });
    await expect(verifyOtp(t.orgId, "0897770002", r2.devCode!, later)).rejects.toThrow(/หลายครั้ง/);
  });
});

describe("website sign-up", () => {
  it("needs a verified phone, then creates a member with the welcome points", async () => {
    await expect(signUp(t.orgId, { channel: "WEB", fullName: "ไม่ยืนยัน เบอร์", phone: "0897770003", acceptTerms: true, marketing: false })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const r = await signUp(t.orgId, { verifiedPhone: "0897770003", channel: "WEB", fullName: "เว็บ ล้วน", phone: "089 777 0003", acceptTerms: true, marketing: false, email: "web@member.test" });
    expect(r.outcome).toBe("created");
    expect(r.member.phoneVerified).toBe(true);
    expect(r.member.hasLine).toBe(false);
    expect(r.welcomePoints).toBe(1600);
    await expect(signUp(t.orgId, { verifiedPhone: "0897770003", channel: "WEB", fullName: "ซ้ำ", phone: "0897770003", acceptTerms: true, marketing: false })).rejects.toMatchObject({ code: "ALREADY_MEMBER" });
  });

  it("while SMS codes are off, a typed number signs up but is not marked verified", async () => {
    const r = await signUp(t.orgId, { verifiedPhone: "0897770010", phoneProven: false, channel: "WEB", fullName: "ไม่มี รหัส", phone: "0897770010", acceptTerms: true, marketing: false });
    expect(r.outcome).toBe("created");
    expect(r.member.phoneVerified).toBe(false);
  });

  it("a POS-created member claims their account (same points), a counter member just signs in", async () => {
    const { settings } = await getOrg(t.orgId);
    const posId = await inTx(t.orgId, (tx) => insertMember(tx, t.orgId, settings, { source: "POS", displayName: "0897770004", phone: "0897770004" }));
    const before = await findMemberByPhone(t.orgId, "0897770004");
    expect(before?.registered).toBe(false);
    const claimed = await signUp(t.orgId, { verifiedPhone: "0897770004", channel: "WEB", fullName: "ลูกค้า หน้าร้าน", phone: "0897770004", acceptTerms: true, marketing: true });
    expect(claimed.outcome).toBe("linked");
    expect(claimed.member.id).toBe(posId);
    expect(claimed.member.registered).toBe(true);

    await createMemberAtCounter(t.orgId, t.actor, { fullName: "เคาน์เตอร์ ทดสอบ", phone: "0897770005", consentConfirmed: true, marketing: false });
    const counter = await findMemberByPhone(t.orgId, "0897770005");
    expect(counter?.registered).toBe(true); // signs straight in after the SMS code
  });
});

describe("inbox and delivery without LINE", () => {
  it("keeps every notification in the website inbox; email goes out when the member gave one", async () => {
    const m = await findMemberByPhone(t.orgId, "0897770003");
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "MST Golf <hello@mst.test>";
    const sent: string[] = [];
    await processOutbox({ fetchImpl: async (url, init) => {
      sent.push(`${String(url)} ${JSON.parse(String(init?.body)).to}`);
      return new Response("{}");
    } });
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    expect(sent.some((s) => s.startsWith("https://api.resend.com/emails") && s.includes("web@member.test"))).toBe(true);
    expect(sent.some((s) => s.includes("api.line.me"))).toBe(false);
    const welcome = await db(t.orgId).notification.findFirstOrThrow({ where: { memberId: m!.id, kind: "WELCOME" } });
    expect(welcome).toMatchObject({ status: "SENT", channel: "EMAIL" });

    const inbox = await memberInbox(t.orgId, m!.id);
    expect(inbox[0]).toMatchObject({ kind: "WELCOME", read: false });
    expect(inbox[0]!.button.url).toBe("/app/member");
    expect(await unreadCount(t.orgId, m!.id)).toBe(1);
    await markInboxRead(t.orgId, m!.id);
    expect(await unreadCount(t.orgId, m!.id)).toBe(0);
  });

  it("sends the birthday message once a year and pays the birthday bonus through the ledger", async () => {
    await updateSettings(t.orgId, { points: { perBaht: 1, signupBonus: 1600, birthdayBonus: 200, expiryMonths: 12 } });
    const r = await signUp(t.orgId, { verifiedPhone: "0897770006", channel: "WEB", fullName: "เกิด ตุลา", phone: "0897770006", birthday: "1990-10-20", acceptTerms: true, marketing: false });
    const now = fromLocal(2026, 10, 1, 2, 0);
    expect(await queueBirthdays(t.orgId, now)).toBe(1);
    expect(await queueBirthdays(t.orgId, fromLocal(2026, 10, 2, 2, 0))).toBe(0);
    const m = await db(t.orgId).member.findFirstOrThrow({ where: { id: r.member.id } });
    expect(m.points).toBe(1600 + 200);
    const n = await db(t.orgId).notification.findFirstOrThrow({ where: { memberId: r.member.id, kind: "BIRTHDAY" } });
    expect(n.payload).toMatchObject({ bonus: 200, multiplier: 2 });
  });

  it("contact form refuses honestly until someone receives it, then queues one email", async () => {
    await expect(submitContact(t.orgId, { name: "ผู้ติดต่อ", phone: "0812345678", topic: "ฟิตติ้ง", message: "สนใจฟิตติ้งไดรเวอร์" })).rejects.toMatchObject({ code: "UNAVAILABLE" });
    await updateSettings(t.orgId, { redemption: { alertEmails: ["marketing@mst.test"] } });
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "MST Golf <hello@mst.test>";
    await expect(submitContact(t.orgId, { name: "ผู้ติดต่อ", topic: "ฟิตติ้ง", message: "สนใจฟิตติ้ง" })).rejects.toMatchObject({ code: "INVALID_INPUT" }); // no way to reply
    await submitContact(t.orgId, { name: "ผู้ติดต่อ", phone: "0812345678", topic: "ฟิตติ้ง", message: "สนใจฟิตติ้งไดรเวอร์", ip: "2.2.2.2" });
    await submitContact(t.orgId, { name: "bot", phone: "0812345678", topic: "x", message: "spam spam", website: "http://spam" });
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    const msgs = await db(t.orgId).emailMessage.findMany({ where: { kind: "CONTACT" } });
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.to).toEqual(["marketing@mst.test"]);
  });

  it("one requester can't use up a number's daily codes for everyone", async () => {
    const day = (h: number) => new Date(Date.UTC(2026, 9, 13, h, 0, 0));
    for (let i = 0; i < 5; i++) await requestOtp(t.orgId, "0897779999", { ip: "6.6.6.6", now: day(i) });
    await expect(requestOtp(t.orgId, "0897779999", { ip: "6.6.6.6", now: day(6) })).rejects.toMatchObject({ code: "OTP_RATE" });
    await expect(requestOtp(t.orgId, "0897779999", { ip: "7.7.7.7", now: day(7) })).resolves.toMatchObject({ phone: "0897779999" });
  });
});
