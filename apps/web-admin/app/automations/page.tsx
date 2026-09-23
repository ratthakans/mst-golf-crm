import { allowPage } from "../../lib/auth";
import { getCrmData } from "../../lib/data";
import { Forbidden } from "../Forbidden";

function actionText(a: { type: string; template?: string; label?: string; amount?: number }): string {
  if (a.type === "send_message") return `ส่งข้อความ: "${a.template}"`;
  if (a.type === "grant_coupon") return `แจกคูปอง: ${a.label}`;
  if (a.type === "grant_points") return `ให้ ${a.amount} แต้ม`;
  return a.type;
}

function triggerText(t: { type: string; days?: number; minProgress?: number; minProbability?: number; minClv?: number }): string {
  switch (t.type) {
    case "no_activity_days": return `ไม่มีความเคลื่อนไหวเกิน ${t.days} วัน`;
    case "near_tier_up": return `ยอดซื้อ 12 เดือนถึง ${Math.round((t.minProgress ?? 0) * 100)}% ของระดับถัดไป`;
    case "high_churn_risk": return `ความเสี่ยงหลุด ≥ ${t.minProbability}`;
    case "vip_by_clv": return `CLV คาดการณ์ ≥ ฿${(t.minClv ?? 0).toLocaleString("en-TH")}`;
    default: return t.type;
  }
}

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  if (!(await allowPage("automations.view"))) return <Forbidden />;
  const { automations } = await getCrmData();

  return (
    <>
      <div className="page-head">
        <h1>ระบบอัตโนมัติ</h1>
        <p>ทริกเกอร์เชิงพฤติกรรม + สถิติ แต่ละอันบอกว่าตอนนี้ใครเข้าเงื่อนไข — คือกลุ่มที่ระบบจะยิงให้อัตโนมัติ</p>
      </div>

      <div className="grid grid-2">
        {automations.map(({ automation, eligible }) => (
          <div className="card automation-card" key={automation.id}>
            <div className="auto-head">
              <span className="auto-name">{automation.name}</span>
              <span className={`auto-toggle ${automation.enabled ? "on" : "off"}`}>
                {automation.enabled ? "เปิด" : "ปิด"}
              </span>
            </div>
            <div className="auto-rule">
              <span className="auto-when">เมื่อ</span> {triggerText(automation.trigger)}
            </div>
            <div className="auto-rule">
              <span className="auto-then">ทำ</span> {actionText(automation.action)}
            </div>
            <div className="auto-audience">
              <span className="auto-count">{eligible.length}</span> คนเข้าเงื่อนไขตอนนี้
              {eligible.length > 0 && (
                <span className="auto-names">
                  {eligible.slice(0, 4).map((p) => p.displayName).join(", ")}
                  {eligible.length > 4 ? "…" : ""}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
