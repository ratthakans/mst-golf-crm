import { availability, type Availability, localDateKey } from "@mstgolf/core";

// Which day's lanes to show on a public page: today while there are hours
// left, otherwise tomorrow — so the scorecard never sits empty in the evening.
export async function lanesToShow(orgId: string, now: Date): Promise<{ avail: Availability; at: Date; word: "วันนี้" | "พรุ่งนี้" } | null> {
  const hoursLeft = (a: Availability | null): a is Availability => !!a?.open && a.slots.some((s) => s.lanes.some((l) => l.state !== "past"));
  const today = await availability(orgId, localDateKey(now), now).catch(() => null);
  if (hoursLeft(today)) return { avail: today, at: now, word: "วันนี้" };
  const at = new Date(now.getTime() + 86_400_000);
  const tomorrow = await availability(orgId, localDateKey(at), now).catch(() => null);
  return hoursLeft(tomorrow) ? { avail: tomorrow, at, word: "พรุ่งนี้" } : null;
}
