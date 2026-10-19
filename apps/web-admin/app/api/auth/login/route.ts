import { NextResponse } from "next/server";
import { claimAttempt, clearHits, isCoreError, RATE } from "@mstgolf/core";
import { safeNextPath } from "@mstgolf/shared";
import { hashPassword, verifyPassword } from "@mstgolf/shared/password";
import { audit, clientIp, startSession } from "../../../../lib/auth";
import { currentOrg } from "../../../../lib/org";
import { findUserByLogin, updateUser } from "../../../../lib/users";

// Login attempts are counted in the database (serverless instances share no
// memory): 5 per account or 30 per IP within 15 minutes, then a pause. The
// account is the user, however they typed it (email or username); a name with
// no account is counted under that name.
const BUCKET = "staff_login_fail";
const WINDOW = 15 * RATE.MINUTE;

// Unknown names still pay for one scrypt check, so timing doesn't tell which accounts exist.
let dummyHash: Promise<string> | null = null;
const dummy = () => (dummyHash ??= hashPassword("not-a-real-password-" + Math.random()));
import { authConfigured } from "../../../../lib/session-token";

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
  // "email" carries what the person typed: an email, or a username without @.
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "กรอกอีเมลหรือชื่อผู้ใช้ และรหัสผ่าน" }, { status: 400 });
  }
  const org = await currentOrg();
  const ip = clientIp();
  const user = await findUserByLogin(email);
  const account = user ? `user:${user.id}` : `name:${email}`;
  try {
    await claimAttempt(org.id, BUCKET, [{ key: account, max: 5, windowMs: WINDOW }, { key: ip, max: 30, windowMs: WINDOW }], "ใส่รหัสผิดหลายครั้ง ลองใหม่ใน 15 นาที");
  } catch (e) {
    if (isCoreError(e)) return NextResponse.json({ error: e.message }, { status: 429 });
    throw e;
  }

  const ok = user ? user.isActive && (await verifyPassword(password, user.passwordHash)) : (await verifyPassword(password, await dummy()), false);
  if (!ok || !user) {
    await audit(null, { action: "auth.login_failed", entity: "user", entityId: user?.id ?? null, after: { email } });
    return NextResponse.json({ error: "อีเมล/ชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  await clearHits(org.id, BUCKET, account);
  await updateUser(user.id, { lastLoginAt: new Date() });
  await startSession(user);
  await audit(user, { action: "auth.login", entity: "user", entityId: user.id });
  return NextResponse.json({ ok: true, next: user.mustChangePassword ? "/account/password" : safeNextPath(body.next) });
}
