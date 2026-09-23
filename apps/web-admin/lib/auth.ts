import "server-only";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { can, permissionsOf, type Permission, type Role } from "./permissions";
import { getRepo, type AuditInput } from "./repo";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "./session-token";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
  permissions: Permission[];
}

/**
 * The signed-in staff member, re-read from storage so a deactivated account or
 * a changed role takes effect on the next request, not when the cookie expires.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const claims = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const user = await (await getRepo()).getUser(claims.sub);
  if (!user || !user.isActive) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    permissions: permissionsOf(user.role),
  };
}

/** API guard: the user, or a 401/403 response to return as-is. */
export async function requireApi(permission: Permission): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!can(user.role, permission)) return NextResponse.json({ error: "ไม่มีสิทธิ์ทำรายการนี้" }, { status: 403 });
  return user;
}

/**
 * Page guard: the user when allowed, null when signed in without the right
 * (render <Forbidden />). A cookie for a deactivated or deleted account goes
 * back to the login page.
 */
export async function allowPage(permission: Permission): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return can(user.role, permission) ? user : null;
}

export async function startSession(user: {
  id: string; email: string; name: string | null; role: Role; mustChangePassword: boolean;
}): Promise<void> {
  const token = await signSession({
    sub: user.id, role: user.role, name: user.name ?? user.email, email: user.email,
    mustChangePassword: user.mustChangePassword,
  });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function endSession(): void {
  cookies().delete(SESSION_COOKIE);
}

export function clientIp(): string | null {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

/** Writes an audit entry for a staff action. Never throws into the caller's flow. */
export async function audit(user: { id: string } | null, entry: Omit<AuditInput, "userId" | "ip">): Promise<void> {
  try {
    await (await getRepo()).writeAudit({ ...entry, userId: user?.id ?? null, ip: clientIp() });
  } catch (e) {
    console.error("[audit] failed to write", entry.action, e);
  }
}
