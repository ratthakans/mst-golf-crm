// Framework-agnostic, Prisma-free shapes so analytics can run in the browser
// (dashboard demo mode) and on the server (API) alike.

export type EventTypeName =
  | "SCAN_QR"
  | "REGISTER"
  | "PROFILE_UPDATE"
  | "OPEN_MENU"
  | "CLICK_PROMO"
  | "PURCHASE"
  | "EARN_POINTS"
  | "REDEEM_POINTS"
  | "TIER_UP"
  | "FITTING_BOOKING"
  | "VISIT"
  | "MESSAGE_RECEIVED";

export interface MemberLike {
  id: string;
  displayName: string | null;
  tier: string | null;
  points: number;
  lastSeenAt: Date | null;
  createdAt: Date;
  phone?: string | null;
  email?: string | null;
  pictureUrl?: string | null; // uploaded photo, or the LINE profile picture
  attributes?: Record<string, unknown>;
}

export type FieldTypeName =
  | "TEXT"
  | "NUMBER"
  | "SELECT"
  | "MULTISELECT"
  | "BOOLEAN"
  | "DATE";

export interface FieldOptionLike {
  value: string;
  label: string;
}

// Mirror of Prisma FieldDefinition — drives the dynamic signup form.
export interface FieldDefinitionLike {
  key: string;
  label: string;
  type: FieldTypeName;
  required: boolean;
  options: FieldOptionLike[];
  group?: string;
  order: number;
}

export interface PurchaseItemLike {
  sku?: string;
  name: string;
  category: string; // e.g. "clubs", "balls", "apparel", "footwear"
  brand?: string;
  qty: number;
  unitPrice: number;
}

export interface EventPayloadLike {
  amount?: number;
  currency?: string;
  items?: PurchaseItemLike[];
  channel?: string; // "store" | "online" | "arena"
  branch?: string; // which MST Golf branch
  reward?: string; // for REDEEM_POINTS
  delta?: number; // points +/- for EARN/REDEEM
  [k: string]: unknown;
}

export interface EventLike {
  memberId: string;
  type: EventTypeName;
  occurredAt: Date;
  payload?: EventPayloadLike;
}

export type RfmSegment =
  | "Champion"
  | "Loyal"
  | "Potential"
  | "New"
  | "At-Risk"
  | "Dormant"
  | "Regular";

export interface RfmScore {
  memberId: string;
  displayName: string | null;
  recencyDays: number; // days since last purchase (or last seen if none)
  frequency: number; // number of purchases
  monetary: number; // total spend
  r: number; // 1..5
  f: number; // 1..5
  m: number; // 1..5
  segment: RfmSegment;
}

export interface OverviewStats {
  totalMembers: number;
  newMembers30d: number;
  activeMembers30d: number; // seen within 30 days
  atRiskMembers: number; // beyond churnDays
  pointsIssued: number; // sum of positive events / member points
  revenue: number; // sum of PURCHASE amounts
  currency: string;
}

export interface FunnelStage {
  stage: string;
  members: number;
  conversionFromPrev: number; // 0..1
}
