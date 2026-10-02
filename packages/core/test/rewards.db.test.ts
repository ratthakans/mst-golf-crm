import { beforeAll, describe, expect, it } from "vitest";
import {
  adjustPoints,
  adjustRewardStock,
  cancelMyRedemption,
  checkCoupon,
  db,
  expireCoupons,
  ledgerDrift,
  processEmails,
  redeemReward,
  rewardCatalogue,
  rewardsReport,
  saveReward,
  signUp,
  updateRedemption,
  updateSettings,
  useCoupon,
} from "../src";
import { makeOrg } from "./fixtures";

let t: Awaited<ReturnType<typeof makeOrg>>;
let memberId: string;
let couponId: string;
let ipadId: string;

const DAY = 24 * 3600_000;
const pickup = (storeId: string) => ({ method: "PICKUP", name: "Reward Tester", phone: "0891234567", storeId });

beforeAll(async () => {
  t = await makeOrg("rewards");
  await updateSettings(t.orgId, { redemption: { alertEmails: ["marketing@mst.test"] } });
  const s = await signUp(t.orgId, { lineUserId: "U-rw-1", channel: "LINE", fullName: "Reward Tester", phone: "0891234567", acceptTerms: true, marketing: false });
  memberId = s.member.id; // 1,600 welcome points
  couponId = (await saveReward(t.orgId, t.actor, null, { kind: "COUPON", name: "คูปอง ฿1,000", costPoints: 500, valueBaht: 1000, minSpendBaht: 5000, validDays: 30, perMemberLimit: 2 })).id;
  ipadId = (await saveReward(t.orgId, t.actor, null, { kind: "PHYSICAL", name: "iPad", costPoints: 1000, stock: 1, fulfilment: "7–14 วัน" })).id;
});

