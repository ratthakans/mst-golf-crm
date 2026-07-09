import { getQuoteData } from "../../lib/data";
import { QuoteView } from "./QuoteView";

export default async function QuotePage() {
  const q = await getQuoteData();
  return (
    <>
      <div className="page-head no-print">
        <h1>ใบเสนอราคา &amp; ROI</h1>
        <p>เครื่องมือปิดการขาย — ดึงตัวเลขจริงจากฐานลูกค้ามาคำนวณว่าระบบคืนทุนกี่เดือน เลือกแพ็กเกจ/อัตรากู้กลับ แล้วพิมพ์เป็น PDF ส่งลูกค้าได้เลย</p>
      </div>
      <QuoteView
        orgName="MST Golf"
        currency={q.org.currency}
        totalMembers={q.totalMembers}
        atRiskCount={q.atRiskCount}
        moneyAtRisk={q.moneyAtRisk}
        avgAnnualValue={q.avgAnnualValue}
        projectedAnnual={q.projectedAnnual}
        churnDays={q.org.churnDays}
      />
    </>
  );
}
