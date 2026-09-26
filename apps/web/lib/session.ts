import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

// Customer session (MST-DEV-PLAN §2 "การยืนยันตัวลูกค้า"). After LINE verifies
// the ID token we keep only the LINE user in a signed, httpOnly cookie. The
// member is resolved from it on every request — never from the request body.
// A different key from the back office (AUTH_SECRET), so neither cookie can be
// replayed as the other.

export const MEMBER_COOKIE = "mst_member";
export const MEMBER_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface LineUser {
  sub: string; // LINE user id
  name: string;
  picture: string | null;
}

// Local dev works without configuration; production refuses to sign or verify
// anything until CUSTOMER_AUTH_SECRET (32+ chars) is set.
const DEV_SECRET = "dev-only-customer-secret-never-used-in-production";

function secretKey(): Uint8Array | null {
  const s = process.env.CUSTOMER_AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? "" : DEV_SECRET);
  return s.length >= 32 ? new TextEncoder().encode(s) : null;
}

export function sessionConfigured(): boolean {
  return secretKey() !== null;
}

export async function signMemberSession(user: LineUser): Promise<string> {
  const key = secretKey();
  if (!key) throw new Error("CUSTOMER_AUTH_SECRET is not configured (32+ characters)");
  return new SignJWT({ name: user.name, picture: user.picture })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime(`${MEMBER_TTL_SECONDS}s`)
    .sign(key);
}

export async function verifyMemberSession(token: string | undefined): Promise<LineUser | null> {
  const key = secretKey();
  if (!token || !key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      name: typeof payload.name === "string" ? payload.name : "",
      picture: typeof payload.picture === "string" ? payload.picture : null,
    };
  } catch {
    return null;
  }
}

/** The LINE user of the current request (server components and route handlers). */
export async function currentLineUser(): Promise<LineUser | null> {
  return verifyMemberSession(cookies().get(MEMBER_COOKIE)?.value);
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MEMBER_TTL_SECONDS,
};
