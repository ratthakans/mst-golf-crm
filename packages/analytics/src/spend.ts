import { TIER_WINDOW_DAYS } from "@mstgolf/shared/tiers";
import type { EventLike } from "./types";

/**
 * Purchase spend per member inside the trailing window (default: 12 months).
 * Purchases stamped slightly after `now` still count, matching spendInWindow.
 */
export function spendByMember(
  events: EventLike[],
  now: Date,
  days = TIER_WINDOW_DAYS,
): Map<string, number> {
  const from = now.getTime() - days * 24 * 60 * 60 * 1000;
  const out = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "PURCHASE") continue;
    const t = e.occurredAt.getTime();
    const amount = Number(e.payload?.amount ?? 0);
    if (t < from || !Number.isFinite(amount)) continue;
    out.set(e.memberId, (out.get(e.memberId) ?? 0) + amount);
  }
  return out;
}
