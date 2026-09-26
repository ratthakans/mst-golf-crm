// Display helpers safe for both server and client bundles (no node imports).
import { formatBaht } from "@mstgolf/core/money";
import { formatHm, formatThaiDate } from "@mstgolf/core/time";

export { formatBaht, formatHm, formatThaiDate };

type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type Hours = Partial<Record<Weekday, [string, string] | null>>;

const DAY_ORDER: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_TH: Record<Weekday, string> = { mon: "จันทร์", tue: "อังคาร", wed: "พุธ", thu: "พฤหัสบดี", fri: "ศุกร์", sat: "เสาร์", sun: "อาทิตย์" };

/** "เปิดทุกวัน 10:00–22:00", or one line per group of days with the same hours. */
export function hoursLines(raw: unknown): string[] {
  const hours = (raw && typeof raw === "object" ? raw : {}) as Hours;
  const spec = DAY_ORDER.map((d) => {
    const v = hours[d];
    return v ? `${v[0]}–${v[1]}` : null;
  });
  if (spec.every((s) => s && s === spec[0])) return [`เปิดทุกวัน ${spec[0]} น.`];
  const lines: string[] = [];
  let i = 0;
  while (i < DAY_ORDER.length) {
    let j = i;
    while (j + 1 < DAY_ORDER.length && spec[j + 1] === spec[i]) j++;
    const days = i === j ? DAY_TH[DAY_ORDER[i]!] : `${DAY_TH[DAY_ORDER[i]!]}–${DAY_TH[DAY_ORDER[j]!]}`;
    lines.push(`${days} ${spec[i] ? `${spec[i]} น.` : "ปิด"}`);
    i = j + 1;
  }
  return lines;
}

/** Opening windows for JSON-LD. */
export function openingSpec(raw: unknown): Array<{ dayOfWeek: string; opens: string; closes: string }> {
  const hours = (raw && typeof raw === "object" ? raw : {}) as Hours;
  const names: Record<Weekday, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
  return DAY_ORDER.flatMap((d) => {
    const v = hours[d];
    return v ? [{ dayOfWeek: names[d], opens: v[0], closes: v[1] }] : [];
  });
}

export function formatPoints(n: number): string {
  return n.toLocaleString("en-US");
}

/** Whole baht with thousands separators, e.g. 100000 → "฿100,000". */
export function formatBahtWhole(baht: number): string {
  return `฿${Math.round(baht).toLocaleString("en-US")}`;
}

export const CATEGORY_LABEL: Record<"ARTICLE" | "SERVICE" | "NEWS", string> = {
  ARTICLE: "บทความ",
  SERVICE: "บริการ",
  NEWS: "ข่าวสาร",
};

/** Calendar arithmetic on "YYYY-MM-DD" keys (no time zone involved). */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_WD = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const TH_WD_LONG = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

export function keyParts(key: string): { weekday: string; weekdayLong: string; day: number; month: string; year: number } {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { weekday: TH_WD[wd]!, weekdayLong: TH_WD_LONG[wd]!, day: d, month: TH_MONTHS[m - 1]!, year: y };
}

/** "วันพฤหัสบดีที่ 1 ต.ค." */
export function keyLongLabel(key: string): string {
  const p = keyParts(key);
  return `วัน${p.weekdayLong}ที่ ${p.day} ${p.month}`;
}
