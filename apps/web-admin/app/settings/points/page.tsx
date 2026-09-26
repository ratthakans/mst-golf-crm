import Link from "next/link";
import { allowPage } from "../../../lib/auth";
import { currentOrg } from "../../../lib/org";
import { Forbidden } from "../../Forbidden";
import { NotificationsForm, PointsForm, PosForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function PointsSettingsPage() {
  if (!(await allowPage("settings.manage"))) return <Forbidden />;
  const { settings } = await currentOrg();
  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <Link href="/settings" className="back-link">← ตั้งค่า</Link>
        <h1 style={{ marginTop: 6 }}>แต้ม · POS · ข้อความแจ้งเตือน</h1>
      </div>
      <PointsForm welcomeBonus={settings.welcomeBonus} perBaht={settings.pointsPerBaht} />
      <PosForm memberTag={settings.pos.memberTag} skus={settings.pos.pointExcludedSkus} categories={settings.pos.pointExcludedCategories} />
      <NotificationsForm values={settings.notifications} />
    </div>
  );
}
