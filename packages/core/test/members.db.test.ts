import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@mstgolf/database";
import { adjustPoints, createMemberAtCounter, eraseMember, ledgerDrift, mergeMembers, signUp, updateOwnProfile, db } from "../src";
import { makeOrg } from "./fixtures";

let t: Awaited<ReturnType<typeof makeOrg>>;
beforeAll(async () => {
  t = await makeOrg("members");
});

describe("sign-up", () => {
  it("creates a member with a code, both identities, consents and 1,600 welcome points", async () => {
    const r = await signUp(t.orgId, { lineUserId: "U-new-1", channel: "LINE", fullName: "นภัส ศรีวงศ์", phone: "089-111-2233", acceptTerms: true, marketing: true });
    expect(r.outcome).toBe("created");
    expect(r.member.code).toMatch(/^MST\d{8}$/);
    expect(r.member.points).toBe(1600);
    expect(r.member.phone).toBe("0891112233");
    expect(r.member.phoneVerified).toBe(false);
    expect(r.member.hasLine).toBe(true);
    expect(r.member.marketingConsent).toBe(true);
    const consents = await db(t.orgId).consent.count({ where: { memberId: r.member.id } });
    expect(consents).toBe(2);
    const welcome = await db(t.orgId).notification.count({ where: { memberId: r.member.id, kind: "WELCOME" } });
    expect(welcome).toBe(1);
  });

  it("refuses the same LINE account twice", async () => {
    await expect(signUp(t.orgId, { lineUserId: "U-new-1", channel: "WEB", fullName: "Someone Else", phone: "0891112299", acceptTerms: true, marketing: false })).rejects.toMatchObject({ code: "ALREADY_MEMBER" });
  });

  it("requires the terms", async () => {
    await expect(signUp(t.orgId, { lineUserId: "U-x", channel: "LINE", fullName: "A B", phone: "0891112200", acceptTerms: false, marketing: false })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("links LINE to a counter-created member with the same phone — no second welcome bonus", async () => {
    const counter = await createMemberAtCounter(t.orgId, t.actor, { fullName: "ธนา รุ่งเรือง", phone: "0865554433", consentConfirmed: true, marketing: false });
    expect(counter.welcomePoints).toBe(1600);
    const linked = await signUp(t.orgId, { lineUserId: "U-dana", channel: "LINE", fullName: "ธนา รุ่งเรือง", phone: "086 555 4433", acceptTerms: true, marketing: true });
    expect(linked.outcome).toBe("linked");
    expect(linked.member.id).toBe(counter.member.id);
    expect(linked.member.points).toBe(1600);
    expect(linked.welcomePoints).toBe(0);
  });

  it("never hands a phone owned by another LINE account to a new one", async () => {
    await expect(signUp(t.orgId, { lineUserId: "U-thief", channel: "LINE", fullName: "Other Person", phone: "0891112233", acceptTerms: true, marketing: false })).rejects.toMatchObject({ code: "PHONE_TAKEN" });
    const reviews = await db(t.orgId).reviewItem.count({ where: { kind: "PHONE_CONFLICT", status: "OPEN" } });
    expect(reviews).toBe(1);
  });

  it("counter sign-up refuses an existing phone and points to the member", async () => {
    await expect(createMemberAtCounter(t.orgId, t.actor, { fullName: "X Y", phone: "0891112233", consentConfirmed: true, marketing: false })).rejects.toMatchObject({ code: "PHONE_TAKEN" });
  });

  it("birthday can be set once by the member", async () => {
    const r = await signUp(t.orgId, { lineUserId: "U-bday", channel: "LINE", fullName: "Birth Day", phone: "0812223344", acceptTerms: true, marketing: false });
    await updateOwnProfile(t.orgId, r.member.id, { birthday: "1990-10-05" });
    await expect(updateOwnProfile(t.orgId, r.member.id, { birthday: "1990-11-05" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const again = await updateOwnProfile(t.orgId, r.member.id, { birthday: "1990-10-05", fullName: "Birth Day Two" });
    expect(again.displayName).toBe("Birth Day Two");
  });
});

describe("points adjustments", () => {
  it("caps store managers at ±1,000 and records who and why", async () => {
    const m = await createMemberAtCounter(t.orgId, t.actor, { fullName: "Adjust Me", phone: "0823334455", consentConfirmed: true, marketing: false });
    await expect(adjustPoints(t.orgId, t.managerActor, { memberId: m.member.id, delta: 1500, note: "test" })).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
    await expect(adjustPoints(t.orgId, t.managerActor, { memberId: m.member.id, delta: 100, note: "" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const r = await adjustPoints(t.orgId, t.managerActor, { memberId: m.member.id, delta: -300, note: "แก้บิลผิด" });
    expect(r.points).toBe(1300);
    const audit = await db(t.orgId).auditLog.findFirst({ where: { action: "points.adjust", entityId: m.member.id } });
    expect(audit?.reason).toBe("แก้บิลผิด");
  });
});

describe("merge and erase", () => {
  it("merges a duplicate into the older member without a second welcome bonus", async () => {
    const a = await createMemberAtCounter(t.orgId, t.actor, { fullName: "Dup One", phone: "0834445566", consentConfirmed: true, marketing: false });
    const b = await signUp(t.orgId, { lineUserId: "U-dup", channel: "LINE", fullName: "Dup One", phone: "0934445566", acceptTerms: true, marketing: false });
    await adjustPoints(t.orgId, t.actor, { memberId: b.member.id, delta: 500, note: "promo" });
    const merged = await mergeMembers(t.orgId, t.actor, { survivorId: a.member.id, mergedId: b.member.id, reason: "ลูกค้าคนเดียวกัน" });
    expect(merged.points).toBe(1600 + 500);
    expect(merged.hasLine).toBe(true);
    const gone = await prisma.member.findUnique({ where: { id: b.member.id } });
    expect(gone?.status).toBe("MERGED");
    expect(gone?.points).toBe(0);
  });

  it("erases personal data but keeps the ledger consistent", async () => {
    const m = await signUp(t.orgId, { lineUserId: "U-erase", channel: "LINE", fullName: "Forget Me", phone: "0945556677", acceptTerms: true, marketing: false, email: "me@example.com" });
    await eraseMember(t.orgId, t.actor, m.member.id, "ลูกค้าขอลบ");
    const row = await prisma.member.findUnique({ where: { id: m.member.id }, include: { identities: true } });
    expect(row?.status).toBe("ERASED");
    expect(row?.email).toBeNull();
    expect(row?.identities).toHaveLength(0);
    // the phone can sign up again as a new person
    const again = await signUp(t.orgId, { lineUserId: "U-erase-2", channel: "LINE", fullName: "New Person", phone: "0945556677", acceptTerms: true, marketing: false });
    expect(again.outcome).toBe("created");
  });

  it("ledger sums equal every cached balance", async () => {
    expect(await ledgerDrift(t.orgId)).toEqual([]);
  });
});
