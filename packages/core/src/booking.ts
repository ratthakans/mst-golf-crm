import type { BlockReason, BookingSource, BookingStatus, Prisma } from "@mstgolf/database";
import type { OpenHours } from "@mstgolf/shared";
import { normalizeThaiMobile } from "@mstgolf/shared/phone";
import { findTier, lowestTier } from "@mstgolf/shared/tiers";
import { writeAudit } from "./audit";
import type { Actor } from "./context";
import { db, inTx, type Tx } from "./db";
import { CoreError, isUniqueViolation } from "./errors";
import { recordEvent } from "./events";
import { enqueue } from "./notify/outbox";
import { getOrg, type ResolvedSettings } from "./settings";
import { addDays, formatHm, localDateKey, openWindow, parseDateKey, startOfLocalDay } from "./time";

// Golf simulator booking (docs/PRODUCT.md §5). One booking = one lane for one
// hour. A partial unique index on (laneId, startAt) for HELD/CONFIRMED/
// CHECKED_IN makes a double booking impossible at the database, however many
// customers and staff tap at once.

const ACTIVE: BookingStatus[] = ["HELD", "CONFIRMED", "CHECKED_IN"];
const HOUR = 60 * 60_000;

export type SlotState = "free" | "taken" | "blocked" | "past" | "closed";

export interface LaneInfo {
  id: string;
  name: string;
  capacity: number;
  hourlyPriceSatang: number;
}

export interface Availability {
  date: string;
  open: boolean;
  lanes: LaneInfo[];
  slots: Array<{ startAt: string; label: string; lanes: Array<{ laneId: string; state: SlotState }> }>;
}

export interface BookingView {
  id: string;
  laneId: string;
  laneName: string;
  startAt: Date;
  endAt: Date;
  partySize: number;
  status: BookingStatus;
  source: BookingSource;
  heldUntil: Date | null;
  priceSatang: number;
  discountPct: number;
  paidSatang: number | null;
  note: string | null;
  memberId: string | null;
  memberCode: string | null;
  name: string;
  phone: string | null;
  tier: string | null;
  checkedInAt: Date | null;
  cancelReason: string | null;
  canCancel: boolean; // for the member, under the self-cancel rule
}

// ---------------------------------------------------------------------------
// Lanes and the store
// ---------------------------------------------------------------------------

async function bookingStore(client: Tx) {
  const store = await client.store.findFirst({ where: { isActive: true, lanes: { some: { isActive: true } } }, orderBy: { createdAt: "asc" } });
  if (!store) throw new CoreError("NOT_FOUND", "ยังไม่ได้ตั้งค่า lane ซิมกอล์ฟ");
  return store;
}

export async function listLanes(orgId: string): Promise<LaneInfo[]> {
  const lanes = await db(orgId).lane.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return lanes.map((l) => ({ id: l.id, name: l.name, capacity: l.capacity, hourlyPriceSatang: l.hourlyPriceSatang }));
}

/** Hour slots of a local day within opening hours, as start instants. */
export function daySlots(day: Date, hours: OpenHours, slotMinutes = 60): Date[] {
  const win = openWindow(day, hours);
  if (!win) return [];
  const [open, close] = win;
  const step = slotMinutes * 60_000;
  const first = Math.ceil(open.getTime() / step) * step;
  const out: Date[] = [];
  for (let t = first; t + step <= close.getTime(); t += step) out.push(new Date(t));
  return out;
}

function withinOpening(startAt: Date, hours: OpenHours, slotMinutes: number): boolean {
  return daySlots(startOfLocalDay(startAt), hours, slotMinutes).some((s) => s.getTime() === startAt.getTime());
}

// ---------------------------------------------------------------------------
// Availability (customer view — never says who booked)
// ---------------------------------------------------------------------------

