import Link from "next/link";
import { allowPage } from "../../../lib/auth";
import { currentOrg } from "../../../lib/org";
import { Forbidden } from "../../Forbidden";
import { TiersForm } from "./TiersForm";

export const dynamic = "force-dynamic";

export default async function TiersPage() {
  if (!(await allowPage("settings.manage"))) return <Forbidden />;
  const org = await currentOrg();
  return (
    <>
      <div className="page-head">
        <Link href="/settings" className="back-link">← ตั้งค่า</Link>
        <h1 style={{ marginTop: 6 }}>ระดับสมาชิก</h1>
        <p>
          ระดับคิดจากยอดซื้อสุทธิย้อนหลัง 12 เดือน (ไม่ใช่แต้มคงเหลือ) · ถึงเกณฑ์เมื่อไรขึ้นทันที · ยอดลดลงจะปรับลงเฉพาะวันที่ 1 ของเดือน ·
          อัตราแต้มคูณกับแต้มฐาน (1 บาท = {org.settings.pointsPerBaht} แต้ม)
        </p>
      </div>
      <TiersForm tiers={org.settings.tiers} />
    </>
  );
}
