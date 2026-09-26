import Link from "next/link";
import { allowPage } from "../../../lib/auth";
import { currentOrg } from "../../../lib/org";
import { Forbidden } from "../../Forbidden";
import { SiteForm } from "./SiteForm";

export const dynamic = "force-dynamic";

export default async function SiteSettingsPage() {
  if (!(await allowPage("settings.manage"))) return <Forbidden />;
  const { settings } = await currentOrg();
  return (
    <>
      <div className="page-head">
        <Link href="/settings" className="back-link">← ตั้งค่า</Link>
        <h1 style={{ marginTop: 6 }}>เว็บไซต์และร้าน</h1>
        <p>ข้อมูลที่แสดงบนเว็บไซต์และในข้อความ LINE</p>
      </div>
      <SiteForm values={settings.site} />
    </>
  );
}
