import "server-only";
import { db } from "@mstgolf/core";
import type { DemoOrg, EventLike, EventTypeName, FieldDefinitionLike, MemberLike } from "@mstgolf/analytics";
import { currentOrg } from "./org";

// Feeds the out-of-contract intelligence pages (Action Plan, Segments,
// Automations) from schema v2. Those pages are hidden unless
// settings.features.intelligence is on; this keeps them working when it is.

const ANALYTICS_EVENTS: EventTypeName[] = [
  "SCAN_QR",
  "REGISTER",
  "PROFILE_UPDATE",
  "OPEN_MENU",
  "CLICK_PROMO",
  "PURCHASE",
  "EARN_POINTS",
  "REDEEM_POINTS",
  "TIER_UP",
  "FITTING_BOOKING",
  "VISIT",
  "MESSAGE_RECEIVED",
];

export async function analyticsOrg(): Promise<DemoOrg> {
  const org = await currentOrg();
  const s = org.settings;
  return {
    name: org.name,
    productName: s.productName,
    slug: org.slug,
    currency: s.currency,
    brandColor: s.brandColor,
    churnDays: s.raw.crm?.churnDays ?? 90,
    signupBonus: s.welcomeBonus,
    perCurrencyUnit: s.pointsPerBaht,
    consentText: "",
    tiers: s.tiers,
  };
}

export async function analyticsMembers(): Promise<MemberLike[]> {
  const org = await currentOrg();
  const rows = await db(org.id).member.findMany({
    where: { status: "ACTIVE" },
    include: { identities: { where: { type: "PHONE" }, select: { value: true } } },
  });
  return rows.map((m) => ({
    id: m.id,
    displayName: m.displayName,
    tier: org.settings.tiers.find((t) => t.key === m.tier)?.name ?? m.tier,
    points: m.points,
    lastSeenAt: m.lastPurchaseAt ?? m.lastSeenAt,
    createdAt: m.createdAt,
    phone: m.identities[0]?.value ?? null,
    email: m.email,
    pictureUrl: m.pictureUrl,
    attributes: (m.attributes ?? {}) as Record<string, unknown>,
  }));
}

export async function analyticsEvents(): Promise<EventLike[]> {
  const org = await currentOrg();
  const rows = await db(org.id).event.findMany({
    where: { type: { in: ANALYTICS_EVENTS }, member: { status: "ACTIVE" } },
    orderBy: { occurredAt: "asc" },
    select: { memberId: true, type: true, occurredAt: true, payload: true },
  });
  return rows.map((e) => ({
    memberId: e.memberId,
    type: e.type as EventTypeName,
    occurredAt: e.occurredAt,
    payload: (e.payload ?? {}) as EventLike["payload"],
  }));
}

export async function analyticsFieldDefinitions(): Promise<FieldDefinitionLike[]> {
  const org = await currentOrg();
  const rows = await db(org.id).fieldDefinition.findMany({ where: { isActive: true }, orderBy: { order: "asc" } });
  return rows.map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
    options: (f.options ?? []) as unknown as FieldDefinitionLike["options"],
    required: f.required,
    group: f.group ?? undefined,
    order: f.order,
  })) as FieldDefinitionLike[];
}
