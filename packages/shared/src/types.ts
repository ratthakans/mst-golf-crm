// Shared domain types for the MST Golf CRM. Kept framework-agnostic so both the
// API (NestJS) and the web apps (Next.js) can import them.

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
  perBaht: number; // points earned per 1 unit of currency spent
  signupBonus: number;
  birthdayBonus: number;
  expiryMonths: number;
}

export interface TierSettings {
  name: string;
  minPoints: number;
}

export interface RewardSettings {
  name: string;
  costPoints: number;
}

export interface FeatureFlags {
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

export interface OrgSettings {
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
}

// ---------------------------------------------------------------------------
// Tenant context (attached to authenticated requests)
// ---------------------------------------------------------------------------
export interface TenantContext {
  orgId: string;
  userId?: string; // admin/staff acting
  role?: "OWNER" | "ADMIN" | "STAFF";
}
