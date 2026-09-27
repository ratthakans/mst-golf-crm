import type { SitePhotoKey, SiteServiceSlug } from "./site";

// Shared domain types for MST Golf Platform. Framework-agnostic: imported by
// both Next.js apps, packages/core and the jobs.

// ---------------------------------------------------------------------------
// Dynamic field definitions (mirror of Prisma FieldType / FieldOption)
// ---------------------------------------------------------------------------
export type FieldType =
  | "TEXT"
  | "NUMBER"
  | "SELECT"
  | "MULTISELECT"
  | "BOOLEAN"
  | "DATE";

export interface FieldOption {
  value: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Golf profile (stored in Member.attributes — shape is a convention, not a
// hard schema, because FieldDefinition drives what is actually collected).
// ---------------------------------------------------------------------------
export type DominantHand = "left" | "right";
export type SkillLevel = "beginner" | "intermediate" | "advanced" | "pro";

export interface GolfProfile {
  handicap?: number;
  dominantHand?: DominantHand;
  skillLevel?: SkillLevel;
  preferredBrands?: string[];
  interests?: string[];
  homeCourse?: string;
  playFrequency?: string; // e.g. "weekly", "monthly"
  [key: string]: unknown; // extra org-specific fields from FieldDefinition
}

// ---------------------------------------------------------------------------
// Event payloads (typed per EventType). PURCHASE is locked so RFM/CLV/Monetary
// can be computed later without re-modeling.
// ---------------------------------------------------------------------------
export interface PurchasePayload {
  amount: number; // in the org's currency, major units (e.g. 15990.00)
  currency: string; // ISO 4217, e.g. "THB"
  items?: Array<{ sku?: string; name: string; qty: number; unitPrice: number }>;
  channel?: "store" | "online" | "arena";
  refId?: string; // POS/order reference
}

export interface PointsPayload {
  delta: number;
  reason: string;
  refId?: string;
}

// ---------------------------------------------------------------------------
// Organization.settings — the customize-by-project config model
// ---------------------------------------------------------------------------
export type BusinessType =
  | "pro_shop"
  | "golf_course"
  | "driving_range"
  | "academy";

export interface PointsSettings {
  perBaht: number; // base points per 1 unit of currency spent, before the tier's pointRate
  signupBonus: number;
  birthdayBonus: number;
  expiryMonths: number;
}

export interface TierBenefits {
  discountPct: number; // in-store discount
  birthdayPointMultiplier: number; // points multiplier during the birthday month
  simDiscountPct: number; // golf simulator discount
  simBookingDaysAhead: number; // how far ahead the member may book the simulator
  exclusiveCampaigns: boolean; // eligible for tier-only campaigns
}

// Tiers rank members by net spend over the trailing 12 months — never by
// points balance, which drops every time a member redeems.
export interface TierSettings {
  key: string; // stable id, e.g. "gold"
  name: string; // display name, e.g. "Gold"
  minSpend12m: number; // currency units spent in the last 12 months
  pointRate: number; // multiplier on base points earned per purchase
  benefits: TierBenefits;
}

export interface RewardSettings {
  name: string;
  costPoints: number;
}

export interface FeatureFlags {
  /** Out-of-contract intelligence pages (Action Plan, Segments, Automations, AI brief). */
  intelligence?: boolean;
  /** Simulator booking module (Phase 1 R2). */
  booking?: boolean;
  fitting: boolean;
  tradeIn: boolean;
  referral: boolean;
  events: boolean;
  coupons: boolean;
  lessons?: boolean;
  arena?: boolean;
  teeTime?: boolean;
}

export interface MessagingSettings {
  welcome: string;
  birthday?: string;
  winBack?: string;
  consentText: string;
}

export interface CrmSettings {
  churnDays: number;
  welcomeDiscountPercent: number;
}

export interface RichMenuButton {
  label: string;
  action: "liff" | "uri" | "message";
  target: string;
}

// Opening hours per weekday in the org's timezone, "HH:MM" 24h; a missing
// or null day means closed.
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type OpenHours = Partial<Record<Weekday, [string, string] | null>>;

export interface BookingSettings {
  slotMinutes: number; // 60
  holdMinutes: number; // a slot is held this long while the customer confirms
  maxSlotsPerDay: number; // per member, per day
  maxUpcoming: number; // per member, bookings not yet started
  cancelHoursBefore: number; // customers may cancel themselves until this many hours before
  noShowGraceMinutes: number; // staff may mark no-show this long after the start
  reminderHoursBefore: number; // LINE reminder
}

export type NotificationKind =
  | "WELCOME"
  | "POINTS"
  | "TIER_UP"
  | "BOOKING_CONFIRMED"
  | "BOOKING_REMINDER"
  | "BOOKING_CANCELLED"
  | "BOOKING_MOVED";

export type NotificationSettings = Record<NotificationKind, boolean>;

export type PosField =
  | "invoiceNo"
  | "date"
  | "time"
  | "type"
  | "refInvoiceNo"
  | "remark"
  | "memberRef"
  | "sku"
  | "itemName"
  | "brand"
  | "category"
  | "qty"
  | "unitPrice"
  | "lineTotal"
  | "billTotal"
  | "discount"
  | "paymentMethod"
  | "storeCode";

/** POS export column → field. Header text as it appears in the file. */
export type PosMapping = Partial<Record<PosField, string>>;

export interface PosSettings {
  memberTag: string; // "MSTMEMBER" — read from the bill remark as MSTMEMBER:<phone or code>
  mapping?: PosMapping; // saved after the first successful import
  pointExcludedSkus: string[]; // SKUs (or prefixes ending in *) that earn no points
  pointExcludedCategories: string[];
}

export interface SiteSettings {
  lineOaUrl?: string; // https://lin.ee/… — "add friend" link
  mapsUrl?: string;
  phone?: string;
  address?: string;
  siteUrl?: string; // public website origin, e.g. https://mstgolf.co.th
  photos?: Partial<Record<SitePhotoKey, string>>; // replaces the mockup of that slot (https:// or a /path on the website)
  copy?: SiteCopy; // website text edited in the back office; blank = the built-in placeholder
}

export interface SiteServiceCopy {
  short?: string; // one line on the home page
  body?: string; // paragraphs separated by a blank line
  points?: string; // one bullet per line
}

export interface SiteCopy {
  heroTitle?: string;
  heroHighlight?: string; // second line of the headline, in the accent colour
  heroLede?: string;
  servicesTitle?: string;
  servicesLede?: string;
  services?: Partial<Record<SiteServiceSlug, SiteServiceCopy>>;
}

export interface OrgSettings {
  productName?: string; // back-office name shown to staff, e.g. "MST Golf Platform"
  logoUrl?: string;
  brandColor?: string;
  locale: string; // e.g. "th", "en"
  currency: string; // ISO 4217, e.g. "THB"
  timezone: string; // e.g. "Asia/Bangkok"
  businessType: BusinessType;
  points: PointsSettings;
  tiers: TierSettings[];
  rewards: RewardSettings[];
  features: FeatureFlags;
  messaging: MessagingSettings;
  crm: CrmSettings;
  richMenu?: RichMenuButton[];
  booking?: BookingSettings;
  notifications?: Partial<NotificationSettings>;
  pos?: PosSettings;
  site?: SiteSettings;
  readiness?: Record<string, { at: string; by: string }>; // go-live items MST has confirmed (Settings › ความพร้อมเปิดใช้)
}

// ---------------------------------------------------------------------------
// Tenant context (attached to authenticated requests)
// ---------------------------------------------------------------------------
export interface TenantContext {
  orgId: string;
  userId?: string; // admin/staff acting
  role?: "SUPER_ADMIN" | "MARKETING" | "STORE_MANAGER" | "STORE_STAFF" | "CUSTOMER_SERVICE";
}
