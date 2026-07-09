import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

// AES-256-GCM encryption for secrets at rest (LINE channel credentials, etc.).
// The key comes from ENCRYPTION_KEY (64 hex chars = 32 bytes). This is an
// app-level starter approach; migrate to a KMS when scaling.

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96-bit nonce, recommended for GCM

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be set to 64 hex chars (32 bytes). " +
        'Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts plaintext. Output format: base64(iv).base64(authTag).base64(ciphertext)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

/**
 * Decrypts a value produced by `encrypt`. Throws if the key is wrong, the data
 * is malformed, or the auth tag fails (tampering).
 */
export function decrypt(encoded: string): string {
  const key = getKey();
  const parts = encoded.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format");
  }
  const [ivB64, tagB64, dataB64] = parts as [string, string, string];
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
