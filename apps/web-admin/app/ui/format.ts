import { formatBaht } from "@mstgolf/core/money";
import { formatHm, formatThaiDate } from "@mstgolf/core/time";

// Display helpers shared by server and client components (Bangkok time).

export { formatBaht, formatHm, formatThaiDate };

export const num = (n: number) => n.toLocaleString("en-US");

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "–";
  const at = typeof d === "string" ? new Date(d) : d;
  return `${formatThaiDate(at)} ${formatHm(at)}`;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "–";
  return formatThaiDate(typeof d === "string" ? new Date(d) : d);
}

export function formatPhone(p: string | null | undefined): string {
  if (!p) return "–";
  return p.length === 10 ? `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}` : p;
}

export const pct = (x: number | null | undefined, digits = 0) => (x === null || x === undefined ? "–" : `${(x * 100).toFixed(digits)}%`);

export const SOURCE_LABEL: Record<string, string> = {
  LINE: "LINE",
  WEB: "เว็บไซต์",
  COUNTER: "เคาน์เตอร์",
  POS: "POS",
  IMPORT: "ระบบเดิม",
  WALKIN: "Walk-in",
  PHONE: "โทรจอง",
};

export const BOOKING_STATUS: Record<string, { label: string; tone: string }> = {
  HELD: { label: "รอยืนยัน", tone: "amber" },
  CONFIRMED: { label: "ยืนยันแล้ว", tone: "green" },
  CHECKED_IN: { label: "เช็กอินแล้ว", tone: "blue" },
  COMPLETED: { label: "เสร็จสิ้น", tone: "gray" },
  NO_SHOW: { label: "ไม่มาตามนัด", tone: "red" },
  CANCELLED: { label: "ยกเลิก", tone: "gray" },
};

export const CATEGORY_LABEL: Record<string, string> = { ARTICLE: "บทความ", SERVICE: "บริการ", NEWS: "ข่าวสาร" };
