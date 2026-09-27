import { describe, expect, it } from "vitest";
import { detectMapping } from "./pos/mapping";
import { parseCsv } from "./pos/csv";
import { parsePosDate, readBillType, readMemberRef } from "./pos/parse";
import { formatBaht, toSatang } from "./money";
import { fromLocal, localDateKey, openWindow } from "./time";
import { daySlots, priceFor } from "./booking";
import { pointsForSatang } from "./points";
import { slugify } from "./posts";

describe("money", () => {
  it("parses POS amounts", () => {
    expect(toSatang("12,900.50")).toBe(1_290_050);
    expect(toSatang("฿1,200")).toBe(120_000);
    expect(toSatang("(1,200.00)")).toBe(-120_000);
    expect(toSatang("1200.00-")).toBe(-120_000);
    expect(toSatang("abc")).toBeNull();
    expect(formatBaht(1_290_000)).toBe("฿12,900");
    expect(formatBaht(1_290_050)).toBe("฿12,900.50");
  });
});

describe("time (Bangkok, UTC+7)", () => {
  it("round-trips local wall clock", () => {
    const d = fromLocal(2026, 10, 1, 0, 30);
    expect(d.toISOString()).toBe("2026-09-30T17:30:00.000Z");
    expect(localDateKey(d)).toBe("2026-10-01");
  });
  it("builds hour slots inside opening hours", () => {
    const day = fromLocal(2026, 10, 1);
    const hours = { thu: ["10:00", "22:00"] as [string, string] };
    expect(openWindow(day, hours)).not.toBeNull();
    const slots = daySlots(day, hours);
    expect(slots).toHaveLength(12);
    expect(localDateKey(slots[0]!)).toBe("2026-10-01");
    expect(daySlots(fromLocal(2026, 10, 2), hours)).toHaveLength(0); // Friday closed
  });
});

describe("POS parsing", () => {
  it("reads member references from remarks", () => {
    expect(readMemberRef("ลูกค้า MSTMEMBER:089-111-2233 ok", undefined, "MSTMEMBER")).toMatchObject({ kind: "phone", value: "0891112233" });
    expect(readMemberRef("mstmember : mst00003821", undefined, "MSTMEMBER")).toMatchObject({ kind: "code", value: "MST00003821" });
    // words typed after the reference
    expect(readMemberRef("MSTMEMBER:MST00000001 VIP", undefined, "MSTMEMBER")).toMatchObject({ kind: "code", value: "MST00000001" });
    expect(readMemberRef("MSTMEMBER:0891112233 Jan", undefined, "MSTMEMBER")).toMatchObject({ kind: "phone", value: "0891112233" });
    expect(readMemberRef("MSTMEMBER:089-111-2233 A1", undefined, "MSTMEMBER")).toMatchObject({ kind: "phone", value: "0891112233" });
    expect(readMemberRef("MSTMEMBER:MST000000012", undefined, "MSTMEMBER")).toMatchObject({ kind: "invalid" });
    expect(readMemberRef("MSTMEMBER:12345 test", undefined, "MSTMEMBER")).toMatchObject({ kind: "invalid" });
    expect(readMemberRef("MSTMEMBER:12345", undefined, "MSTMEMBER")).toMatchObject({ kind: "invalid" });
    expect(readMemberRef("", "0812345678", "MSTMEMBER")).toMatchObject({ kind: "phone" });
    expect(readMemberRef("no tag", undefined, "MSTMEMBER")).toBeNull();
  });
  it("reads dates in every common POS format, including Buddhist years", () => {
    const want = fromLocal(2026, 10, 1, 18, 5).toISOString();
    expect(parsePosDate("01/10/2026 18:05")?.toISOString()).toBe(want);
    expect(parsePosDate("1/10/2569", "18:05")?.toISOString()).toBe(want);
    expect(parsePosDate("2026-10-01 18:05:00")?.toISOString()).toBe(want);
    expect(parsePosDate("31/02/2026")).toBeNull();
  });
  it("reads bill types", () => {
    expect(readBillType("ขาย")).toBe("SALE");
    expect(readBillType("คืนสินค้า")).toBe("RETURN");
    expect(readBillType("VOID")).toBe("VOID");
    expect(readBillType("")).toBeNull();
  });
  it("parses quoted CSV and detects columns", () => {
    const rows = parseCsv('Invoice No,Date,Item Name,Qty,Net Amount,Remark\n"A-1","01/10/2026","Driver, 10.5°",1,"12,900.00","x ""y"""\n');
    expect(rows[1]).toEqual(["A-1", "01/10/2026", "Driver, 10.5°", "1", "12,900.00", 'x "y"']);
    const m = detectMapping(rows[0]!);
    expect(m).toMatchObject({ invoiceNo: "Invoice No", date: "Date", itemName: "Item Name", qty: "Qty", lineTotal: "Net Amount", remark: "Remark" });
  });
});

describe("rules", () => {
  it("points and prices", () => {
    expect(pointsForSatang(1_000_000, 1, 1.25)).toBe(12_500);
    expect(pointsForSatang(99, 1, 1)).toBe(0);
    expect(priceFor(100_000, 60, 10)).toBe(90_000);
  });
  it("slugs", () => {
    expect(slugify("How to choose a Driver")).toBe("how-to-choose-a-driver");
    expect(slugify("วิธีเลือกไดรเวอร์")).toMatch(/^post-/);
  });
});