describe("rewards", () => {
  it("shows the catalogue with what the member can and cannot redeem", async () => {
    const c = await rewardCatalogue(t.orgId, memberId);
    expect(c.balance).toBe(1600);
    expect(c.items.map((i) => [i.name, i.blocked])).toEqual([
      ["คูปอง ฿1,000", null],
      ["iPad", null],
    ]);
  });

  it("issues a coupon, takes the points through the ledger, and refuses terms not accepted", async () => {
    await expect(redeemReward(t.orgId, memberId, { rewardId: couponId })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const r = await redeemReward(t.orgId, memberId, { rewardId: couponId, acceptTerms: true });
    expect(r.status).toBe("ISSUED");
    expect(r.code).toMatch(/^RD-\d{6}$/);
    expect(r.couponCode).toMatch(/^MST-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
    expect(r.balance).toBe(1100);
    const tx = await db(t.orgId).pointTransaction.findFirst({ where: { redemptionId: r.id } });
    expect(tx).toMatchObject({ delta: -500, reason: "REDEEM", type: "REDEEM" });
    const n = await db(t.orgId).notification.findFirst({ where: { dedupeKey: `REDEMPTION_RECEIVED:${r.id}` } });
    expect(n).not.toBeNull();
  });

  it("validates a coupon once — a second scan is refused", async () => {
    const issued = await db(t.orgId).redemption.findFirstOrThrow({ where: { memberId, kind: "COUPON" } });
    const typed = issued.couponCode!.toLowerCase().replace(/-/g, " ");
    const check = await checkCoupon(t.orgId, typed);
    expect(check.usable).toBe(true);
    const used = await useCoupon(t.orgId, t.managerActor, { couponCode: typed, storeId: t.storeId, invoiceNo: "INV-1" });
    expect(used.status).toBe("USED");
    expect(used.usedStoreName).toBe("MST Test Store");
    await expect(useCoupon(t.orgId, t.managerActor, { couponCode: issued.couponCode! })).rejects.toMatchObject({ code: "COUPON_STATE" });
  });

  it("enforces the per-member limit and expires coupons without refunding", async () => {
    const second = await redeemReward(t.orgId, memberId, { rewardId: couponId, acceptTerms: true });
    await expect(redeemReward(t.orgId, memberId, { rewardId: couponId, acceptTerms: true })).rejects.toMatchObject({ code: "REWARD_RULE" });
    expect(await expireCoupons(t.orgId, new Date(Date.now() + 31 * DAY))).toBe(1);
    const r = await db(t.orgId).redemption.findFirstOrThrow({ where: { id: second.id } });
    expect(r.status).toBe("EXPIRED");
    const m = await db(t.orgId).member.findFirstOrThrow({ where: { id: memberId } });
    expect(m.points).toBe(600);
  });

  it("refuses when points are short, then takes a physical request with stock and an email to Marketing", async () => {
    await expect(redeemReward(t.orgId, memberId, { rewardId: ipadId, acceptTerms: true, delivery: pickup(t.storeId) })).rejects.toMatchObject({ code: "REWARD_RULE" });
    await adjustPoints(t.orgId, t.actor, { memberId, delta: 1400, note: "test top-up" });
    await expect(redeemReward(t.orgId, memberId, { rewardId: ipadId, acceptTerms: true, delivery: { method: "SHIP", name: "A", phone: "1" } })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const r = await redeemReward(t.orgId, memberId, { rewardId: ipadId, acceptTerms: true, delivery: pickup(t.storeId) });
    expect(r.status).toBe("SUBMITTED");
    const reward = await db(t.orgId).reward.findFirstOrThrow({ where: { id: ipadId } });
    expect(reward.stock).toBe(0);
    const email = await db(t.orgId).emailMessage.findFirstOrThrow({ where: { dedupeKey: `REDEMPTION_REQUEST:${r.id}` } });
    expect(email.to).toEqual(["marketing@mst.test"]);
    expect(JSON.stringify(email.payload)).not.toContain("0891234567"); // no personal details in email

    // Out of stock for the next member.
    const other = await signUp(t.orgId, { lineUserId: "U-rw-2", channel: "LINE", fullName: "Second Member", phone: "0891234500", acceptTerms: true, marketing: false });
    const c = await rewardCatalogue(t.orgId, other.member.id);
    expect(c.items.find((i) => i.id === ipadId)?.blocked).toBe("หมดแล้ว");
  });

  it("walks the status flow, refuses skipped steps, and refunds + restocks on rejection", async () => {
    const r = await db(t.orgId).redemption.findFirstOrThrow({ where: { memberId, kind: "PHYSICAL" } });
    await expect(updateRedemption(t.orgId, t.actor, r.id, { status: "SHIPPED" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await updateRedemption(t.orgId, t.actor, r.id, { status: "UNDER_REVIEW" });
    await expect(updateRedemption(t.orgId, t.actor, r.id, { status: "REJECTED" })).rejects.toMatchObject({ code: "INVALID_INPUT" }); // needs a reason
    const before = (await db(t.orgId).member.findFirstOrThrow({ where: { id: memberId } })).points;
    await updateRedemption(t.orgId, t.actor, r.id, { status: "REJECTED", note: "สินค้าหมด" });
    const after = await db(t.orgId).member.findFirstOrThrow({ where: { id: memberId } });
    expect(after.points).toBe(before + 1000);
    expect((await db(t.orgId).reward.findFirstOrThrow({ where: { id: ipadId } })).stock).toBe(1);
    const done = await db(t.orgId).redemption.findFirstOrThrow({ where: { id: r.id } });
    expect((done.history as unknown[]).length).toBe(3);
    const msg = await db(t.orgId).notification.findFirst({ where: { dedupeKey: `REDEMPTION_STATUS:${r.id}:REJECTED` } });
    expect(msg).not.toBeNull();
  });

  it("lets the member cancel only before review, and ships only with a tracking number", async () => {
    const a = await redeemReward(t.orgId, memberId, { rewardId: ipadId, acceptTerms: true, delivery: { method: "SHIP", name: "Reward Tester", phone: "0891234567", address: "99/1 Sukhumvit Road, Bangkok 10110" } });
    await cancelMyRedemption(t.orgId, memberId, a.id);
    const b = await redeemReward(t.orgId, memberId, { rewardId: ipadId, acceptTerms: true, delivery: { method: "SHIP", name: "Reward Tester", phone: "0891234567", address: "99/1 Sukhumvit Road, Bangkok 10110" } });
    await updateRedemption(t.orgId, t.actor, b.id, { status: "APPROVED" });
    await expect(cancelMyRedemption(t.orgId, memberId, b.id)).rejects.toMatchObject({ code: "COUPON_STATE" });
    await expect(updateRedemption(t.orgId, t.actor, b.id, { status: "SHIPPED" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await updateRedemption(t.orgId, t.actor, b.id, { status: "SHIPPED", carrier: "Kerry", trackingNo: "KER123" });
    await updateRedemption(t.orgId, t.actor, b.id, { status: "COMPLETED" });
    const done = await db(t.orgId).redemption.findFirstOrThrow({ where: { id: b.id } });
    expect(done).toMatchObject({ status: "COMPLETED", trackingNo: "KER123", ownerId: (t.actor as { userId: string }).userId });
  });

  it("keeps the ledger and the balance in step, and reports earn/burn", async () => {
    expect(await ledgerDrift(t.orgId)).toEqual([]);
    const rep = await rewardsReport(t.orgId, new Date(Date.now() - DAY), new Date(Date.now() + DAY));
    expect(rep.couponsIssued).toBe(2);
    expect(rep.couponsUsed).toBe(1);
    expect(rep.couponUseRate).toBe(0.5);
    expect(rep.pointsRedeemed).toBe(500 + 500 + 1000); // two coupons + the completed iPad; rejected and cancelled refunded
  });

  it("skips email until the mail service is configured, then sends with an idempotency key", async () => {
    delete process.env.RESEND_API_KEY;
    const skipped = await processEmails({ fetchImpl: async () => new Response("{}") });
    expect(skipped.skipped).toBeGreaterThan(0);
    await adjustRewardStock(t.orgId, t.actor, ipadId, 1, "restock");
    const r = await redeemReward(t.orgId, memberId, { rewardId: ipadId, acceptTerms: true, delivery: pickup(t.storeId) });
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "MST Golf <rewards@mst.test>";
    const keys: string[] = [];
    const sent = await processEmails({
      fetchImpl: async (_u, init) => {
        keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
        return new Response("{}");
      },
    });
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    expect(sent.sent).toBeGreaterThanOrEqual(1);
    const email = await db(t.orgId).emailMessage.findFirstOrThrow({ where: { dedupeKey: `REDEMPTION_REQUEST:${r.id}` } });
    expect(email.status).toBe("SENT");
    expect(keys).toContain(email.id);
  });
});
