import { jwtVerify, SignJWT } from "jose";
import { isRole, type Role } from "./permissions";

// Signed session cookie (HS256 JWT). Edge-safe — the middleware verifies it on
// every request; server code additionally re-checks the user is still active.

export const SESSION_COOKIE = "mst_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // one working day, then sign in again

export interface SessionClaims {
  sub: string; // user id
  role: Role;
  name: string;
  email: string;
  mustChangePassword: boolean;
}

// Local dev works without configuration; production refuses to sign or verify
// anything until AUTH_SECRET (32+ chars) is set.
const DEV_SECRET = "dev-only-secret-never-used-in-production-000";

function secretKey(): Uint8Array | null {
  const s = process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? "" : DEV_SECRET);
  return s.length >= 32 ? new TextEncoder().encode(s) : null;
}

export function authConfigured(): boolean {
  return secretKey() !== null;
}

export async function signSession(claims: SessionClaims): Promise<string> {
  const key = secretKey();
  if (!key) throw new Error("AUTH_SECRET is not configured (32+ characters)");
  return new SignJWT({ role: claims.role, name: claims.name, email: claims.email, mcp: claims.mustChangePassword })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key);
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  const key = secretKey();
  if (!token || !key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (!payload.sub || !isRole(payload.role)) return null;
    return {
      sub: payload.sub,
      role: payload.role,
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
      mustChangePassword: payload.mcp === true,
    };
  } catch {
    return null;
  }
}
