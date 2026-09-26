import { NextResponse } from "next/server";
import { hashPassword, temporaryPassword } from "@mstgolf/shared/password";
import { audit, requireApi } from "../../../../lib/auth";
import { isRole } from "../../../../lib/permissions";
import { createUser, DuplicateUserError } from "../../../../lib/users";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Create a staff account. The temporary password is returned once, shown to
// the admin once, and must be changed at first sign-in.
export async function POST(req: Request) {
  const admin = await requireApi("users.manage");
  if (admin instanceof NextResponse) return admin;

  let body: { email?: string; name?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim() || null;
  if (!EMAIL.test(email)) return NextResponse.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
  if (!isRole(body.role)) return NextResponse.json({ error: "เลือกสิทธิ์ผู้ใช้" }, { status: 400 });

  const tempPassword = temporaryPassword();
  try {
    const user = await createUser({
      email, name, role: body.role, passwordHash: await hashPassword(tempPassword), mustChangePassword: true,
    });
    await audit(admin, { action: "user.create", entity: "user", entityId: user.id, after: { email, name, role: user.role } });
    return NextResponse.json({ userId: user.id, tempPassword }, { status: 201 });
  } catch (e) {
    if (e instanceof DuplicateUserError) return NextResponse.json({ error: "อีเมลนี้มีบัญชีอยู่แล้ว" }, { status: 409 });
    throw e;
  }
}
