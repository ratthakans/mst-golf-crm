import Link from "next/link";
import { lineChannelStatus, lineConfig, quotaConsumption } from "@mstgolf/core";
import { allowPage } from "../../../lib/auth";
import { currentOrg } from "../../../lib/org";
import { Forbidden } from "../../Forbidden";
import { formatDateTime, num } from "../../ui/format";
import { LineForm } from "./LineForm";

export const dynamic = "force-dynamic";

export default async function LineSettingsPage() {
  if (!(await allowPage("settings.manage"))) return <Forbidden />;
  const org = await currentOrg();
  const [status, config] = await Promise.all([lineChannelStatus(org.id), lineConfig(org.id)]);
  const quota = config ? await quotaConsumption(config.accessToken) : null;
  const site = org.settings.site.siteUrl ?? "https://<โดเมนเว็บไซต์>";
  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <Link href="/settings" className="back-link">← ตั้งค่า</Link>
        <h1 style={{ marginTop: 6 }}>LINE</h1>
        <p>ทีม LINE ดูแล OA, Rich Menu, auto reply และแชต · ระบบใช้แค่ Messaging API (ส่งข้อความรายคน) กับ LINE Login/LIFF (หน้าสมาชิกและหน้าจอง)</p>
      </div>

      <div className="card">
        <h3>สถานะ</h3>
        {status ? (
          <dl className="kv">
            <dt>Messaging API</dt>
            <dd className="mono">{status.channelId}</dd>
            <dt>LINE Login</dt>
            <dd className="mono">{status.loginChannelId ?? <span className="danger-text">ยังไม่ได้ใส่ — ลูกค้ายังล็อกอินไม่ได้</span>}</dd>
            <dt>LIFF</dt>
            <dd className="mono">{status.liffId ?? <span className="danger-text">ยังไม่ได้ใส่</span>}</dd>
            <dt>ข้อความที่ส่งเดือนนี้</dt>
            <dd>{quota === null ? "อ่านไม่ได้ (ตรวจ access token)" : `${num(quota)} ข้อความ`}</dd>
            <dt>อัปเดตล่าสุด</dt>
            <dd>{formatDateTime(status.updatedAt)}</dd>
          </dl>
        ) : (
          <p className="muted">ยังไม่ได้เชื่อม — ระหว่างนี้ระบบทำงานได้ทุกอย่าง แต่ยังไม่ส่งข้อความ LINE และลูกค้ายังสมัครผ่าน LINE ไม่ได้</p>
        )}
      </div>

      <div className="card">
        <h3>ส่งให้ทีม LINE</h3>
        <dl className="kv">
          <dt>ปุ่ม A+B สมัครสมาชิก</dt>
          <dd className="mono">{status?.liffId ? `https://liff.line.me/${status.liffId}/member` : "(ได้หลังใส่ LIFF ID)"}</dd>
          <dt>ปุ่ม D Booking Golf Sim</dt>
          <dd className="mono">{status?.liffId ? `https://liff.line.me/${status.liffId}/booking` : "(ได้หลังใส่ LIFF ID)"}</dd>
          <dt>LIFF endpoint URL</dt>
          <dd className="mono">{site}/app</dd>
          <dt>LINE Login callback URL</dt>
          <dd className="mono">{site}/app</dd>
        </dl>
        <p className="secret-note" style={{ marginTop: 12 }}>
          สิ่งที่ต้องได้จากทีม LINE: (1) เปิด Messaging API ของ OA แล้วส่ง Channel ID, Channel secret และ Channel access token (long-lived)
          (2) LINE Login channel ที่อยู่ <b>Provider เดียวกับ OA</b> พร้อม LIFF app ขนาด Full ชี้ endpoint ด้านบน และเปิด “Add friend option” — ถ้าอยู่คนละ Provider ลูกค้าคนเดียวจะได้ UID สองค่า ·
          ไม่ต้องตั้ง webhook และไม่ต้องเปลี่ยน Rich Menu รายคน
        </p>
      </div>

      <LineForm status={status ? { channelId: status.channelId, liffId: status.liffId ?? "", loginChannelId: status.loginChannelId ?? "" } : null} />
    </div>
  );
}
