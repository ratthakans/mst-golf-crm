import type { PosMapping, PosSettings } from "@mstgolf/shared";
import { normalizeThaiMobile } from "@mstgolf/shared/phone";
import { toSatang } from "../money";
import { fromLocal } from "../time";

// Turns CSV rows into bills. A bill is every row sharing an invoice number and
// type; a file with one row per bill works the same way (one line per bill).

export type BillType = "SALE" | "RETURN" | "VOID";

export interface BillLine {
  sku: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  qty: number;
  unitSatang: number;
  netSatang: number; // always positive here; the bill's sign comes from its type
  pointExcluded: boolean;
}

export interface MemberRef {
  raw: string;
  kind: "code" | "phone" | "invalid";
  value: string; // "MST00003821" / "0891112233" / the raw text
}

export interface ParsedBill {
  invoiceNo: string;
  type: BillType;
  refInvoiceNo: string | null;
  occurredAt: string; // ISO
  memberRef: MemberRef | null;
  paymentMethod: string | null;
  lines: BillLine[];
  grossSatang: number;
  discountSatang: number;
  netSatang: number; // positive for SALE, negative for RETURN / VOID
  eligibleSatang: number; // part of a SALE that earns points
  rowNumbers: number[]; // 1-based line numbers in the file (header = 1)
}

export interface RowError {
  rowNumber: number;
  invoiceNo: string | null;
  code: "NO_INVOICE" | "BAD_DATE" | "BAD_AMOUNT" | "REF_REQUIRED" | "MIXED_BILL";
  message: string;
  raw: Record<string, string>;
}

export const ROW_ERROR_TEXT: Record<RowError["code"], string> = {
  NO_INVOICE: "ไม่มีเลขที่บิล",
  BAD_DATE: "วันที่อ่านไม่ได้",
  BAD_AMOUNT: "ยอดเงินอ่านไม่ได้",
  REF_REQUIRED: "บิลคืน/ยกเลิกไม่มีเลขบิลอ้างอิง",
  MIXED_BILL: "บิลเดียวกันมีหลายวันที่หรือหลายประเภท",
};

/**
 * Reads the member reference from the remark ("MSTMEMBER:0891112233" or
 * "MSTMEMBER:MST00003821") or from a dedicated member column.
 */
export function readMemberRef(remark: string | undefined, column: string | undefined, tag: string): MemberRef | null {
  let raw: string | null = null;
  if (remark) {
    const re = new RegExp(`${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:：=]\\s*([A-Za-z0-9+\\-\\s]{4,20})`, "i");
    const m = re.exec(remark);
    if (m) raw = m[1]!.trim();
  }
  if (!raw && column?.trim()) raw = column.trim();
  if (!raw) return null;
  const code = raw.replace(/\s/g, "").toUpperCase();
  if (/^MST\d{8}$/.test(code)) return { raw, kind: "code", value: code };
  const phone = normalizeThaiMobile(raw);
  if (phone) return { raw, kind: "phone", value: phone };
  // Staff often type more after the reference ("MSTMEMBER:MST00000001 VIP",
  // "MSTMEMBER:0891112233 ลูกค้าประจำ"): read the code or number at the start.
  const leadCode = /^MST\d{8}(?![0-9])/i.exec(raw.trim());
  if (leadCode) return { raw, kind: "code", value: leadCode[0].toUpperCase() };
  const leadDigits = /^\+?[\d][\d\s-]{8,15}/.exec(raw.trim());
  const leadPhone = leadDigits ? normalizeThaiMobile(leadDigits[0]) ?? normalizeThaiMobile(leadDigits[0].trim().split(/\s+/)[0]) : null;
  if (leadPhone) return { raw, kind: "phone", value: leadPhone };
  return { raw, kind: "invalid", value: raw };
}

