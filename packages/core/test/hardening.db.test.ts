import { beforeAll, describe, expect, it } from "vitest";
import {
  adjustPoints,
  assertUnderLimit,
  cancelByStaff,
  clearHits,
  createMemberAtCounter,
  db,
  fromLocal,
  getOrg,
  mergeMembers,
  recordHit,
  staffCreateBooking,
  takeHit,
  updateSettings,
} from "../src";
import { makeOrg } from "./fixtures";

// The concurrency and abuse fixes from the 13 Oct 2026 code review.
let t: Awaited<ReturnType<typeof makeOrg>>;
beforeAll(async () => {
  t = await makeOrg("hardening");
});

describe("durable rate limits", () => {
  it("refuses once a key reaches its limit, and clearing resets it", async () => {
    const limits = [{ key: "a@x.test", max: 3, windowMs: 60_000 }];
    for (let i = 0; i < 3; i++) await takeHit(t.orgId, "t_bucket", limits, "ช้าลงหน่อย");
    await expect(takeHit(t.orgId, "t_bucket", limits, "ช้าลงหน่อย")).rejects.toMatchObject({ code: "OTP_RATE", status: 429 });
    await clearHits(t.orgId, "t_bucket", "a@x.test");
    await expect(assertUnderLimit(t.orgId, "t_bucket", limits, "x")).resolves.toBeUndefined();
  });

  it("counts per key and ignores a missing key", async () => {
    await recordHit(t.orgId, "t_ip", ["1.1.1.1", null]);
    await expect(assertUnderLimit(t.orgId, "t_ip", [{ key: "1.1.1.1", max: 1, windowMs: 60_000 }], "x")).rejects.toMatchObject({ code: "OTP_RATE" });
    await expect(assertUnderLimit(t.orgId, "t_ip", [{ key: "2.2.2.2", max: 1, windowMs: 60_000 }, { key: null, max: 0, windowMs: 1 }], "x")).resolves.toBeUndefined();
  });
});

describe("settings", () => {
  it("parallel saves of different sections both survive", async () => {
    await Promise.all([
      updateSettings(t.orgId, (cur) => ({ features: { ...(cur.features ?? {}), rewards: false } as never })),
      updateSettings(t.orgId, (cur) => ({ site: { ...(cur.site ?? {}), phone: "02-111-2222" } })),
    ]);
    const { settings } = await getOrg(t.orgId);
    expect(settings.features.rewards).toBe(false);
    expect(settings.site.phone).toBe("02-111-2222");
  });
});

describe("points", () => {
  it("a staff deduction can't take the balance below zero", async () => {
    const m = await createMemberAtCounter(t.orgId, t.actor, { fullName: "หัก แต้ม", phone: "0861110001", consentConfirmed: true, marketing: false });
    const balance = (await db(t.orgId).member.findFirst({ where: { id: m.member.id } }))!.points;
    await expect(adjustPoints(t.orgId, t.actor, { memberId: m.member.id, delta: -(balance + 1), note: "ทดสอบ" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(adjustPoints(t.orgId, t.actor, { memberId: m.member.id, delta: -balance, note: "ทดสอบ" })).resolves.toEqual({ points: 0 });
  });

  it("merge moves the ledger balance, and parallel merges of the same pair apply once", async () => {
    const a = await createMemberAtCounter(t.orgId, t.actor, { fullName: "คน หลัก", phone: "0861110002", consentConfirmed: true, marketing: false });
    const b = await createMemberAtCounter(t.orgId, t.actor, { fullName: "คน รอง", phone: "0861110003", consentConfirmed: true, marketing: false });
    await adjustPoints(t.orgId, t.actor, { memberId: b.member.id, delta: 500, note: "ยกมา" });
    const results = await Promise.allSettled([
      mergeMembers(t.orgId, t.actor, { survivorId: a.member.id, mergedId: b.member.id, reason: "ซ้ำ" }),
      mergeMembers(t.orgId, t.actor, { survivorId: a.member.id, mergedId: b.member.id, reason: "ซ้ำ" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const client = db(t.orgId);
    const sum = async (id: string) => (await client.pointTransaction.aggregate({ where: { memberId: id }, _sum: { delta: true } }))._sum.delta ?? 0;
    const [sa, sb] = await Promise.all([sum(a.member.id), sum(b.member.id)]);
    expect(sb).toBe(0);
    const cachedA = (await client.member.findFirst({ where: { id: a.member.id } }))!.points;
    expect(cachedA).toBe(sa); // cache and ledger agree
  });
});

describe("booking status changes", () => {
  it("two staff cancelling the same booking at once: one wins, the other is told it already changed", async () => {
    const now = fromLocal(2026, 10, 1, 9, 0);
    const b = await staffCreateBooking(
      t.orgId,
      t.actor,
      { laneId: t.lanes[0]!.id, startAt: fromLocal(2026, 10, 2, 15, 0).toISOString(), partySize: 1, source: "PHONE", guestName: "โทรจอง" },
      now,
    );
    const results = await Promise.allSettled([
      cancelByStaff(t.orgId, t.actor, b.id, "ลูกค้าแจ้ง", now),
      cancelByStaff(t.orgId, t.actor, b.id, "ลูกค้าแจ้ง", now),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "BOOKING_RULE" } });
  });
});
