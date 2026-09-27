import Link from "next/link";
import { lineChannelStatus, shopifyStatus } from "@mstgolf/core";
import { allowPage } from "../../lib/auth";
import { currentOrg } from "../../lib/org";
import { Forbidden } from "../Forbidden";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await allowPage("settings.manage");
  if (!user) return <Forbidden />;
  const org = await currentOrg();
  const [line, shop] = await Promise.all([lineChannelStatus(org.id), shopifyStatus(org.id)]);
  const links = [
    { href: "/settings/tiers", title: "ระดับสมาชิก", desc: `${org.settings.tiers.map((t) => t.name).join(" · ")} — เกณฑ์ยอดซื้อ 12 เดือน อัตราแต้ม และสิทธิประโยชน์` },
    { href: "/settings/points", title: "แต้ม · POS · ข้อความแจ้งเตือน", desc: `แต้มต้อนรับ ${org.settings.welcomeBonus.toLocaleString("en-US")} · ${org.settings.pos.memberTag}: ในหมายเหตุบิล · เปิด/ปิดข้อความ LINE แต่ละแบบ` },
    { href: "/settings/booking", title: "การจองซิม", desc: "เวลาเปิดร้าน lane ราคา และกติกาการจอง/ยกเลิก/no-show" },
    { href: "/settings/consent", title: "ข้อความ PDPA", desc: "ข้อกำหนดสมาชิก นโยบายความเป็นส่วนตัว และการรับข่าวสาร (มีเวอร์ชัน)" },
    { href: "/settings/line", title: "LINE", desc: line ? `เชื่อมแล้ว · Messaging API ${line.channelId}${line.liffId ? " · LIFF พร้อม" : " · ยังไม่มี LIFF"}` : "ยังไม่ได้เชื่อม — รอข้อมูลจากทีม LINE" },
    { href: "/settings/shopify", title: "ร้านออนไลน์ (Shopify)", desc: shop ? `${shop.shopDomain} · ${shop.isActive ? "ดึงคำสั่งซื้อทุกคืน" : "ปิดอยู่"}` : "ยังไม่ได้เชื่อม — คำสั่งซื้อออนไลน์ได้แต้มและนับยอดเหมือนหน้าร้าน" },
    { href: "/settings/site", title: "เว็บไซต์และร้าน", desc: "โดเมนเว็บ ลิงก์ LINE OA แผนที่ เบอร์ร้าน ที่อยู่" },
    { href: "/settings/users", title: "ผู้ใช้และสิทธิ์", desc: "บัญชีพนักงาน 5 ตำแหน่ง รีเซ็ตรหัสผ่าน ปิดบัญชี" },
    { href: "/settings/audit", title: "บันทึกการใช้งาน", desc: "ใครทำอะไรเมื่อไร — ทุกการแก้แต้ม สมาชิก การจอง และการตั้งค่า" },
  ];
  return (
    <>
      <div className="page-head">
        <h1>ตั้งค่า</h1>
        <p>ทุกค่าที่นี่เปลี่ยนได้โดยไม่ต้องแก้โปรแกรม และทุกการเปลี่ยนแปลงถูกบันทึกไว้</p>
      </div>
      <div className="settings-grid">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="settings-link">
            <b>{l.title}</b>
            <span>{l.desc}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
