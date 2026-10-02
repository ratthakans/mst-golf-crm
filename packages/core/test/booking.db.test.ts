import { beforeAll, describe, expect, it } from "vitest";
import {
  availability,
  blockLane,
  cancelByMember,
  checkIn,
  confirmHold,
  createMemberAtCounter,
  db,
  fromLocal,
  holdSlot,
  localDateKey,
  markNoShow,
  memberBookings,
  moveBooking,
  queueReminders,
  signUp,
  staffCreateBooking,
} from "../src";
import { makeOrg } from "./fixtures";

let t: Awaited<ReturnType<typeof makeOrg>>;
const members: string[] = [];
// "now" is fixed: Thu 1 Oct 2026 09:00 Bangkok
const now = fromLocal(2026, 10, 1, 9, 0);
const at = (day: number, hour: number) => fromLocal(2026, 10, day, hour, 0).toISOString();

beforeAll(async () => {
  t = await makeOrg("booking");
  for (let i = 0; i < 20; i++) {
    const r = await signUp(t.orgId, { lineUserId: `U-b-${i}`, channel: "LINE", fullName: `Golfer ${i}`, phone: `08900000${String(i).padStart(2, "0")}`, acceptTerms: true, marketing: false });
    members.push(r.member.id);
  }
});

describe("booking", () => {
  it("20 customers tapping the same slot at once: exactly one holds it", async () => {
    const results = await Promise.allSettled(
      members.map((memberId) => holdSlot(t.orgId, { memberId, laneId: t.lanes[1]!.id, startAt: at(1, 18), partySize: 3, source: "LINE" }, now)),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(1);
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => r.reason.code);
    expect(new Set(failures)).toEqual(new Set(["SLOT_TAKEN"]));
  });

  it("hold → confirm queues a LINE confirmation; an expired hold cannot be confirmed", async () => {
    const m = members[1]!;
    const held = await holdSlot(t.orgId, { memberId: m, laneId: t.lanes[0]!.id, startAt: at(2, 17), partySize: 2, source: "WEB" }, now);
    expect(held.status).toBe("HELD");
    expect(held.priceSatang).toBe(100_000);
    const confirmed = await confirmHold(t.orgId, m, held.id, now);
    expect(confirmed.status).toBe("CONFIRMED");
    expect(await db(t.orgId).notification.count({ where: { memberId: m, kind: "BOOKING_CONFIRMED" } })).toBe(1);

    const late = await holdSlot(t.orgId, { memberId: members[2]!, laneId: t.lanes[0]!.id, startAt: at(2, 18), partySize: 1, source: "LINE" }, now);
    await expect(confirmHold(t.orgId, members[2]!, late.id, new Date(now.getTime() + 6 * 60_000))).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
    // someone else can take the slot once the hold lapsed
    const other = await holdSlot(t.orgId, { memberId: members[3]!, laneId: t.lanes[0]!.id, startAt: at(2, 18), partySize: 1, source: "LINE" }, new Date(now.getTime() + 6 * 60_000));
    expect(other.status).toBe("HELD");
  });

  it("enforces the rules: 14 days ahead, 2 per day, opening hours, lane capacity", async () => {
    const m = members[4]!;
    await expect(holdSlot(t.orgId, { memberId: m, laneId: t.lanes[2]!.id, startAt: at(20, 12), partySize: 1, source: "LINE" }, now)).rejects.toMatchObject({ code: "BOOKING_RULE" });
    await expect(holdSlot(t.orgId, { memberId: m, laneId: t.lanes[2]!.id, startAt: at(3, 23), partySize: 1, source: "LINE" }, now)).rejects.toMatchObject({ code: "BOOKING_RULE" });
    await expect(holdSlot(t.orgId, { memberId: m, laneId: t.lanes[2]!.id, startAt: at(3, 12), partySize: 4, source: "LINE" }, now)).rejects.toMatchObject({ code: "BOOKING_RULE" });
    for (const h of [12, 13]) {
      const b = await holdSlot(t.orgId, { memberId: m, laneId: t.lanes[2]!.id, startAt: at(3, h), partySize: 1, source: "LINE" }, now);
      await confirmHold(t.orgId, m, b.id, now);
    }
    await expect(holdSlot(t.orgId, { memberId: m, laneId: t.lanes[2]!.id, startAt: at(3, 14), partySize: 1, source: "LINE" }, now)).rejects.toMatchObject({ code: "BOOKING_RULE" });
  });

  it("availability hides who booked and marks taken / past / blocked slots", async () => {
    await blockLane(t.orgId, t.actor, { laneId: t.lanes[2]!.id, startAt: at(2, 20), endAt: at(2, 22), reason: "MAINTENANCE" });
    const a = await availability(t.orgId, localDateKey(new Date(at(2, 12))), now);
    const slot = (h: number) => a.slots.find((s) => s.startAt === at(2, h))!;
    expect(slot(17).lanes[0]!.state).toBe("taken");
    expect(slot(20).lanes[2]!.state).toBe("blocked");
    expect(slot(10).lanes[1]!.state).toBe("free");
    expect(a.slots).toHaveLength(12);
    await expect(blockLane(t.orgId, t.actor, { laneId: t.lanes[0]!.id, startAt: at(2, 16), endAt: at(2, 19), reason: "EVENT" })).rejects.toMatchObject({ code: "BOOKING_RULE" });
  });

  it("members cancel up to 2 hours before; later they must call", async () => {
    const m = members[5]!;
    const b = await holdSlot(t.orgId, { memberId: m, laneId: t.lanes[1]!.id, startAt: at(1, 11), partySize: 1, source: "LINE" }, now);
    await confirmHold(t.orgId, m, b.id, now);
    await expect(cancelByMember(t.orgId, m, b.id, fromLocal(2026, 10, 1, 9, 30))).rejects.toMatchObject({ code: "BOOKING_RULE" });
    const b2 = await holdSlot(t.orgId, { memberId: m, laneId: t.lanes[1]!.id, startAt: at(1, 15), partySize: 1, source: "LINE" }, now);
    await confirmHold(t.orgId, m, b2.id, now);
    const c = await cancelByMember(t.orgId, m, b2.id, now);
    expect(c.status).toBe("CANCELLED");
    const mine = await memberBookings(t.orgId, m, now);
    expect(mine.upcoming.map((x) => x.id)).toEqual([b.id]);
  });

  it("staff: walk-in by phone links the member, move refuses a taken slot, check-in and no-show", async () => {
    const counter = await createMemberAtCounter(t.orgId, t.actor, { fullName: "Walk In", phone: "0870001111", consentConfirmed: true, marketing: false });
    const w = await staffCreateBooking(t.orgId, t.actor, { laneId: t.lanes[0]!.id, startAt: at(1, 10), partySize: 2, source: "WALKIN", guestName: "Walk In", guestPhone: "087-000-1111", checkInNow: true }, fromLocal(2026, 10, 1, 10, 5));
    expect(w.memberId).toBe(counter.member.id);
    expect(w.status).toBe("CHECKED_IN");
    const phone = await staffCreateBooking(t.orgId, t.actor, { laneId: t.lanes[0]!.id, startAt: at(1, 19), partySize: 1, source: "PHONE", guestName: "โทรจอง" }, now);
    // Its own blocker: the race test's winner is random and may be released by a later test.
    await staffCreateBooking(t.orgId, t.actor, { laneId: t.lanes[1]!.id, startAt: at(1, 20), partySize: 1, source: "PHONE", guestName: "จองไว้ก่อน" }, now);
    await expect(moveBooking(t.orgId, t.actor, phone.id, { laneId: t.lanes[1]!.id, startAt: at(1, 20) }, now)).rejects.toMatchObject({ code: "SLOT_TAKEN" });
    const moved = await moveBooking(t.orgId, t.actor, phone.id, { laneId: t.lanes[2]!.id, startAt: at(1, 18) }, now);
    expect(moved.laneName).toBe("Lane 3");
    await expect(markNoShow(t.orgId, t.actor, moved.id, fromLocal(2026, 10, 1, 18, 5))).rejects.toMatchObject({ code: "BOOKING_RULE" });
    const ns = await markNoShow(t.orgId, t.actor, moved.id, fromLocal(2026, 10, 1, 18, 20));
    expect(ns.status).toBe("NO_SHOW");
    const ci = await checkIn(t.orgId, t.actor, w.id, 100_000, fromLocal(2026, 10, 1, 10, 6));
    expect(ci.paidSatang).toBe(100_000);
  });

  it("queues one reminder 2 hours before, never twice", async () => {
    const reminderTime = fromLocal(2026, 10, 2, 15, 30); // booking at 17:00 on the 2nd was made on the 1st
    // createdAt comes from the database clock; pin it to the test's "now" so the test doesn't depend on today's date.
    await db(t.orgId).booking.updateMany({ data: { createdAt: now } });
    expect(await queueReminders(t.orgId, reminderTime)).toBe(1);
    expect(await queueReminders(t.orgId, reminderTime)).toBe(0);
  });
});