/** "01/10/2026", "1/10/2569", "2026-10-01", "2026-10-01 18:05", "01-10-2026 18:05:33" → local instant. */
export function parsePosDate(dateRaw: string, timeRaw?: string): Date | null {
  const s = dateRaw.trim();
  let y: number, mo: number, d: number;
  let rest = "";
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(.*)$/.exec(s);
  if (m) {
    y = Number(m[1]);
    mo = Number(m[2]);
    d = Number(m[3]);
    rest = m[4] ?? "";
  } else {
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(.*)$/.exec(s);
    if (!m) return null;
    d = Number(m[1]);
    mo = Number(m[2]);
    y = Number(m[3]);
    rest = m[4] ?? "";
    if (y < 100) y += 2000;
  }
  if (y > 2400) y -= 543; // Buddhist era
  const t = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(timeRaw?.trim() || rest);
  const hh = t ? Number(t[1]) : 12; // no time: midday, so the local date never shifts
  const mm = t ? Number(t[2]) : 0;
  const ss = t && t[3] ? Number(t[3]) : 0;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null;
  const at = fromLocal(y, mo, d, hh, mm, ss);
  const check = new Date(at.getTime() + 7 * 3600_000);
  if (check.getUTCDate() !== d || check.getUTCMonth() + 1 !== mo) return null;
  return at;
}

export function readBillType(raw: string | undefined): BillType | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (/void|cancel|ยกเลิก/.test(v)) return "VOID";
  if (/return|refund|credit|^cn$|คืน/.test(v)) return "RETURN";
  return "SALE";
}

function isExcluded(line: { sku: string | null; category: string | null }, pos: PosSettings): boolean {
  if (line.category && pos.pointExcludedCategories.some((c) => c.toLowerCase() === line.category!.toLowerCase())) return true;
  if (!line.sku) return false;
  return pos.pointExcludedSkus.some((p) => (p.endsWith("*") ? line.sku!.startsWith(p.slice(0, -1)) : line.sku === p));
}

export interface ParseResult {
  bills: ParsedBill[];
  errors: RowError[];
  lineCount: number;
}

