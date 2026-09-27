import { describe, expect, it } from "vitest";
import { orderPhone, orderToBills, type ShopifyOrder } from "./orders";
import { normalizeShopDomain } from "./sync";

const pos = { memberTag: "MSTMEMBER", pointExcludedSkus: ["GIFT*"], pointExcludedCategories: ["SERVICE"] };
const now = new Date("2026-11-20T03:00:00Z");

function order(over: Partial<ShopifyOrder> = {}): ShopifyOrder {
  return {
    id: "5001",
    name: "#TH1001",
    processedAt: "2026-11-01T05:00:00Z", // settles 2026-11-15 with a 14-day window
    cancelledAt: null,
    test: false,
    currencyCode: "THB",
    financialStatus: "PAID",
    email: "golfer@example.com",
    phones: ["+66 89 111 2233"],
    gateways: ["2c2p"],
    lines: [
      { sku: "QI35-D", name: "Qi35 Driver", vendor: "TAYLORMADE", productType: "DRIVER", quantity: 1, unitPrice: "20900.00", discount: "900.00", giftCard: false },
      { sku: "PV1", name: "Pro V1", vendor: "TITLEIST", productType: "TOUR", quantity: 2, unitPrice: "1800.00", discount: "0.00", giftCard: false },
    ],
    refunds: [],
    ...over,
  };
}

const run = (o: ShopifyOrder, memberCode: string | null = "MST00000001", at = now) =>
  orderToBills(o, { now: at, windowDays: 14, memberCode, pos });

describe("orderToBills", () => {
  it("books a settled paid order as one SALE after line discounts", () => {
    const r = run(order());
    expect(r.skipped).toBeNull();
    expect(r.bills).toHaveLength(1);
    const b = r.bills[0]!;
    expect(b).toMatchObject({ invoiceNo: "#TH1001", type: "SALE", netSatang: 2_360_000, eligibleSatang: 2_360_000, grossSatang: 2_450_000, discountSatang: 90_000 });
    expect(b.memberRef).toEqual({ raw: "MST00000001", kind: "code", value: "MST00000001" });
    expect(b.lines.map((l) => l.netSatang)).toEqual([2_000_000, 360_000]);
  });

  it("waits until the return window has passed", () => {
    expect(run(order(), null, new Date("2026-11-10T00:00:00Z")).skipped).toBe("PENDING");
    expect(run(order(), null, new Date("2026-11-15T05:00:00Z")).skipped).toBeNull();
  });

  it("skips test, foreign-currency, unpaid and early-cancelled orders", () => {
    expect(run(order({ test: true })).skipped).toBe("TEST");
    expect(run(order({ currencyCode: "SGD" })).skipped).toBe("CURRENCY");
    expect(run(order({ financialStatus: "PENDING" })).skipped).toBe("UNPAID");
    expect(run(order({ cancelledAt: "2026-11-03T00:00:00Z" })).skipped).toBe("CANCELLED");
  });

  it("nets refunds made inside the window and scales the eligible part", () => {
    const r = run(order({ refunds: [{ id: "77", createdAt: "2026-11-05T00:00:00Z", lines: [{ sku: "PV1", name: "Pro V1", quantity: 1, subtotal: "1800.00" }] }] }));
    expect(r.bills).toHaveLength(1);
    expect(r.bills[0]).toMatchObject({ type: "SALE", netSatang: 2_180_000, eligibleSatang: 2_180_000 });
  });

  it("turns refunds after the window into RETURN bills against the order", () => {
    const r = run(order({ refunds: [{ id: "88", createdAt: "2026-11-18T00:00:00Z", lines: [{ sku: "PV1", name: "Pro V1", quantity: 2, subtotal: "3600.00" }] }] }));
    expect(r.bills.map((b) => b.type)).toEqual(["SALE", "RETURN"]);
    expect(r.bills[0]!.netSatang).toBe(2_360_000);
    expect(r.bills[1]).toMatchObject({ invoiceNo: "#TH1001-R88", refInvoiceNo: "#TH1001", netSatang: -360_000, grossSatang: 360_000, eligibleSatang: 0, memberRef: null });
  });

  it("ignores refunds that have not happened yet as of now", () => {
    const r = run(order({ refunds: [{ id: "99", createdAt: "2026-11-25T00:00:00Z", lines: [{ sku: "PV1", name: "Pro V1", quantity: 1, subtotal: "1800.00" }] }] }));
    expect(r.bills).toHaveLength(1);
  });

  it("books nothing for an order refunded in full inside the window", () => {
    const r = run(order({ lines: [order().lines[1]!], refunds: [{ id: "1", createdAt: "2026-11-02T00:00:00Z", lines: [{ sku: "PV1", name: "Pro V1", quantity: 2, subtotal: "3600.00" }] }] }));
    expect(r).toEqual({ bills: [], skipped: "REFUNDED" });
  });

  it("gift cards and excluded SKUs/categories count as spend but earn no points", () => {
    const r = run(
      order({
        lines: [
          { sku: "GIFT-1000", name: "Gift card", vendor: null, productType: null, quantity: 1, unitPrice: "1000.00", discount: "0", giftCard: true },
          { sku: "GIFT-X", name: "Voucher", vendor: null, productType: null, quantity: 1, unitPrice: "500.00", discount: "0", giftCard: false },
          { sku: "FIT", name: "Fitting", vendor: null, productType: "SERVICE", quantity: 1, unitPrice: "1500.00", discount: "0", giftCard: false },
          { sku: "PV1", name: "Pro V1", vendor: "TITLEIST", productType: "TOUR", quantity: 1, unitPrice: "1800.00", discount: "0", giftCard: false },
        ],
      }),
    );
    expect(r.bills[0]).toMatchObject({ netSatang: 480_000, eligibleSatang: 180_000 });
    expect(r.bills[0]!.lines.map((l) => l.pointExcluded)).toEqual([true, true, true, false]);
  });

  it("sells to a non-member when no member matched", () => {
    expect(run(order(), null).bills[0]!.memberRef).toBeNull();
  });
});

describe("order helpers", () => {
  it("finds the first Thai mobile among the order's phones", () => {
    expect(orderPhone({ phones: ["02-123-4567", "+66 89 111 2233"] })).toBe("0891112233");
    expect(orderPhone({ phones: ["+65 8123 4567"] })).toBeNull();
  });

  it("accepts only .myshopify.com shop domains", () => {
    expect(normalizeShopDomain("https://MST-Golf-Thailand.myshopify.com/admin")).toBe("mst-golf-thailand.myshopify.com");
    expect(normalizeShopDomain("mstgolf.co.th")).toBeNull();
  });
});
