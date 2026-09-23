import Link from "next/link";
import { allowPage } from "../../../lib/auth";
import { getRepo } from "../../../lib/repo";
import { Forbidden } from "../../Forbidden";
import { SignupForm } from "../../register/SignupForm";

export default async function NewMemberPage() {
  if (!(await allowPage("members.create"))) return <Forbidden />;
  const repo = await getRepo();
  const [org, fields] = await Promise.all([repo.getOrg(), repo.getFieldDefinitions()]);

  return (
    <>
      <div className="page-head">
        <Link href="/members" className="back-link">← สมาชิก</Link>
        <h1 style={{ marginTop: 6 }}>เพิ่มสมาชิก</h1>
        <p>
          สมัครให้ลูกค้าที่เคาน์เตอร์ ระบบเช็กเบอร์ซ้ำให้ ถ้าเบอร์นี้เป็นสมาชิกอยู่แล้วจะพาไปที่ข้อมูลเดิมแทน
        </p>
      </div>
      <div className="new-member-wrap">
        <SignupForm
          mode="admin"
          orgName={org.name}
          fields={fields}
          consentText={org.consentText}
          signupBonus={org.signupBonus}
        />
      </div>
    </>
  );
}
