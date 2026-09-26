import Link from "next/link";
import { currentConsentTexts } from "@mstgolf/core";
import { allowPage } from "../../../lib/auth";
import { currentOrg } from "../../../lib/org";
import { Forbidden } from "../../Forbidden";
import { CounterForm } from "./CounterForm";

export const dynamic = "force-dynamic";

export default async function NewMemberPage() {
  if (!(await allowPage("members.create"))) return <Forbidden />;
  const org = await currentOrg();
  const texts = await currentConsentTexts(org.id);
  return (
    <>
      <div className="page-head">
        <Link href="/members" className="back-link">← สมาชิก</Link>
        <h1 style={{ marginTop: 6 }}>เพิ่มสมาชิกที่เคาน์เตอร์</h1>
        <p>
          ลูกค้าได้แต้มต้อนรับ {org.settings.welcomeBonus.toLocaleString("en-US")} แต้มเหมือนสมัครใน LINE · ถ้าเบอร์นี้เป็นสมาชิกอยู่แล้ว ระบบพาไปที่ข้อมูลเดิม ·
          ภายหลังลูกค้ากดสมัครใน LINE ด้วยเบอร์เดียวกัน บัญชีจะผูกกันเองโดยไม่ได้แต้มซ้ำ
        </p>
      </div>
      <div className="new-member-wrap">
        <CounterForm
          termsTitle={texts.terms?.title ?? "ข้อกำหนดสมาชิกและนโยบายความเป็นส่วนตัว"}
          termsBody={texts.terms?.body ?? ""}
          marketingBody={texts.marketing?.body ?? "รับข่าวสารและโปรโมชั่นผ่าน LINE"}
        />
      </div>
    </>
  );
}
