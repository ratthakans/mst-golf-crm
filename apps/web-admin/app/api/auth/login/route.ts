import { NextResponse } from "next/server";
import { verifyPassword } from "@mstgolf/shared/password";
import { audit, startSession } from "../../../../lib/auth";
import { clearFailures, isLocked, recordFailure } from "../../../../lib/login-throttle";
import { findUserByEmail, updateUser } from "../../../../lib/users";
import { authConfigured } from "../../../../lib/session-token";

/** Only same-site paths, never "//evil.com". */
function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function POST(req: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ error: "ระบบยังไม่ได้ตั้งค่า AUTH_SECRET — ติดต่อผู้ดูแลระบบ" }, { status: 503 });
  }
  let body: { email?: string; password?: string; next?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "กรอกอีเมลและรหัสผ่าน" }, { status: 400 });
  }
  if (isLocked(email)) {
    return NextResponse.json({ error: "ใส่รหัสผิดหลายครั้ง ลองใหม่ใน 15 นาที" }, { status: 429 });
  }

  const user = await findUserByEmail(email);
  const ok = !!user && user.isActive && (await verifyPassword(password, user.passwordHash));
  if (!ok || !user) {
    recordFailure(email);
    await audit(null, { action: "auth.login_failed", entity: "user", entityId: user?.id ?? null, after: { email } });
    return NextResponse.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  clearFailures(email);
  await updateUser(user.id, { lastLoginAt: new Date() });
  await startSession(user);
  await audit(user, { action: "auth.login", entity: "user", entityId: user.id });
  return NextResponse.json({ ok: true, next: user.mustChangePassword ? "/account/password" : safeNext(body.next) });
}
