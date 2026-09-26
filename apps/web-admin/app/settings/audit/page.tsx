import { allowPage } from "../../../lib/auth";
import { listAudit } from "../../../lib/users";
import { Forbidden } from "../../Forbidden";
import { formatDateTime } from "../../ui/format";

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
  "member.update": "แก้ไขข้อมูลสมาชิก",
  "member.merge": "รวมบัญชี",
  "member.erase": "ลบข้อมูลสมาชิก (PDPA)",
  "points.adjust": "ปรับแต้ม",
  "import.commit": "นำเข้า POS",
  "import.rollback": "ยกเลิกการนำเข้า POS",
  "booking.create": "สร้างการจอง",
  "booking.move": "ย้ายการจอง",
  "booking.cancel": "ยกเลิกการจอง",
  "booking.check_in": "เช็กอิน",
  "booking.no_show": "ไม่มาตามนัด",
  "booking.payment": "บันทึกยอดชำระ",
  "lane.block": "ปิด lane",
  "lane.unblock": "เปิด lane",
  "lane.create": "เพิ่ม lane",
  "lane.update": "แก้ไข lane",
  "store.create": "เพิ่มสาขา",
  "store.update": "แก้ไขสาขา",
  "post.create": "สร้างบทความ",
  "post.update": "แก้ไขบทความ",
  "post.delete": "ลบบทความ",
  "consent_text.publish": "ออกข้อความ PDPA ใหม่",
  "line.save": "ตั้งค่า LINE",
  "review.merge_request": "ขอรวมบัญชี",
  "review.erase_request": "ขอลบข้อมูล",
  "review.resolve": "ปิดเรื่องในคิวตรวจสอบ",
  "settings.tiers": "ตั้งค่าระดับสมาชิก",
  "settings.points": "ตั้งค่าแต้ม",
  "settings.booking": "ตั้งค่าการจอง",
  "settings.notifications": "ตั้งค่าข้อความ LINE",
  "settings.pos": "ตั้งค่า POS",
  "settings.site": "ตั้งค่าเว็บไซต์",
};

function detail(v: unknown): string {
  if (v === null || v === undefined) return "";
  return Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => `${k}: ${typeof x === "object" ? JSON.stringify(x) : String(x)}`)
    .join(" · ")
    .slice(0, 400);
}

export default async function AuditPage() {
  if (!(await allowPage("audit.view"))) return <Forbidden />;
  const rows = await listAudit({ limit: 300 });

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
                  <td className="mono nowrap">{formatDateTime(r.createdAt)}</td>
                  <td>{r.userName ?? "—"}</td>
                  <td>{ACTION_LABEL[r.action] ?? r.action}{r.reason && <span className="sub">{r.reason}</span>}</td>
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
