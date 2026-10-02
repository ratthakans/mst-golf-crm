// Plain, serialisable shapes passed from the server to client components and
// returned by /api/me/*. No server imports here — client code imports this file.

export interface CardData {
  code: string;
  name: string;
  firstName: string | null;
  phone: string | null;
  email: string | null;
  birthday: string | null; // YYYY-MM-DD
  marketing: boolean;
  pictureUrl: string | null;
  points: number;
  tierKey: string;
  tierName: string;
  tier: { pointRate: number; discountPct: number; simDiscountPct: number; bookingDaysAhead: number; birthdayMultiplier: number };
  next: { name: string; remainingBaht: number; pct: number } | null;
  spend12mBaht: number;
}

export interface PointRow {
  id: string;
  at: string;
  delta: number;
  label: string;
  note: string | null;
  invoiceNo: string | null;
  storeName: string | null;
}

export type BookingStatus = "HELD" | "CONFIRMED" | "CHECKED_IN" | "COMPLETED" | "NO_SHOW" | "CANCELLED";

export interface BookingRow {
  id: string;
  laneId: string;
  laneName: string;
  startAt: string;
  endAt: string;
  partySize: number;
  status: BookingStatus;
  heldUntil: string | null;
  priceSatang: number;
  discountPct: number;
  canCancel: boolean;
}

export type SlotState = "free" | "taken" | "blocked" | "past" | "closed";

export interface AvailabilityData {
  date: string;
  open: boolean;
  lanes: Array<{ id: string; name: string; capacity: number; hourlyPriceSatang: number }>;
  slots: Array<{ startAt: string; label: string; lanes: Array<{ laneId: string; state: SlotState }> }>;
}

export interface ConsentDoc {
  title: string;
  body: string;
  version: string;
}

export interface ApiErrorBody {
  error: string;
  code: string;
}

export interface RewardItem {
  id: string;
  kind: "COUPON" | "PHYSICAL";
  name: string;
  description: string;
  terms: string;
  imageUrl: string | null;
  costPoints: number;
  valueSatang: number | null;
  minSpendSatang: number | null;
  validDays: number | null;
  fulfilment: string | null;
  stockLeft: number | null;
  minTierName: string | null;
  endsAt: string | null;
  blocked: string | null;
  shortBy: number;
}

export type RedemptionStatus =
  | "ISSUED"
  | "USED"
  | "EXPIRED"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "PROCESSING"
  | "SHIPPED"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export interface RedemptionRow {
  id: string;
  code: string;
  kind: "COUPON" | "PHYSICAL";
  rewardName: string;
  imageUrl: string | null;
  costPoints: number;
  status: RedemptionStatus;
  statusLabel: string;
  couponCode: string | null;
  valueSatang: number | null;
  minSpendSatang: number | null;
  terms: string;
  expiresAt: string | null;
  usedAt: string | null;
  fulfilment: string | null;
  method: "PICKUP" | "SHIP" | null;
  carrier: string | null;
  trackingNo: string | null;
  note: string | null;
  steps: Array<{ status: RedemptionStatus; at: string }>;
  createdAt: string;
  canCancel: boolean;
}

export interface RewardsData {
  balance: number;
  items: RewardItem[];
  redemptions: RedemptionRow[];
}
