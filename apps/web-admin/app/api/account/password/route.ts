import { NextResponse } from "next/server";
import { hashPassword, passwordProblem, verifyPassword } from "@mstgolf/shared/password";
import { audit, getSessionUser, startSession } from "../../../../lib/auth";
import { getUser, updateUser } from "../../../../lib/users";

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  let body: { current?: string; next?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const user = await getUser(session.id);
  if (!user) return NextResponse.json({ error: "ไม่พบบัญชี" }, { status: 404 });

  if (!(await verifyPassword(body.current ?? "", user.passwordHash))) {
    return NextResponse.json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, { status: 400 });
  }
  const next = body.next ?? "";
  const problem = passwordProblem(next);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (next === body.current) return NextResponse.json({ error: "รหัสผ่านใหม่ต้องไม่ซ้ำรหัสเดิม" }, { status: 400 });

  // A new sessionVersion signs out every other session; this one is re-issued with it.
  const updated = await updateUser(user.id, { passwordHash: await hashPassword(next), mustChangePassword: false, sessionVersion: user.sessionVersion + 1 });
  await startSession(updated);
  await audit(session, { action: "user.password_change", entity: "user", entityId: user.id });
  return NextResponse.json({ ok: true });
}
