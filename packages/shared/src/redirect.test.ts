import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("keeps same-site paths with their query", () => {
    expect(safeNextPath("/members?q=081")).toBe("/members?q=081");
    expect(safeNextPath("/simulator#today")).toBe("/simulator#today");
  });

  it("sends anything that could leave the site to /", () => {
    for (const next of ["//evil.com", "/\\evil.com", "/\\/evil.com", "/\t/evil.com", "/\n/evil.com", "https://evil.com", "evil.com", "", null, 42]) {
      expect(safeNextPath(next)).toBe("/");
    }
  });
});
