import {
  memberBookings,
  memberCard,
  pointHistory,
  type BookingView,
  type MemberCard,
  type PointHistoryItem,
} from "@mstgolf/core";
import type { BookingRow, CardData, PointRow } from "./types";

// Core results → plain JSON for client components and API responses. Only
// what the member's own screens need: no internal ids beyond the booking id,
// never other customers' data.

export function toCardData(c: MemberCard): CardData {
  const m = c.member;
  return {
    code: m.code,
    name: m.displayName,
    firstName: m.firstName,
    phone: m.phone,
    email: m.email,
    birthday: m.birthday,
    marketing: m.marketingConsent,
    pictureUrl: m.pictureUrl,
    points: m.points,
    tierKey: c.tier.key,
    tierName: c.tier.name,
    tier: {
      pointRate: c.tier.pointRate,
      discountPct: c.tier.discountPct,
      simDiscountPct: c.tier.simDiscountPct,
      bookingDaysAhead: c.tier.bookingDaysAhead,
    },
    next: c.next,
    spend12mBaht: c.spend12mBaht,
  };
}

export function toPointRow(p: PointHistoryItem): PointRow {
  return {
    id: p.id,
    at: p.at.toISOString(),
    delta: p.delta,
    label: p.label,
    note: p.note,
    invoiceNo: p.invoiceNo,
    storeName: p.storeName,
  };
}

export function toBookingRow(b: BookingView): BookingRow {
  return {
    id: b.id,
    laneId: b.laneId,
    laneName: b.laneName,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    partySize: b.partySize,
    status: b.status,
    heldUntil: b.heldUntil ? b.heldUntil.toISOString() : null,
    priceSatang: b.priceSatang,
    discountPct: b.discountPct,
    canCancel: b.canCancel,
  };
}

export async function loadCard(orgId: string, memberId: string): Promise<CardData> {
  return toCardData(await memberCard(orgId, memberId));
}

export async function loadPoints(orgId: string, memberId: string): Promise<PointRow[]> {
  return (await pointHistory(orgId, memberId, 50)).map(toPointRow);
}

export async function loadBookings(orgId: string, memberId: string): Promise<{ upcoming: BookingRow[]; past: BookingRow[] }> {
  const { upcoming, past } = await memberBookings(orgId, memberId);
  return {
    upcoming: upcoming.filter((b) => b.status !== "HELD").map(toBookingRow),
    past: past.slice(0, 10).map(toBookingRow),
  };
}
