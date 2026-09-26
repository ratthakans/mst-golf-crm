import type { PosField, PosMapping } from "@mstgolf/shared";

// Maps a POS export's headers to the fields the import understands. Detected
// automatically from common Thai/English header names; staff can correct it in
// the preview and the result is saved for the next import.

export const POS_FIELD_LABEL: Record<PosField, string> = {
  invoiceNo: "เลขที่บิล",
  date: "วันที่",
  time: "เวลา",
  type: "ประเภทบิล (ขาย/คืน/ยกเลิก)",
  refInvoiceNo: "บิลอ้างอิง (สำหรับคืนสินค้า)",
  remark: "หมายเหตุบิล",
  memberRef: "เบอร์หรือรหัสสมาชิก",
  sku: "รหัสสินค้า",
  itemName: "ชื่อสินค้า",
  brand: "ยี่ห้อ",
  category: "หมวดสินค้า",
  qty: "จำนวน",
  unitPrice: "ราคาต่อหน่วย",
  lineTotal: "ยอดรายการ (สุทธิ)",
  billTotal: "ยอดรวมบิล",
  discount: "ส่วนลด",
  paymentMethod: "วิธีชำระ",
  storeCode: "สาขา",
};

const SYNONYMS: Record<PosField, string[]> = {
  invoiceNo: ["invoiceno", "invoice", "invno", "billno", "bill", "receiptno", "receipt", "docno", "documentno", "เลขที่บิล", "เลขที่ใบเสร็จ", "เลขที่เอกสาร", "เลขที่", "ใบเสร็จ", "บิล"],
  date: ["date", "saledate", "docdate", "transactiondate", "invoicedate", "datetime", "วันที่", "วันที่ขาย", "วันเวลา"],
  time: ["time", "saletime", "เวลา"],
  type: ["type", "doctype", "documenttype", "transactiontype", "billtype", "ประเภท", "ประเภทเอกสาร", "ประเภทบิล"],
  refInvoiceNo: ["refinvoiceno", "refinvoice", "refno", "ref", "reference", "originalinvoice", "originalbill", "บิลอ้างอิง", "เลขที่อ้างอิง", "อ้างอิง"],
  remark: ["remark", "remarks", "note", "notes", "memo", "comment", "หมายเหตุ"],
  memberRef: ["memberref", "member", "memberid", "membercode", "memberno", "customerphone", "customertel", "phone", "mobile", "tel", "รหัสสมาชิก", "เบอร์โทร", "เบอร์", "สมาชิก", "เบอร์ลูกค้า"],
  sku: ["sku", "itemcode", "productcode", "barcode", "รหัสสินค้า", "บาร์โค้ด"],
  itemName: ["itemname", "item", "productname", "product", "description", "ชื่อสินค้า", "สินค้า", "รายการ", "รายละเอียด"],
  brand: ["brand", "ยี่ห้อ", "แบรนด์"],
  category: ["category", "productgroup", "group", "department", "หมวดหมู่", "หมวด", "กลุ่มสินค้า", "แผนก"],
  qty: ["qty", "quantity", "จำนวน"],
  unitPrice: ["unitprice", "price", "ราคาต่อหน่วย", "ราคา"],
  lineTotal: ["linetotal", "netamount", "amount", "net", "total", "ยอดสุทธิ", "จำนวนเงิน", "ยอดเงิน", "ยอด"],
  billTotal: ["billtotal", "grandtotal", "invoicetotal", "totalamount", "ยอดรวมบิล", "ยอดรวมทั้งสิ้น", "ยอดรวม"],
  discount: ["discount", "discountamount", "ส่วนลด"],
  paymentMethod: ["paymentmethod", "payment", "paymenttype", "paidby", "วิธีชำระ", "การชำระเงิน", "ชำระโดย"],
  storeCode: ["storecode", "store", "branchcode", "branch", "location", "รหัสสาขา", "สาขา"],
};

const norm = (h: string) => h.toLowerCase().replace(/[\s_\-.()/#:]+/g, "");

/** Best guess per field; each header is used at most once, exact names before partial ones. */
export function detectMapping(headers: string[]): PosMapping {
  const used = new Set<string>();
  const mapping: PosMapping = {};
  const fields = Object.keys(SYNONYMS) as PosField[];
  for (const pass of ["exact", "prefix"] as const) {
    for (const field of fields) {
      if (mapping[field]) continue;
      for (const syn of SYNONYMS[field]) {
        const hit = headers.find((h) => {
          if (used.has(h)) return false;
          const n = norm(h);
          return pass === "exact" ? n === syn : n.startsWith(syn) && syn.length >= 3;
        });
        if (hit) {
          mapping[field] = hit;
          used.add(hit);
          break;
        }
      }
    }
  }
  // "ยอดรวม"/"total" on a one-row-per-bill export is the bill total, not a line.
  if (!mapping.itemName && !mapping.sku && mapping.lineTotal && !mapping.billTotal) {
    mapping.billTotal = mapping.lineTotal;
    delete mapping.lineTotal;
  }
  return mapping;
}

/** Keeps only mappings whose header exists in this file. */
export function applyMapping(saved: PosMapping | undefined, headers: string[]): PosMapping | null {
  if (!saved) return null;
  const out: PosMapping = {};
  for (const [field, header] of Object.entries(saved) as Array<[PosField, string]>) {
    if (headers.includes(header)) out[field] = header;
  }
  return mappingProblems(out).length === 0 ? out : null;
}

export function mappingProblems(m: PosMapping): string[] {
  const problems: string[] = [];
  if (!m.invoiceNo) problems.push("ไม่พบคอลัมน์เลขที่บิล");
  if (!m.date) problems.push("ไม่พบคอลัมน์วันที่");
  if (!m.lineTotal && !m.billTotal && !m.unitPrice) problems.push("ไม่พบคอลัมน์ยอดเงิน");
  return problems;
}
