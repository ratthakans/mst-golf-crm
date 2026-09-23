import { describe, expect, it } from "vitest";
import { normalizeThaiMobile, phoneVariants } from "./phone";

describe("normalizeThaiMobile", () => {
  it("accepts the usual spellings of one number", () => {
    for (const raw of ["0812345678", "081-234-5678", "081 234 5678", "+66812345678", "66812345678", "+66 81 234 5678"]) {
      expect(normalizeThaiMobile(raw)).toBe("0812345678");
    }
  });

  it("rejects landlines, short numbers and junk", () => {
    expect(normalizeThaiMobile("021234567")).toBeNull();
    expect(normalizeThaiMobile("08123")).toBeNull();
    expect(normalizeThaiMobile("")).toBeNull();
    expect(normalizeThaiMobile(null)).toBeNull();
  });

  it("lists the stored variants of a canonical number", () => {
    expect(phoneVariants("0812345678")).toEqual(["0812345678", "+66812345678", "66812345678"]);
  });
});