export function parseBills(headers: string[], rows: string[][], mapping: PosMapping, pos: PosSettings): ParseResult {
  const col = (field: keyof PosMapping) => {
    const h = mapping[field];
    return h ? headers.indexOf(h) : -1;
  };
  const idx = {
    invoiceNo: col("invoiceNo"),
    date: col("date"),
    time: col("time"),
    type: col("type"),
    ref: col("refInvoiceNo"),
    remark: col("remark"),
    memberRef: col("memberRef"),
    sku: col("sku"),
    itemName: col("itemName"),
    brand: col("brand"),
    category: col("category"),
    qty: col("qty"),
    unitPrice: col("unitPrice"),
    lineTotal: col("lineTotal"),
    billTotal: col("billTotal"),
    discount: col("discount"),
    payment: col("paymentMethod"),
  };
  const get = (row: string[], i: number) => (i >= 0 ? row[i] ?? "" : "");
  const errors: RowError[] = [];

  interface Draft {
    invoiceNo: string;
    type: BillType;
    explicitType: boolean;
    ref: string | null;
    at: Date;
    remark: string;
    memberCol: string;
    payment: string | null;
    lines: Array<BillLine & { signed: number }>;
    billTotal: number | null;
    discount: number;
    rowNumbers: number[];
    bad: boolean;
  }
  const drafts = new Map<string, Draft>();
  const order: string[] = [];

  rows.forEach((row, i) => {
    const rowNumber = i + 2;
    const rawRecord = Object.fromEntries(headers.map((h, j) => [h, row[j] ?? ""]));
    const invoiceNo = get(row, idx.invoiceNo).trim();
    const fail = (code: RowError["code"]) =>
      errors.push({ rowNumber, invoiceNo: invoiceNo || null, code, message: ROW_ERROR_TEXT[code], raw: rawRecord });
    if (!invoiceNo) return fail("NO_INVOICE");
    const at = parsePosDate(get(row, idx.date), idx.time >= 0 ? get(row, idx.time) : undefined);
    if (!at) return fail("BAD_DATE");

    const qtyRaw = get(row, idx.qty);
    const qty = qtyRaw ? Math.round(Number(qtyRaw.replace(/,/g, ""))) : 1;
    const unit = idx.unitPrice >= 0 ? toSatang(get(row, idx.unitPrice)) : null;
    const lineTotal = idx.lineTotal >= 0 ? toSatang(get(row, idx.lineTotal)) : null;
    const billTotal = idx.billTotal >= 0 ? toSatang(get(row, idx.billTotal)) : null;
    const discount = idx.discount >= 0 ? toSatang(get(row, idx.discount)) ?? 0 : 0;
    const signed = lineTotal ?? (unit !== null && Number.isFinite(qty) ? unit * qty : null) ?? billTotal;
    if (signed === null || !Number.isFinite(qty)) return fail("BAD_AMOUNT");

    const explicit = readBillType(get(row, idx.type));
    const type: BillType = explicit ?? (signed < 0 || qty < 0 ? "RETURN" : "SALE");
    const key = `${invoiceNo}\u0000${type}`;
    let draft = drafts.get(key);
    if (!draft) {
      draft = {
        invoiceNo,
        type,
        explicitType: !!explicit,
        ref: get(row, idx.ref).trim() || null,
        at,
        remark: "",
        memberCol: "",
        payment: get(row, idx.payment).trim() || null,
        lines: [],
        billTotal: null,
        discount: 0,
        rowNumbers: [],
        bad: false,
      };
      drafts.set(key, draft);
      order.push(key);
    }
    draft.rowNumbers.push(rowNumber);
    if (Math.abs(draft.at.getTime() - at.getTime()) > 24 * 3600_000) {
      draft.bad = true;
      fail("MIXED_BILL");
    }
    const remark = get(row, idx.remark).trim();
    if (remark && !draft.remark) draft.remark = remark;
    const memberCol = get(row, idx.memberRef).trim();
    if (memberCol && !draft.memberCol) draft.memberCol = memberCol;
    if (!draft.ref) draft.ref = get(row, idx.ref).trim() || null;
    if (billTotal !== null) draft.billTotal = Math.max(draft.billTotal ?? 0, Math.abs(billTotal));
    draft.discount += Math.abs(discount);

    const hasItem = idx.itemName >= 0 || idx.sku >= 0;
    if (hasItem || idx.lineTotal >= 0 || idx.unitPrice >= 0) {
      const sku = get(row, idx.sku).trim() || null;
      const category = get(row, idx.category).trim() || null;
      const net = Math.abs(signed);
      draft.lines.push({
        sku,
        name: get(row, idx.itemName).trim() || sku || "สินค้า",
        brand: get(row, idx.brand).trim() || null,
        category,
        qty: Math.abs(qty) || 1,
        unitSatang: unit !== null ? Math.abs(unit) : Math.round(net / (Math.abs(qty) || 1)),
        netSatang: net,
        pointExcluded: isExcluded({ sku, category }, pos),
        signed,
      });
    }
  });

  const bills: ParsedBill[] = [];
  for (const key of order) {
    const d = drafts.get(key)!;
    if (d.bad) continue;
    let lines: BillLine[] = d.lines.map(({ signed: _signed, ...l }) => l);
    if (lines.length === 0 && d.billTotal !== null) {
      lines = [{ sku: null, name: "ยอดรวมบิล", brand: null, category: null, qty: 1, unitSatang: d.billTotal, netSatang: d.billTotal, pointExcluded: false }];
    }
    const lineSum = lines.reduce((s, l) => s + l.netSatang, 0);
    let net = lines.length ? lineSum : d.billTotal ?? 0;
    // A bill-level discount shows up as a bill total below the sum of its lines.
    let scale = 1;
    if (lineSum > 0 && d.billTotal !== null && d.billTotal > 0 && d.billTotal < lineSum) {
      scale = d.billTotal / lineSum;
      net = d.billTotal;
    }
    if ((d.type === "RETURN" || d.type === "VOID") && !d.ref) {
      for (const rowNumber of d.rowNumbers) {
        errors.push({ rowNumber, invoiceNo: d.invoiceNo, code: "REF_REQUIRED", message: ROW_ERROR_TEXT.REF_REQUIRED, raw: {} });
      }
      continue;
    }
    const eligible =
      d.type === "SALE" ? Math.round(lines.filter((l) => !l.pointExcluded).reduce((s, l) => s + l.netSatang, 0) * scale) : 0;
    bills.push({
      invoiceNo: d.invoiceNo,
      type: d.type,
      refInvoiceNo: d.type === "SALE" ? null : d.ref,
      occurredAt: d.at.toISOString(),
      memberRef: readMemberRef(d.remark, d.memberCol, pos.memberTag),
      paymentMethod: d.payment,
      lines,
      grossSatang: Math.max(lineSum, net) + (scale === 1 ? d.discount : 0),
      // discount column, or the gap between the lines and the bill total
      discountSatang: scale === 1 ? d.discount : lineSum - net,
      netSatang: d.type === "SALE" ? net : -net,
      eligibleSatang: Math.max(0, eligible),
      rowNumbers: d.rowNumbers,
    });
  }
  return { bills, errors, lineCount: rows.length };
}