export async function availability(orgId: string, dateKey: string, now = new Date()): Promise<Availability> {
  const day = parseDateKey(dateKey);
  if (!day) throw new CoreError("INVALID_INPUT", "วันที่ไม่ถูกต้อง");
  const { settings } = await getOrg(orgId);
  const client = db(orgId);
  const store = await bookingStore(client);
  const lanes = await listLanes(orgId);
  const hours = store.openHours as OpenHours;
  const slots = daySlots(day, hours, settings.booking.slotMinutes);
  const dayEnd = addDays(day, 1);
  const [bookings, blocks] = await Promise.all([
    client.booking.findMany({
      where: { startAt: { gte: day, lt: dayEnd }, status: { in: ACTIVE } },
      select: { laneId: true, startAt: true, status: true, heldUntil: true },
    }),
    client.laneBlock.findMany({ where: { startAt: { lt: dayEnd }, endAt: { gt: day } }, select: { laneId: true, startAt: true, endAt: true } }),
  ]);
  const taken = new Set(
    bookings
      .filter((b) => b.status !== "HELD" || (b.heldUntil && b.heldUntil > now))
      .map((b) => `${b.laneId}|${b.startAt.getTime()}`),
  );
  const slotMs = settings.booking.slotMinutes * 60_000;
  return {
    date: dateKey,
    open: slots.length > 0,
    lanes,
    slots: slots.map((s) => ({
      startAt: s.toISOString(),
      label: formatHm(s),
      lanes: lanes.map((l) => {
        let state: SlotState = "free";
        if (s.getTime() <= now.getTime()) state = "past";
        else if (blocks.some((b) => b.laneId === l.id && b.startAt.getTime() < s.getTime() + slotMs && b.endAt.getTime() > s.getTime())) state = "blocked";
        else if (taken.has(`${l.id}|${s.getTime()}`)) state = "taken";
        return { laneId: l.id, state };
      }),
    })),
  };
}

// ---------------------------------------------------------------------------
// Price and rules
// ---------------------------------------------------------------------------

export function priceFor(hourlySatang: number, slotMinutes: number, discountPct: number): number {
  const full = Math.round((hourlySatang * slotMinutes) / 60);
  return Math.round((full * (100 - discountPct)) / 100);
}

function tierOf(settings: ResolvedSettings, tierKey: string | null | undefined) {
  return findTier(tierKey, settings.tiers) ?? lowestTier(settings.tiers);
}

async function assertSlotBookable(tx: Tx, laneId: string, startAt: Date, slotMinutes: number, now: Date, excludeBookingId?: string) {
  const endAt = new Date(startAt.getTime() + slotMinutes * 60_000);
  const block = await tx.laneBlock.findFirst({ where: { laneId, startAt: { lt: endAt }, endAt: { gt: startAt } } });
  if (block) throw new CoreError("SLOT_UNAVAILABLE", "lane นี้ปิดในช่วงเวลานั้น");
  // Release an expired hold on this slot so the index lets the new row in.
  await tx.booking.updateMany({
    where: { laneId, startAt, status: "HELD", heldUntil: { lte: now }, ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}) },
    data: { status: "CANCELLED", cancelReason: "หมดเวลายืนยัน" },
  });
  return endAt;
}

// ---------------------------------------------------------------------------
// Customer flow: hold → confirm, cancel
// ---------------------------------------------------------------------------

export interface HoldInput {
  memberId: string;
  laneId: string;
  startAt: string; // ISO
  partySize: number;
  source: "LINE" | "WEB";
}

