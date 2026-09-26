// Money is integer satang (1/100 THB) everywhere in the database. These are
// the only conversions — never multiply by 100 anywhere else.

/** "12,900.50" / "12900.5" / "-1,200" / 12900.5 → satang, or null if not a number. */
export function toSatang(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw * 100) : null;
  let s = raw.trim().replace(/[฿,\s]/g, "").replace(/^THB/i, "");
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true; // accounting style (1,200.00)
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    negative = true; // some POS exports print 1200.00-
    s = s.slice(0, -1);
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Math.round(Number(s) * 100);
  return negative ? -Math.abs(n) : n;
}

/** Satang → baht as a number (for display maths only). */
export function toBaht(satang: number): number {
  return satang / 100;
}

/** Satang → "฿12,900" (drops ".00", keeps real satang). */
export function formatBaht(satang: number): string {
  const baht = satang / 100;
  const whole = Number.isInteger(baht);
  return `฿${baht.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}
