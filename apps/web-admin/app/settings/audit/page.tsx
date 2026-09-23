import { allowPage } from "../../../lib/auth";
import { getRepo } from "../../../lib/repo";
import { Forbidden } from "../../Forbidden";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "auth.login": "เข้าสู่ระบบ",
  "auth.login_failed": "เข้าสู่ระบบไม่สำเร็จ",
  "auth.logout": "ออกจากระบบ",
  "user.create": "สร้างผู้ใช้",
  "user.role_change": "เปลี่ยนสิทธิ์",
  "user.deactivate": "ปิดใช้งานผู้ใช้",
  "user.activate": "เปิดใช้งานผู้ใช้",
  "user.password_reset": "ตั้งรหัสชั่วคราว",
  "user.password_change": "เปลี่ยนรหัสผ่าน",
  "member.create": "สร้างสมาชิก",
  "member.photo_set": "อัปโหลดรูปสมาชิก",
  "member.photo_remove": "ลบรูปสมาชิก",
  "sale.record": "บันทึกการซื้อ",
  "import.run": "นำเข้า POS",
};

function detail(v: unknown): string {
  if (v === null || v === undefined) return "";
  return Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => `${k}: ${typeof x === "object" ? JSON.stringify(x) : String(x)}`)
    .join(" · ");
}

export default async function AuditPage() {
  if (!(await allowPage("audit.view"))) return <Forbidden />;
  const rows = await (await getRepo()).listAudit(300);

  return (
    <>
      <div className="page-head">
        <h1>บันทึกการใช้งาน</h1>
        <p>ใครทำอะไรในหลังบ้าน เมื่อไร — 300 รายการล่าสุด</p>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>เวลา</th><th>ผู้ใช้</th><th>รายการ</th><th>รายละเอียด</th><th>IP</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} style={{ color: "var(--muted)" }}>ยังไม่มีรายการ</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.createdAt.toLocaleString("en-GB")}</td>
                  <td>{r.userName ?? "—"}</td>
                  <td>{ACTION_LABEL[r.action] ?? r.action}</td>
                  <td className="audit-detail">
                    {[r.entityId && `${r.entity} ${r.entityId}`, detail(r.before) && `ก่อน ${detail(r.before)}`, detail(r.after) && `หลัง ${detail(r.after)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </td>
                  <td className="mono">{r.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
