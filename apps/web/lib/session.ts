import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

// Customer session (docs/PRODUCT.md §3). After the visitor proves who they are
// — an SMS code for their mobile number, or LINE when the tenant has LINE on —
// we keep only that proof in a signed, httpOnly cookie. The member is resolved
// from it on every request, never from the request body. A different key from
// the back office (AUTH_SECRET), so neither cookie can be replayed as the other.

export const MEMBER_COOKIE = "mst_member";
export const MEMBER_TTL_SECONDS = 30 * 24 * 60 * 60;
/** A verified phone that has not finished signing up — long enough to fill the form. */
const PHONE_TTL_SECONDS = 30 * 60;

export interface LineUser {
  sub: string; // LINE user id
  name: string;
  picture: string | null;
}

export type Customer =
  | { kind: "member"; memberId: string } // signed in with a mobile number
  | { kind: "phone"; phone: string } // proved the number, sign-up not finished
  | ({ kind: "line" } & LineUser); // signed in with LINE

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

export async function signCustomerSession(c: Customer): Promise<{ token: string; maxAge: number }> {
  const key = secretKey();
  if (!key) throw new Error("CUSTOMER_AUTH_SECRET is not configured (32+ characters)");
  const maxAge = c.kind === "phone" ? PHONE_TTL_SECONDS : MEMBER_TTL_SECONDS;
  const claims = c.kind === "line" ? { typ: "line", name: c.name, picture: c.picture } : { typ: c.kind };
  const sub = c.kind === "member" ? c.memberId : c.kind === "phone" ? c.phone : c.sub;
  const token = await new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setIssuedAt().setExpirationTime(`${maxAge}s`).sign(key);
  return { token, maxAge };
}

/** LINE sign-in (LIFF / LINE Login) — kept for when the tenant switches LINE on. */
export async function signMemberSession(user: LineUser): Promise<string> {
  return (await signCustomerSession({ kind: "line", ...user })).token;
}

export async function verifyCustomerSession(token: string | undefined): Promise<Customer | null> {
  const key = secretKey();
  if (!token || !key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    if (payload.typ === "member") return { kind: "member", memberId: payload.sub };
    if (payload.typ === "phone") return { kind: "phone", phone: payload.sub };
    // "line", and cookies issued before sign-in by phone existed.
    return {
      kind: "line",
      sub: payload.sub,
      name: typeof payload.name === "string" ? payload.name : "",
      picture: typeof payload.picture === "string" ? payload.picture : null,
    };
  } catch {
    return null;
  }
}

/** Who the current request belongs to (server components and route handlers). */
export async function currentCustomer(): Promise<Customer | null> {
  return verifyCustomerSession(cookies().get(MEMBER_COOKIE)?.value);
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MEMBER_TTL_SECONDS,
};
