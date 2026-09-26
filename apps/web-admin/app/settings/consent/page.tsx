import Link from "next/link";
import { currentConsentTexts } from "@mstgolf/core";
import { allowPage } from "../../../lib/auth";
import { currentOrg } from "../../../lib/org";
import { Forbidden } from "../../Forbidden";
import { formatDateTime } from "../../ui/format";
import { ConsentForm } from "./ConsentForm";

export const dynamic = "force-dynamic";

export default async function ConsentPage() {
  if (!(await allowPage("settings.manage"))) return <Forbidden />;
  const org = await currentOrg();
  const { terms, marketing } = await currentConsentTexts(org.id);
  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <Link href="/settings" className="back-link">← ตั้งค่า</Link>
        <h1 style={{ marginTop: 6 }}>ข้อความ PDPA</h1>
        <p>ทุกครั้งที่แก้ ระบบออกเวอร์ชันใหม่ ความยินยอมของสมาชิกแต่ละคนเก็บคู่กับเวอร์ชันที่เขาเห็นจริง · ให้ฝ่ายกฎหมายของ MST ตรวจก่อนเปิดใช้</p>
      </div>
      {[
        { purpose: "TERMS" as const, current: terms, label: "ข้อกำหนดสมาชิกและนโยบายความเป็นส่วนตัว (บังคับ)" },
        { purpose: "MARKETING" as const, current: marketing, label: "รับข่าวสารและโปรโมชั่น (เลือกได้)" },
      ].map((c) => (
        <div className="card" key={c.purpose}>
          <h3>{c.label}</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            {c.current ? `ฉบับปัจจุบัน ${c.current.version} · ใช้ตั้งแต่ ${formatDateTime(c.current.effectiveAt)}` : "ยังไม่มีข้อความ"}
          </p>
          <ConsentForm purpose={c.purpose} title={c.current?.title ?? ""} body={c.current?.body ?? ""} />
        </div>
      ))}
    </div>
  );
}
