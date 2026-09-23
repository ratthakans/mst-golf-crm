import { redirect } from "next/navigation";
import { getSessionUser } from "../../../lib/auth";
import { PasswordForm } from "./PasswordForm";

export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account/password");

  return (
    <>
      <div className="page-head">
        <h1>เปลี่ยนรหัสผ่าน</h1>
        <p>
          {user.mustChangePassword
            ? "บัญชีนี้ใช้รหัสผ่านชั่วคราวอยู่ ตั้งรหัสผ่านของคุณเองก่อนเริ่มใช้งาน"
            : `บัญชี ${user.email}`}
        </p>
      </div>
      <div className="new-member-wrap" style={{ maxWidth: 480 }}>
        <PasswordForm forced={user.mustChangePassword} />
      </div>
    </>
  );
}
