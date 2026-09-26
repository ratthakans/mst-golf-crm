import type {
  BookingSettings,
  NotificationSettings,
  OrgSettings,
  PosSettings,
  SiteSettings,
  TierSettings,
} from "@mstgolf/shared";
import { resolveTiers } from "@mstgolf/shared/tiers";
import { prisma } from "@mstgolf/database";
import { CoreError } from "./errors";

// Organization.settings with every Phase 1 section filled in. Stored settings
// win; anything missing falls back to the defaults below, so an org created
// before a setting existed keeps working. Values here are the proposals in the
// client flow document (pages 06–07) until MST changes them in Settings.

export const DEFAULT_BOOKING: BookingSettings = {
  slotMinutes: 60,
  holdMinutes: 5,
  maxSlotsPerDay: 2,
  maxUpcoming: 4,
  cancelHoursBefore: 2,
  noShowGraceMinutes: 15,
  reminderHoursBefore: 2,
};

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  WELCOME: true,
  POINTS: true,
  TIER_UP: true,
  BOOKING_CONFIRMED: true,
  BOOKING_REMINDER: true,
  BOOKING_CANCELLED: true,
  BOOKING_MOVED: true,
};

export const DEFAULT_POS: PosSettings = {
  memberTag: "MSTMEMBER",
  pointExcludedSkus: [],
  pointExcludedCategories: [],
};

export interface ResolvedSettings {
  productName: string;
  brandColor: string;
  currency: string;
  timezone: string;
  pointsPerBaht: number;
  welcomeBonus: number;
  tiers: TierSettings[];
  booking: BookingSettings;
  notifications: NotificationSettings;
  pos: PosSettings;
  site: SiteSettings;
  features: { intelligence: boolean; booking: boolean };
  raw: Partial<OrgSettings>;
}

export function resolveSettings(raw: unknown): ResolvedSettings {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<OrgSettings>;
  return {
    productName: s.productName ?? "MST Golf Platform",
    brandColor: s.brandColor ?? "#0a5c36",
    currency: s.currency ?? "THB",
    timezone: s.timezone ?? "Asia/Bangkok",
    pointsPerBaht: s.points?.perBaht && s.points.perBaht > 0 ? s.points.perBaht : 1,
    welcomeBonus: Math.max(0, Math.floor(s.points?.signupBonus ?? 1600)),
    tiers: resolveTiers(s.tiers),
    booking: { ...DEFAULT_BOOKING, ...(s.booking ?? {}) },
    notifications: { ...DEFAULT_NOTIFICATIONS, ...(s.notifications ?? {}) },
    pos: { ...DEFAULT_POS, ...(s.pos ?? {}) },
    site: s.site ?? {},
    features: {
      intelligence: s.features?.intelligence ?? false,
      booking: s.features?.booking ?? true,
    },
    raw: s,
  };
}

export interface OrgRecord {
  id: string;
  name: string;
  slug: string;
  settings: ResolvedSettings;
}

/** The org served by this deployment — ORG_SLUG, default "mst-golf". */
export async function getOrgBySlug(slug = process.env.ORG_SLUG || "mst-golf"): Promise<OrgRecord> {
  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org || !org.isActive) throw new CoreError("NOT_FOUND", `ไม่พบองค์กร '${slug}' — ต้องรัน db:seed ก่อน`);
  return { id: org.id, name: org.name, slug: org.slug, settings: resolveSettings(org.settings) };
}

export async function getOrg(orgId: string): Promise<OrgRecord> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new CoreError("NOT_FOUND", "ไม่พบองค์กร");
  return { id: org.id, name: org.name, slug: org.slug, settings: resolveSettings(org.settings) };
}

/**
 * Shallow-merges one section into Organization.settings (e.g. { booking: {…} }).
 * Callers validate the values; this only persists them.
 */
export async function updateSettings(orgId: string, patch: Partial<OrgSettings>): Promise<ResolvedSettings> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new CoreError("NOT_FOUND", "ไม่พบองค์กร");
  const current = (org.settings ?? {}) as Record<string, unknown>;
  const next = { ...current, ...patch };
  await prisma.organization.update({ where: { id: orgId }, data: { settings: next as object } });
  return resolveSettings(next);
}
