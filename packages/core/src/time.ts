// Wall-clock helpers for the org's timezone. Thailand is UTC+7 all year (no
// DST), so a fixed offset is exact; ORG_UTC_OFFSET_MINUTES keeps it in one place
// for a future tenant elsewhere.

import type { OpenHours, Weekday } from "@mstgolf/shared";

export const ORG_UTC_OFFSET_MINUTES = 7 * 60;
const OFFSET_MS = ORG_UTC_OFFSET_MINUTES * 60_000;
export const DAY_MS = 24 * 60 * 60_000;
const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: Weekday;
}

export function localParts(at: Date): LocalParts {
  const d = new Date(at.getTime() + OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: WEEKDAYS[d.getUTCDay()]!,
  };
}

/** A local wall-clock time → the UTC instant. */
export function fromLocal(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second) - OFFSET_MS);
}

/** "2026-10-01" for the local calendar day of an instant. */
export function localDateKey(at: Date): string {
  const p = localParts(at);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Parses "YYYY-MM-DD" → local midnight, or null. */
export function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = fromLocal(Number(m[1]), Number(m[2]), Number(m[3]));
  return localDateKey(d) === key ? d : null;
}

export function startOfLocalDay(at: Date): Date {
  const p = localParts(at);
  return fromLocal(p.year, p.month, p.day);
}

export function addDays(at: Date, days: number): Date {
  return new Date(at.getTime() + days * DAY_MS);
}

/** Minutes after local midnight for "HH:MM", or null. "24:00" is allowed as a closing time. */
export function parseHm(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

/** Opening window of a local day as [open, close) instants, or null when closed. */
export function openWindow(day: Date, hours: OpenHours): [Date, Date] | null {
  const p = localParts(day);
  const spec = hours[p.weekday];
  if (!spec) return null;
  const open = parseHm(spec[0]);
  const close = parseHm(spec[1]);
  if (open === null || close === null || close <= open) return null;
  const midnight = fromLocal(p.year, p.month, p.day);
  return [new Date(midnight.getTime() + open * 60_000), new Date(midnight.getTime() + close * 60_000)];
}

/** "17:00" in local time. */
export function formatHm(at: Date): string {
  const p = localParts(at);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_WEEKDAYS: Record<Weekday, string> = {
  sun: "อา.",
  mon: "จ.",
  tue: "อ.",
  wed: "พ.",
  thu: "พฤ.",
  fri: "ศ.",
  sat: "ส.",
};

/** "พฤ. 1 ต.ค. 2026" (Gregorian year, as the flow documents use). */
export function formatThaiDate(at: Date, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const p = localParts(at);
  const parts = [`${p.day} ${TH_MONTHS[p.month - 1]}`];
  if (opts.weekday) parts.unshift(TH_WEEKDAYS[p.weekday]);
  if (opts.year !== false) parts.push(String(p.year));
  return parts.join(" ");
}