export async function holdSlot(orgId: string, input: HoldInput, now = new Date()): Promise<BookingView> {
  const { settings } = await getOrg(orgId);
  const rules = settings.booking;
  const startAt = new Date(input.startAt);
  if (Number.isNaN(startAt.getTime())) throw new CoreError("INVALID_INPUT", "เวลาไม่ถูกต้อง");
  try {
    return await inTx(orgId, async (tx) => {
      const member = await tx.member.findFirst({ where: { id: input.memberId, status: "ACTIVE" } });
      if (!member) throw new CoreError("MEMBER_INACTIVE", "ต้องเป็นสมาชิกก่อนจอง");
      const lane = await tx.lane.findFirst({ where: { id: input.laneId, isActive: true }, include: { store: true } });
      if (!lane) throw new CoreError("NOT_FOUND", "ไม่พบ lane");
      const party = Math.trunc(input.partySize);
      if (party < 1 || party > lane.capacity) throw new CoreError("BOOKING_RULE", `จำนวนคนต่อ lane 1–${lane.capacity} คน`);
      if (startAt.getTime() <= now.getTime()) throw new CoreError("BOOKING_RULE", "ช่องเวลานี้ผ่านไปแล้ว");
      if (!withinOpening(startAt, lane.store.openHours as OpenHours, rules.slotMinutes)) throw new CoreError("BOOKING_RULE", "ช่องเวลานี้อยู่นอกเวลาเปิดร้าน");

      const tier = tierOf(settings, member.tier);
      const lastDay = addDays(startOfLocalDay(now), tier.benefits.simBookingDaysAhead + 1);
      if (startAt >= lastDay) throw new CoreError("BOOKING_RULE", `ระดับ ${tier.name} จองล่วงหน้าได้ ${tier.benefits.simBookingDaysAhead} วัน`);

      // A new hold replaces any hold this member left unfinished.
      await tx.booking.updateMany({
        where: { memberId: member.id, status: "HELD" },
        data: { status: "CANCELLED", cancelReason: "เลือกช่องใหม่" },
      });
      const liveOwn: Prisma.BookingWhereInput = {
        memberId: member.id,
        OR: [{ status: "CONFIRMED" }, { status: "HELD", heldUntil: { gt: now } }],
      };
      const dayStart = startOfLocalDay(startAt);
      const sameDay = await tx.booking.count({ where: { ...liveOwn, startAt: { gte: dayStart, lt: addDays(dayStart, 1) } } });
      if (sameDay >= rules.maxSlotsPerDay) throw new CoreError("BOOKING_RULE", `จองได้ไม่เกิน ${rules.maxSlotsPerDay} ช่องต่อวัน`);
      const upcoming = await tx.booking.count({ where: { ...liveOwn, startAt: { gt: now } } });
      if (upcoming >= rules.maxUpcoming) throw new CoreError("BOOKING_RULE", `มีการจองที่ยังไม่ถึงเวลาได้สูงสุด ${rules.maxUpcoming} รายการ`);

      const endAt = await assertSlotBookable(tx, lane.id, startAt, rules.slotMinutes, now);
      const discountPct = tier.benefits.simDiscountPct;
      const booking = await tx.booking.create({
        data: {
          orgId,
          laneId: lane.id,
          memberId: member.id,
          startAt,
          endAt,
          partySize: party,
          status: "HELD",
          heldUntil: new Date(now.getTime() + rules.holdMinutes * 60_000),
          source: input.source,
          priceSatang: priceFor(lane.hourlyPriceSatang, rules.slotMinutes, discountPct),
          discountPct,
        },
      });
      return (await viewById(tx, settings, booking.id, now))!;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new CoreError("SLOT_TAKEN", "มีคนจองช่องนี้ไปแล้ว กรุณาเลือกช่องอื่น");
    throw e;
  }
}

export async function confirmHold(orgId: string, memberId: string, bookingId: string, now = new Date()): Promise<BookingView> {
  const { settings } = await getOrg(orgId);
  return inTx(orgId, async (tx) => {
    const b = await tx.booking.findFirst({ where: { id: bookingId, memberId }, include: { lane: true } });
    if (!b) throw new CoreError("NOT_FOUND", "ไม่พบการจอง");
    if (b.status === "CONFIRMED") return (await viewById(tx, settings, b.id, now))!;
    if (b.status !== "HELD" || !b.heldUntil || b.heldUntil <= now) {
      throw new CoreError("HOLD_EXPIRED", "หมดเวลายืนยัน ช่องนี้หลุดแล้ว กรุณาเลือกใหม่");
    }
    const done = await tx.booking.updateMany({ where: { id: b.id, status: "HELD" }, data: { status: "CONFIRMED", heldUntil: null } });
    if (done.count !== 1) throw new CoreError("HOLD_EXPIRED", "หมดเวลายืนยัน กรุณาเลือกใหม่");
    await recordEvent(tx, orgId, memberId, "BOOKING_CREATED", { bookingId: b.id, laneId: b.laneId, startAt: b.startAt.toISOString(), source: b.source });
    await enqueue(tx, orgId, [bookingMessage("BOOKING_CONFIRMED", b.id, memberId, b.lane.name, b)]);
    return (await viewById(tx, settings, b.id, now))!;
  });
}

export async function releaseHold(orgId: string, memberId: string, bookingId: string): Promise<void> {
  await db(orgId).booking.updateMany({
    where: { id: bookingId, memberId, status: "HELD" },
    data: { status: "CANCELLED", cancelReason: "ยกเลิกก่อนยืนยัน" },
  });
}

export async function cancelByMember(orgId: string, memberId: string, bookingId: string, now = new Date()): Promise<BookingView> {
  const { settings } = await getOrg(orgId);
  return inTx(orgId, async (tx) => {
    const b = await tx.booking.findFirst({ where: { id: bookingId, memberId }, include: { lane: true } });
    if (!b) throw new CoreError("NOT_FOUND", "ไม่พบการจอง");
    if (b.status !== "CONFIRMED") throw new CoreError("BOOKING_RULE", "การจองนี้ยกเลิกไม่ได้");
    if (b.startAt.getTime() - now.getTime() < settings.booking.cancelHoursBefore * HOUR) {
      throw new CoreError("BOOKING_RULE", `ยกเลิกเองได้ก่อนเวลาจอง ${settings.booking.cancelHoursBefore} ชั่วโมง — กรุณาติดต่อร้าน`);
    }
    await tx.booking.update({ where: { id: b.id }, data: { status: "CANCELLED", cancelReason: "ลูกค้ายกเลิกเอง" } });
    await recordEvent(tx, orgId, memberId, "BOOKING_CANCELLED", { bookingId: b.id, by: "member" });
    await enqueue(tx, orgId, [bookingMessage("BOOKING_CANCELLED", b.id, memberId, b.lane.name, b, { reason: null })]);
    return (await viewById(tx, settings, b.id, now))!;
  });
}

export async function memberBookings(orgId: string, memberId: string, now = new Date()): Promise<{ upcoming: BookingView[]; past: BookingView[] }> {
  const { settings } = await getOrg(orgId);
  const rows = await db(orgId).booking.findMany({
    where: { memberId, OR: [{ status: { not: "HELD" } }, { heldUntil: { gt: now } }], NOT: { status: "CANCELLED", cancelReason: { in: ["หมดเวลายืนยัน", "เลือกช่องใหม่", "ยกเลิกก่อนยืนยัน"] } } },
    include: viewInclude,
    orderBy: { startAt: "desc" },
    take: 50,
  });
  const views = rows.map((r) => toView(r, settings, now));
  return {
    upcoming: views.filter((v) => v.endAt > now && (v.status === "CONFIRMED" || v.status === "HELD" || v.status === "CHECKED_IN")).reverse(),
    past: views.filter((v) => !(v.endAt > now && (v.status === "CONFIRMED" || v.status === "HELD" || v.status === "CHECKED_IN"))),
  };
}

// ---------------------------------------------------------------------------
// Staff (the simulator calendar)
// ---------------------------------------------------------------------------

export interface StaffBookingInput {
  laneId: string;
  startAt: string;
  partySize: number;
  source: "WALKIN" | "PHONE";
  memberId?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  note?: string | null;
  checkInNow?: boolean;
}

export async function staffCreateBooking(orgId: string, actor: Actor, input: StaffBookingInput, now = new Date()): Promise<BookingView> {
  if (actor.kind !== "staff") throw new CoreError("FORBIDDEN", "เฉพาะพนักงาน");
  const { settings } = await getOrg(orgId);
  const startAt = new Date(input.startAt);
  if (Number.isNaN(startAt.getTime())) throw new CoreError("INVALID_INPUT", "เวลาไม่ถูกต้อง");
  if (startAt.getTime() % (settings.booking.slotMinutes * 60_000) !== 0) throw new CoreError("INVALID_INPUT", "เวลาต้องตรงกับช่องเวลาของตาราง");
  try {
    return await inTx(orgId, async (tx) => {
      const lane = await tx.lane.findFirst({ where: { id: input.laneId, isActive: true } });
      if (!lane) throw new CoreError("NOT_FOUND", "ไม่พบ lane");
      const party = Math.trunc(input.partySize);
      if (party < 1 || party > lane.capacity) throw new CoreError("BOOKING_RULE", `จำนวนคนต่อ lane 1–${lane.capacity} คน`);
      if (startAt.getTime() + settings.booking.slotMinutes * 60_000 <= now.getTime()) throw new CoreError("BOOKING_RULE", "ช่องเวลานี้ผ่านไปแล้ว");

      let memberId = input.memberId ?? null;
      const guestPhone = input.guestPhone ? normalizeThaiMobile(input.guestPhone) : null;
      if (input.guestPhone && !guestPhone) throw new CoreError("PHONE_INVALID", "เบอร์โทรไม่ถูกต้อง");
      if (!memberId && guestPhone) {
        // A walk-in whose phone is a member's is that member.
        const idn = await tx.memberIdentity.findFirst({ where: { type: "PHONE", value: guestPhone }, select: { memberId: true } });
        memberId = idn?.memberId ?? null;
      }
      const member = memberId ? await tx.member.findFirst({ where: { id: memberId, status: "ACTIVE" } }) : null;
      if (memberId && !member) throw new CoreError("NOT_FOUND", "ไม่พบสมาชิก");
      if (!member && !input.guestName?.trim()) throw new CoreError("INVALID_INPUT", "ใส่ชื่อลูกค้า หรือเลือกสมาชิก");

      const endAt = await assertSlotBookable(tx, lane.id, startAt, settings.booking.slotMinutes, now);
      const discountPct = member ? tierOf(settings, member.tier).benefits.simDiscountPct : 0;
      const checkIn = !!input.checkInNow;
      const b = await tx.booking.create({
        data: {
          orgId,
          laneId: lane.id,
          memberId: member?.id ?? null,
          guestName: member ? null : input.guestName!.trim().slice(0, 80),
          guestPhone: member ? null : guestPhone,
          startAt,
          endAt,
          partySize: party,
          status: checkIn ? "CHECKED_IN" : "CONFIRMED",
          checkedInAt: checkIn ? now : null,
          source: input.source,
          priceSatang: priceFor(lane.hourlyPriceSatang, settings.booking.slotMinutes, discountPct),
          discountPct,
          note: input.note?.trim() || null,
          createdBy: actor.userId,
        },
      });
      if (member) {
        await recordEvent(tx, orgId, member.id, "BOOKING_CREATED", { bookingId: b.id, laneId: lane.id, startAt: startAt.toISOString(), source: input.source });
        if (checkIn) await recordEvent(tx, orgId, member.id, "BOOKING_CHECKED_IN", { bookingId: b.id });
        else await enqueue(tx, orgId, [bookingMessage("BOOKING_CONFIRMED", b.id, member.id, lane.name, b)]);
      }
      await writeAudit(tx, orgId, actor, { action: "booking.create", entity: "booking", entityId: b.id, after: { lane: lane.name, startAt, source: input.source, memberId: member?.id ?? null } });
      return (await viewById(tx, settings, b.id, now))!;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new CoreError("SLOT_TAKEN", "ช่องนี้มีการจองแล้ว");
    throw e;
  }
}

export async function moveBooking(orgId: string, actor: Actor, bookingId: string, to: { laneId: string; startAt: string }, now = new Date()): Promise<BookingView> {
  const { settings } = await getOrg(orgId);
  const startAt = new Date(to.startAt);
  if (Number.isNaN(startAt.getTime())) throw new CoreError("INVALID_INPUT", "เวลาไม่ถูกต้อง");
  if (startAt.getTime() % (settings.booking.slotMinutes * 60_000) !== 0) throw new CoreError("INVALID_INPUT", "เวลาต้องตรงกับช่องเวลาของตาราง");
  try {
    return await inTx(orgId, async (tx) => {
      const b = await tx.booking.findFirst({ where: { id: bookingId }, include: { lane: true } });
      if (!b) throw new CoreError("NOT_FOUND", "ไม่พบการจอง");
      if (b.status !== "CONFIRMED" && b.status !== "HELD") throw new CoreError("BOOKING_RULE", "ย้ายได้เฉพาะการจองที่ยังไม่เช็กอิน");
      const lane = await tx.lane.findFirst({ where: { id: to.laneId, isActive: true } });
      if (!lane) throw new CoreError("NOT_FOUND", "ไม่พบ lane");
      if (b.partySize > lane.capacity) throw new CoreError("BOOKING_RULE", `lane นี้รับได้ ${lane.capacity} คน`);
      if (startAt.getTime() + settings.booking.slotMinutes * 60_000 <= now.getTime()) throw new CoreError("BOOKING_RULE", "ย้ายไปเวลาที่ผ่านไปแล้วไม่ได้");
      if (lane.id === b.laneId && startAt.getTime() === b.startAt.getTime()) return (await viewById(tx, settings, b.id, now))!;
      const endAt = await assertSlotBookable(tx, lane.id, startAt, settings.booking.slotMinutes, now, b.id);
      await tx.booking.update({
        where: { id: b.id },
        data: { laneId: lane.id, startAt, endAt, reminderSentAt: null, priceSatang: priceFor(lane.hourlyPriceSatang, settings.booking.slotMinutes, b.discountPct) },
      });
      if (b.memberId) {
        await enqueue(tx, orgId, [
          bookingMessage("BOOKING_MOVED", `${b.id}:${startAt.getTime()}:${lane.id}`, b.memberId, lane.name, { ...b, startAt }, {
            previousStartAt: b.startAt.toISOString(),
            previousLaneName: b.lane.name,
          }),
        ]);
      }
      await writeAudit(tx, orgId, actor, {
        action: "booking.move",
        entity: "booking",
        entityId: b.id,
        before: { lane: b.lane.name, startAt: b.startAt },
        after: { lane: lane.name, startAt },
      });
      return (await viewById(tx, settings, b.id, now))!;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new CoreError("SLOT_TAKEN", "ช่องปลายทางมีการจองแล้ว");
    throw e;
  }
}

export async function checkIn(orgId: string, actor: Actor, bookingId: string, paidSatang: number | null, now = new Date()): Promise<BookingView> {
  const { settings } = await getOrg(orgId);
  return inTx(orgId, async (tx) => {
    const b = await tx.booking.findFirst({ where: { id: bookingId } });
    if (!b) throw new CoreError("NOT_FOUND", "ไม่พบการจอง");
    if (b.status !== "CONFIRMED" && b.status !== "CHECKED_IN") throw new CoreError("BOOKING_RULE", "เช็กอินได้เฉพาะการจองที่ยืนยันแล้ว");
    if (b.startAt.getTime() - now.getTime() > 3 * HOUR) throw new CoreError("BOOKING_RULE", "ยังไม่ถึงเวลาเช็กอิน");
    if (paidSatang !== null && (paidSatang < 0 || !Number.isInteger(paidSatang))) throw new CoreError("INVALID_INPUT", "ยอดชำระไม่ถูกต้อง");
    await tx.booking.update({
      where: { id: b.id },
      data: { status: "CHECKED_IN", checkedInAt: b.checkedInAt ?? now, paidSatang: paidSatang ?? b.paidSatang },
    });
    if (b.memberId && b.status !== "CHECKED_IN") await recordEvent(tx, orgId, b.memberId, "BOOKING_CHECKED_IN", { bookingId: b.id });
    await writeAudit(tx, orgId, actor, { action: "booking.check_in", entity: "booking", entityId: b.id, after: { paidSatang } });
    return (await viewById(tx, settings, b.id, now))!;
  });
}

export async function markNoShow(orgId: string, actor: Actor, bookingId: string, now = new Date()): Promise<BookingView> {
  const { settings } = await getOrg(orgId);
  return inTx(orgId, async (tx) => {
    const b = await tx.booking.findFirst({ where: { id: bookingId } });
    if (!b) throw new CoreError("NOT_FOUND", "ไม่พบการจอง");
    if (b.status !== "CONFIRMED") throw new CoreError("BOOKING_RULE", "บันทึกไม่มาตามนัดได้เฉพาะการจองที่ยังไม่เช็กอิน");
    if (now.getTime() < b.startAt.getTime() + settings.booking.noShowGraceMinutes * 60_000) {
      throw new CoreError("BOOKING_RULE", `บันทึกได้หลังเวลาเริ่ม ${settings.booking.noShowGraceMinutes} นาที`);
    }
    await tx.booking.update({ where: { id: b.id }, data: { status: "NO_SHOW" } });
    if (b.memberId) {
      await tx.member.update({ where: { id: b.memberId }, data: { noShowCount: { increment: 1 } } });
      await recordEvent(tx, orgId, b.memberId, "BOOKING_NO_SHOW", { bookingId: b.id });
    }
    await writeAudit(tx, orgId, actor, { action: "booking.no_show", entity: "booking", entityId: b.id });
    return (await viewById(tx, settings, b.id, now))!;
  });
}

export async function cancelByStaff(orgId: string, actor: Actor, bookingId: string, reason: string, now = new Date()): Promise<BookingView> {
  if (!reason.trim()) throw new CoreError("INVALID_INPUT", "ต้องใส่เหตุผล");
  const { settings } = await getOrg(orgId);
  return inTx(orgId, async (tx) => {
    const b = await tx.booking.findFirst({ where: { id: bookingId }, include: { lane: true } });
    if (!b) throw new CoreError("NOT_FOUND", "ไม่พบการจอง");
    if (!ACTIVE.includes(b.status)) throw new CoreError("BOOKING_RULE", "การจองนี้ไม่อยู่ในสถานะที่ยกเลิกได้");
    await tx.booking.update({
      where: { id: b.id },
      data: { status: "CANCELLED", cancelReason: reason.trim(), cancelledBy: actor.kind === "staff" ? actor.userId : null },
    });
    if (b.memberId) {
      await recordEvent(tx, orgId, b.memberId, "BOOKING_CANCELLED", { bookingId: b.id, by: "staff" });
      if (b.status !== "HELD" && b.endAt > now) {
        await enqueue(tx, orgId, [bookingMessage("BOOKING_CANCELLED", b.id, b.memberId, b.lane.name, b, { reason: reason.trim() })]);
      }
    }
    await writeAudit(tx, orgId, actor, { action: "booking.cancel", entity: "booking", entityId: b.id, before: { status: b.status }, reason });
    return (await viewById(tx, settings, b.id, now))!;
  });
}

export async function recordPayment(orgId: string, actor: Actor, bookingId: string, paidSatang: number): Promise<void> {
  if (!Number.isInteger(paidSatang) || paidSatang < 0) throw new CoreError("INVALID_INPUT", "ยอดชำระไม่ถูกต้อง");
  await inTx(orgId, async (tx) => {
    const b = await tx.booking.findFirst({ where: { id: bookingId } });
    if (!b) throw new CoreError("NOT_FOUND", "ไม่พบการจอง");
    await tx.booking.update({ where: { id: b.id }, data: { paidSatang } });
    await writeAudit(tx, orgId, actor, { action: "booking.payment", entity: "booking", entityId: b.id, before: { paidSatang: b.paidSatang }, after: { paidSatang } });
  });
}

export interface CalendarDay {
  date: string;
  lanes: LaneInfo[];
  slots: string[]; // ISO starts within opening hours
  bookings: BookingView[];
  blocks: Array<{ id: string; laneId: string; startAt: Date; endAt: Date; reason: BlockReason; note: string | null }>;
}

export async function calendar(orgId: string, fromKey: string, days = 1, now = new Date()): Promise<CalendarDay[]> {
  const start = parseDateKey(fromKey);
  if (!start) throw new CoreError("INVALID_INPUT", "วันที่ไม่ถูกต้อง");
  const { settings } = await getOrg(orgId);
  const client = db(orgId);
  const store = await bookingStore(client);
  const lanes = await listLanes(orgId);
  const end = addDays(start, Math.min(7, Math.max(1, days)));
  const [rows, blocks] = await Promise.all([
    client.booking.findMany({
      where: { startAt: { gte: start, lt: end }, OR: [{ status: { notIn: ["HELD", "CANCELLED"] } }, { status: "HELD", heldUntil: { gt: now } }] },
      include: viewInclude,
      orderBy: { startAt: "asc" },
    }),
    client.laneBlock.findMany({ where: { startAt: { lt: end }, endAt: { gt: start } }, orderBy: { startAt: "asc" } }),
  ]);
  const out: CalendarDay[] = [];
  for (let d = start; d < end; d = addDays(d, 1)) {
    const next = addDays(d, 1);
    out.push({
      date: localDateKey(d),
      lanes,
      slots: daySlots(d, store.openHours as OpenHours, settings.booking.slotMinutes).map((s) => s.toISOString()),
      bookings: rows.filter((r) => r.startAt >= d && r.startAt < next).map((r) => toView(r, settings, now)),
      blocks: blocks
        .filter((b) => b.startAt < next && b.endAt > d)
        .map((b) => ({ id: b.id, laneId: b.laneId, startAt: b.startAt, endAt: b.endAt, reason: b.reason, note: b.note })),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lane blocks
// ---------------------------------------------------------------------------

export async function blockLane(
  orgId: string,
  actor: Actor,
  input: { laneId: string; startAt: string; endAt: string; reason: BlockReason; note?: string | null },
): Promise<{ id: string }> {
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) throw new CoreError("INVALID_INPUT", "ช่วงเวลาไม่ถูกต้อง");
  return inTx(orgId, async (tx) => {
    const lane = await tx.lane.findFirst({ where: { id: input.laneId } });
    if (!lane) throw new CoreError("NOT_FOUND", "ไม่พบ lane");
    const clash = await tx.booking.findMany({
      where: { laneId: lane.id, status: { in: ["CONFIRMED", "CHECKED_IN"] }, startAt: { lt: endAt }, endAt: { gt: startAt } },
      select: { startAt: true },
    });
    if (clash.length) {
      throw new CoreError("BOOKING_RULE", `มีการจองในช่วงนี้ ${clash.length} รายการ (${clash.map((c) => formatHm(c.startAt)).join(", ")}) — ย้ายหรือยกเลิกก่อนปิด lane`);
    }
    const block = await tx.laneBlock.create({
      data: { orgId, laneId: lane.id, startAt, endAt, reason: input.reason, note: input.note?.trim() || null, createdBy: actor.kind === "staff" ? actor.userId : null },
    });
    await writeAudit(tx, orgId, actor, { action: "lane.block", entity: "lane", entityId: lane.id, after: { startAt, endAt, reason: input.reason } });
    return { id: block.id };
  });
}

export async function unblockLane(orgId: string, actor: Actor, blockId: string): Promise<void> {
  await inTx(orgId, async (tx) => {
    const block = await tx.laneBlock.findFirst({ where: { id: blockId } });
    if (!block) throw new CoreError("NOT_FOUND", "ไม่พบช่วงที่ปิด");
    await tx.laneBlock.delete({ where: { id: block.id } });
    await writeAudit(tx, orgId, actor, { action: "lane.unblock", entity: "lane", entityId: block.laneId, before: { startAt: block.startAt, endAt: block.endAt } });
  });
}

// ---------------------------------------------------------------------------
// Scheduled work
// ---------------------------------------------------------------------------

/** Queues the "2 hours before" reminder. Run every 15 minutes. */
export async function queueReminders(orgId: string, now = new Date()): Promise<number> {
  const { settings } = await getOrg(orgId);
  const lead = settings.booking.reminderHoursBefore * HOUR;
  return inTx(orgId, async (tx) => {
    const due = await tx.booking.findMany({
      where: {
        status: "CONFIRMED",
        reminderSentAt: null,
        memberId: { not: null },
        startAt: { gt: now, lte: new Date(now.getTime() + lead) },
      },
      include: { lane: true },
    });
    // Booked inside the reminder window: the confirmation already said it all.
    const remind = due.filter((b) => b.startAt.getTime() - b.createdAt.getTime() > lead);
    if (due.length) await tx.booking.updateMany({ where: { id: { in: due.map((b) => b.id) } }, data: { reminderSentAt: now } });
    await enqueue(
      tx,
      orgId,
      remind.map((b) => bookingMessage("BOOKING_REMINDER", `${b.id}:${b.startAt.getTime()}`, b.memberId!, b.lane.name, b)),
    );
    return remind.length;
  });
}

/** Nightly: close checked-in sessions that have ended and clear stale holds. */
export async function closeFinishedBookings(orgId: string, now = new Date()): Promise<{ completed: number; expired: number }> {
  const client = db(orgId);
  const completed = await client.booking.updateMany({ where: { status: "CHECKED_IN", endAt: { lte: now } }, data: { status: "COMPLETED" } });
  const expired = await client.booking.updateMany({
    where: { status: "HELD", heldUntil: { lte: now } },
    data: { status: "CANCELLED", cancelReason: "หมดเวลายืนยัน" },
  });
  return { completed: completed.count, expired: expired.count };
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

const viewInclude = {
  lane: { select: { name: true } },
  member: {
    select: { code: true, displayName: true, tier: true, identities: { where: { type: "PHONE" as const }, select: { value: true } } },
  },
} satisfies Prisma.BookingInclude;

type ViewRow = Prisma.BookingGetPayload<{ include: typeof viewInclude }>;

function toView(r: ViewRow, settings: ResolvedSettings, now: Date): BookingView {
  return {
    id: r.id,
    laneId: r.laneId,
    laneName: r.lane.name,
    startAt: r.startAt,
    endAt: r.endAt,
    partySize: r.partySize,
    status: r.status,
    source: r.source,
    heldUntil: r.heldUntil,
    priceSatang: r.priceSatang,
    discountPct: r.discountPct,
    paidSatang: r.paidSatang,
    note: r.note,
    memberId: r.memberId,
    memberCode: r.member?.code ?? null,
    name: r.member?.displayName ?? r.guestName ?? "ลูกค้า",
    phone: r.member?.identities[0]?.value ?? r.guestPhone,
    tier: r.member?.tier ?? null,
    checkedInAt: r.checkedInAt,
    cancelReason: r.cancelReason,
    canCancel: r.status === "CONFIRMED" && r.startAt.getTime() - now.getTime() >= settings.booking.cancelHoursBefore * HOUR,
  };
}

async function viewById(tx: Tx, settings: ResolvedSettings, id: string, now: Date): Promise<BookingView | null> {
  const r = await tx.booking.findFirst({ where: { id }, include: viewInclude });
  return r ? toView(r, settings, now) : null;
}

function bookingMessage(
  kind: "BOOKING_CONFIRMED" | "BOOKING_REMINDER" | "BOOKING_CANCELLED" | "BOOKING_MOVED",
  key: string,
  memberId: string,
  laneName: string,
  b: { id: string; startAt: Date; partySize: number; priceSatang: number },
  extra: Record<string, unknown> = {},
) {
  return {
    memberId,
    kind,
    dedupeKey: `${kind}:${key}`,
    payload: { bookingId: b.id, laneName, startAt: b.startAt.toISOString(), partySize: b.partySize, priceSatang: b.priceSatang, ...extra },
  };
}
