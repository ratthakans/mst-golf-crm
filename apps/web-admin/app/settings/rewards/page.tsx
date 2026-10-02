import Link from "next/link";
import { emailConfigured } from "@mstgolf/core";
import { allowPage } from "../../../lib/auth";
import { currentOrg } from "../../../lib/org";
import { Forbidden } from "../../Forbidden";
import { RedemptionForm } from "./RedemptionForm";

export const dynamic = "force-dynamic";

export default async function RewardSettingsPage() {
  if (!(await allowPage("settings.manage"))) return <Forbidden />;
  const { settings } = await currentOrg();
  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <Link href="/settings" className="back-link">← ตั้งค่า</Link>
        <h1 style={{ marginTop: 6 }}>การแลกรางวัล</h1>
        <p>รางวัลและคูปองตั้งที่ <Link href="/rewards/catalog">รางวัล › แคตตาล็อก</Link> · หน้านี้ตั้งว่าใครได้อีเมลเมื่อมีคำขอแลกของ</p>
      </div>
      <RedemptionForm alertEmails={settings.redemption.alertEmails} backofficeUrl={settings.redemption.backofficeUrl ?? null} mailer={emailConfigured()} />
    </div>
  );
}
