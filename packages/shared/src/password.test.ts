import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, temporaryPassword, verifyPassword } from "./password";

describe("password", () => {
  it("verifies the right password and rejects others", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("correct horse batterY", stored)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same-password-1")).not.toBe(await hashPassword("same-password-1"));
  });

  it("rejects missing or malformed hashes", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "plain-text")).toBe(false);
  });

  it("issues readable temporary passwords that pass the policy", () => {
    const t = temporaryPassword();
    expect(t).toHaveLength(12);
    expect(t).not.toMatch(/[0O1lI]/);
    expect(passwordProblem(t)).toBeNull();
  });

  it("enforces the minimum policy", () => {
    expect(passwordProblem("short")).not.toBeNull();
    expect(passwordProblem("aaaaaaaaaaaa")).not.toBeNull();
    expect(passwordProblem("long enough pass")).toBeNull();
  });
});
