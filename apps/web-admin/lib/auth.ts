import "server-only";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { db, writeAudit, type Actor } from "@mstgolf/core";
import { currentOrg } from "./org";
import { can, permissionsOf, type Permission, type Role } from "./permissions";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "./session-token";
import { getUser } from "./users";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
  permissions: Permission[];
}

/**
 * The signed-in staff member, re-read from the database so a deactivated
 * account or a changed role takes effect on the next request.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const claims = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const user = await getUser(claims.sub);
  if (!user || !user.isActive) return null;
  const org = await currentOrg();
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    permissions: permissionsOf(user.role, { intelligence: org.settings.features.intelligence, rewards: org.settings.features.rewards }),
  };
}

/** The staff member as an actor for @mstgolf/core (audit trail, limits). */
export function actorOf(user: SessionUser): Actor {
  return { kind: "staff", userId: user.id, role: user.role, ip: clientIp() };
}

/** API guard: the user, or a 401/403 response to return as-is. */
export async function requireApi(permission: Permission): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!user.permissions.includes(permission)) return NextResponse.json({ error: "ไม่มีสิทธิ์ทำรายการนี้" }, { status: 403 });
  return user;
}

/**
 * Page guard: the user when allowed, null when signed in without the right
 * (render <Forbidden />). No session → the login page.
 */
export async function allowPage(permission: Permission): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user.permissions.includes(permission) ? user : null;
}

export function hasPermission(user: SessionUser, permission: Permission): boolean {
  return user.permissions.includes(permission) && can(user.role, permission);
}

export async function startSession(user: { id: string; email: string; name: string | null; role: Role; mustChangePassword: boolean }): Promise<void> {
  const token = await signSession({
    sub: user.id,
    role: user.role,
    name: user.name ?? user.email,
    email: user.email,
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

/** Audit entry for actions outside @mstgolf/core (logins, users). Never throws into the caller. */
export async function audit(
  user: { id: string } | null,
  entry: { action: string; entity: string; entityId?: string | null; before?: unknown; after?: unknown; reason?: string | null },
): Promise<void> {
  try {
    const org = await currentOrg();
    await writeAudit(db(org.id), org.id, user ? { kind: "staff", userId: user.id, role: "SUPER_ADMIN", ip: clientIp() } : { kind: "system" }, entry);
  } catch (e) {
    console.error("[audit] failed to write", entry.action, e);
  }
}
