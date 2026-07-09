import { beforeAll, describe, expect, it } from "vitest";
import { encrypt, decrypt } from "./crypto";

beforeAll(() => {
  // deterministic 32-byte test key
  process.env.ENCRYPTION_KEY = "a".repeat(64);
});

describe("crypto (AES-256-GCM)", () => {
  it("round-trips a secret", () => {
    const secret = "line-channel-access-token-123";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const a = encrypt("same-input");
    const b = encrypt("same-input");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it("rejects tampered ciphertext", () => {
    const enc = encrypt("secret");
    const [iv, tag, data] = enc.split(".");
    const tampered = [iv, tag, Buffer.from("evil").toString("base64")].join(".");
    expect(() => decrypt(tampered)).toThrow();
  });
});
