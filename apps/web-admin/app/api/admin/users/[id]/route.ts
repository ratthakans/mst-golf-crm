import { NextResponse } from "next/server";
import { hashPassword, temporaryPassword } from "@mstgolf/shared/password";
import { audit, requireApi } from "../../../../../lib/auth";
import { isRole } from "../../../../../lib/permissions";
import { getRepo } from "../../../../../lib/repo";

type Body =
  | { action: "role"; role: string }
  | { action: "deactivate" }
  | { action: "activate" }
  | { action: "reset_password" };

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireApi("users.manage");
  if (admin instanceof NextResponse) return admin;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const repo = await getRepo();
  const target = await repo.getUser(params.id);
  if (!target) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });

  const self = target.id === admin.id;
  // The org must always keep at least one active Super Admin.
  const otherActiveAdmins = (await repo.listUsers()).filter(
    (u) => u.id !== target.id && u.isActive && u.role === "SUPER_ADMIN",
  ).length;
  const removesLastAdmin = target.role === "SUPER_ADMIN" && target.isActive && otherActiveAdmins === 0;

  switch (body.action) {
    case "role": {
      if (!isRole(body.role)) return NextResponse.json({ error: "สิทธิ์ไม่ถูกต้อง" }, { status: 400 });
      if (self) return NextResponse.json({ error: "เปลี่ยนสิทธิ์ของตัวเองไม่ได้" }, { status: 400 });
      if (removesLastAdmin && body.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน" }, { status: 400 });
      }
      await repo.updateUser(target.id, { role: body.role });
      await audit(admin, { action: "user.role_change", entity: "user", entityId: target.id, before: { role: target.role }, after: { role: body.role } });
      return NextResponse.json({ ok: true });
    }
    case "deactivate": {
      if (self) return NextResponse.json({ error: "ปิดบัญชีของตัวเองไม่ได้" }, { status: 400 });
      if (removesLastAdmin) return NextResponse.json({ error: "ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน" }, { status: 400 });
      await repo.updateUser(target.id, { isActive: false });
      await audit(admin, { action: "user.deactivate", entity: "user", entityId: target.id });
      return NextResponse.json({ ok: true });
    }
    case "activate": {
      await repo.updateUser(target.id, { isActive: true });
      await audit(admin, { action: "user.activate", entity: "user", entityId: target.id });
      return NextResponse.json({ ok: true });
    }
    case "reset_password": {
      const tempPassword = temporaryPassword();
      await repo.updateUser(target.id, { passwordHash: await hashPassword(tempPassword), mustChangePassword: true });
      await audit(admin, { action: "user.password_reset", entity: "user", entityId: target.id });
      return NextResponse.json({ ok: true, tempPassword });
    }
    default:
      return NextResponse.json({ error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
  }
}
