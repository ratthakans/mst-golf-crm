import {
  memberBookings,
  memberRedemptions,
  rewardCatalogue,
  memberCard,
  pointHistory,
  type BookingView,
  type MemberCard,
  type PointHistoryItem,
} from "@mstgolf/core";
import type { BookingRow, CardData, PointRow, RedemptionRow, RewardsData } from "./types";

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
      birthdayMultiplier: c.tier.birthdayMultiplier,
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

export async function loadRewards(orgId: string, memberId: string): Promise<RewardsData> {
  const [cat, reds] = await Promise.all([rewardCatalogue(orgId, memberId), memberRedemptions(orgId, memberId)]);
  return {
    balance: cat.balance,
    items: cat.items.map((i) => ({ ...i, endsAt: i.endsAt ? i.endsAt.toISOString() : null })),
    redemptions: reds.map(
      (r): RedemptionRow => ({
        id: r.id,
        code: r.code,
        kind: r.kind,
        rewardName: r.rewardName,
        imageUrl: r.imageUrl,
        costPoints: r.costPoints,
        status: r.status,
        statusLabel: r.statusLabel,
        couponCode: r.couponCode,
        valueSatang: r.valueSatang,
        minSpendSatang: r.minSpendSatang,
        terms: r.terms,
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
        usedAt: r.usedAt ? r.usedAt.toISOString() : null,
        fulfilment: r.fulfilment,
        method: r.delivery?.method ?? null,
        carrier: r.carrier,
        trackingNo: r.trackingNo,
        note: r.note,
        steps: r.history.map((h) => ({ status: h.status, at: h.at })),
        createdAt: r.createdAt.toISOString(),
        canCancel: r.canCancel,
      }),
    ),
  };
}
