import type { PosSettings } from "@mstgolf/shared";
import { normalizeThaiMobile } from "@mstgolf/shared/phone";
import { toSatang } from "../money";
import { isPointExcluded, type BillLine, type ParsedBill } from "../pos/parse";

// Online orders from the Shopify store (mstgolf.co.th) → the same bills the POS
// import commits (docs/th-commerce/INTEGRATION.md). Pure: the sync fetches the
// orders and resolves members; this decides what each order is worth.
//
// An order counts once its return window has passed (settleAt = processedAt +
// window). Refunds made up to settleAt are netted into the SALE; refunds after
// it become RETURN bills against the order. The split depends only on the order
// itself, so running the sync late, twice or out of order gives the same bills.

export interface ShopifyMoneyLine {
  sku: string | null;
  name: string;
  vendor: string | null;
  productType: string | null;
  quantity: number;
  unitPrice: string; // "1290.00" in the shop currency
  discount: string; // discounts allocated to this line, total for the line
  giftCard: boolean;
}

export interface ShopifyRefund {
  id: string; // numeric id as text
  createdAt: string;
  lines: Array<{ sku: string | null; name: string; quantity: number; subtotal: string }>; // subtotal = refunded goods, after discounts
}

export interface ShopifyOrder {
  id: string;
  name: string; // "#TH1001" — the invoice number staff and customers see
  processedAt: string;
  cancelledAt: string | null;
  test: boolean;
  currencyCode: string;
  financialStatus: string | null; // PAID, PARTIALLY_REFUNDED, REFUNDED, PENDING …
  email: string | null;
  phones: string[]; // customer, order, billing and shipping phones — first valid Thai mobile wins
  gateways: string[];
  lines: ShopifyMoneyLine[];
  refunds: ShopifyRefund[];
}

export type SkipReason = "PENDING" | "TEST" | "CURRENCY" | "CANCELLED" | "UNPAID" | "REFUNDED";

export const SKIP_TEXT: Record<SkipReason, string> = {
  PENDING: "ยังไม่พ้นระยะคืนสินค้า",
  TEST: "คำสั่งซื้อทดสอบ",
  CURRENCY: "ไม่ใช่เงินบาท",
  CANCELLED: "ยกเลิกก่อนพ้นระยะคืนสินค้า",
  UNPAID: "ยังไม่ได้ชำระเงิน",
  REFUNDED: "คืนเงินเต็มจำนวน",
};

const PAID = new Set(["PAID", "PARTIALLY_REFUNDED", "REFUNDED", "PARTIALLY_PAID"]);
const DAY_MS = 24 * 60 * 60_000;
const satang = (v: string) => toSatang(v) ?? 0;

export function settleAt(order: Pick<ShopifyOrder, "processedAt">, windowDays: number): Date {
  return new Date(new Date(order.processedAt).getTime() + windowDays * DAY_MS);
}

/** The customer's Thai mobile, canonical, from whichever phone field has one. */
export function orderPhone(order: Pick<ShopifyOrder, "phones">): string | null {
  for (const p of order.phones) {
    const n = normalizeThaiMobile(p);
    if (n) return n;
  }
  return null;
}

export function orderEmail(order: Pick<ShopifyOrder, "email">): string | null {
  const e = order.email?.trim().toLowerCase();
  return e && e.includes("@") ? e : null;
}

export interface OrderBills {
  bills: ParsedBill[];
  skipped: SkipReason | null;
}

/**
 * The bills an order produces as of `now`.
 * `memberCode` is the member the sync matched (null = sold to a non-member).
 */
export function orderToBills(
  order: ShopifyOrder,
  opts: { now: Date; windowDays: number; memberCode: string | null; pos: PosSettings },
): OrderBills {
  const none = (skipped: SkipReason): OrderBills => ({ bills: [], skipped });
  if (order.test) return none("TEST");
  if (order.currencyCode !== "THB") return none("CURRENCY");
  const settled = settleAt(order, opts.windowDays);
  if (settled.getTime() > opts.now.getTime()) return none("PENDING");
  if (order.cancelledAt && new Date(order.cancelledAt).getTime() <= settled.getTime()) return none("CANCELLED");
  if (!PAID.has((order.financialStatus ?? "").toUpperCase())) return none("UNPAID");

  const lines: BillLine[] = order.lines
    .filter((l) => l.quantity > 0)
    .map((l) => {
      const unit = satang(l.unitPrice);
      const net = Math.max(0, unit * l.quantity - satang(l.discount));
      return {
        sku: l.sku?.trim() || null,
        name: l.name,
        brand: l.vendor?.trim() || null,
        category: l.productType?.trim() || null,
        qty: l.quantity,
        unitSatang: unit,
        netSatang: net,
        pointExcluded: l.giftCard || isPointExcluded({ sku: l.sku?.trim() || null, category: l.productType?.trim() || null }, opts.pos),
      };
    });
  const grossSatang = lines.reduce((s, l) => s + l.unitSatang * l.qty, 0);
  const goodsSatang = lines.reduce((s, l) => s + l.netSatang, 0);

  const early = order.refunds.filter((r) => new Date(r.createdAt).getTime() <= settled.getTime());
  const late = order.refunds.filter((r) => {
    const t = new Date(r.createdAt).getTime();
    return t > settled.getTime() && t <= opts.now.getTime();
  });
  const refunded = (r: ShopifyRefund) => r.lines.reduce((s, l) => s + satang(l.subtotal), 0);
  const earlySatang = early.reduce((s, r) => s + refunded(r), 0);

  const netSatang = goodsSatang - earlySatang;
  if (netSatang <= 0) return none("REFUNDED");

  // Early refunds shrink the eligible part in proportion, like a POS bill discount.
  const eligibleGoods = lines.filter((l) => !l.pointExcluded).reduce((s, l) => s + l.netSatang, 0);
  const eligibleSatang = goodsSatang > 0 ? Math.round((eligibleGoods * netSatang) / goodsSatang) : 0;

  const memberRef = opts.memberCode ? { raw: opts.memberCode, kind: "code" as const, value: opts.memberCode } : null;
  const paymentMethod = order.gateways.filter(Boolean).join(", ").slice(0, 100) || null;

  const bills: ParsedBill[] = [
    {
      invoiceNo: order.name,
      type: "SALE",
      refInvoiceNo: null,
      occurredAt: new Date(order.processedAt).toISOString(),
      memberRef,
      paymentMethod,
      lines,
      grossSatang,
      discountSatang: grossSatang - netSatang,
      netSatang,
      eligibleSatang,
      rowNumbers: [],
    },
  ];
  for (const r of late) {
    const amount = refunded(r);
    if (amount <= 0) continue;
    bills.push({
      invoiceNo: `${order.name}-R${r.id}`,
      type: "RETURN",
      refInvoiceNo: order.name,
      occurredAt: new Date(r.createdAt).toISOString(),
      memberRef: null,
      paymentMethod,
      lines: r.lines.map((l) => ({
        sku: l.sku?.trim() || null,
        name: l.name,
        brand: null,
        category: null,
        qty: l.quantity,
        unitSatang: l.quantity > 0 ? Math.round(satang(l.subtotal) / l.quantity) : satang(l.subtotal),
        netSatang: satang(l.subtotal),
        pointExcluded: false,
      })),
      grossSatang: amount,
      discountSatang: 0,
      netSatang: -amount,
      eligibleSatang: 0,
      rowNumbers: [],
    });
  }
  return { bills, skipped: null };
}
