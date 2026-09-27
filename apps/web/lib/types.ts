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
