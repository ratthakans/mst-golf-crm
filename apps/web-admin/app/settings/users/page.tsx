import { allowPage } from "../../../lib/auth";
import { getRepo } from "../../../lib/repo";
import { ROLE_LABEL, ROLES } from "../../../lib/permissions";
import { Forbidden } from "../../Forbidden";
import { UsersAdmin, type UserRow } from "./UsersAdmin";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await allowPage("users.manage");
  if (!me) return <Forbidden />;

  const users = await (await getRepo()).listUsers();
  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name ?? "",
    role: u.role,
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  }));

  return (
    <>
      <div className="page-head">
        <h1>ผู้ใช้และสิทธิ์</h1>
        <p>บัญชีพนักงานที่เข้าหลังบ้านได้ · สร้างบัญชีแล้วระบบออกรหัสผ่านชั่วคราวให้ พนักงานต้องเปลี่ยนเองตอนเข้าครั้งแรก</p>
      </div>
      <UsersAdmin
        rows={rows}
        meId={me.id}
        roles={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
      />
    </>
  );
}
