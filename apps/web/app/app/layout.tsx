import { headers } from "next/headers";
import Link from "next/link";
import { unreadCount } from "@mstgolf/core";
import "./customer.css";
import { AppBar, AppTabs } from "@/components/customer/AppTabs";
import { LogoutButton } from "@/components/customer/LogoutButton";
import { Logo } from "@/components/Logo";
import { currentMember, customerLabel } from "@/lib/member";
import { getOrg, loginSetup } from "@/lib/org";

export const dynamic = "force-dynamic";

// Customer pages (/app/*): narrow, phone-first. Opened from the website (and,
// when the tenant has LINE on, from LIFF — the LINE app draws its own title bar).
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const inLine = /\bLine\//i.test(headers().get("user-agent") ?? "");
  const org = await getOrg();
  const { customer, member } = await currentMember();
  const liffId = customer?.kind === "line" && !inLine ? (await loginSetup(org.id)).liffId : null;
  const unread = member ? await unreadCount(org.id, member.id) : 0;
  const label = customerLabel(customer, member);

  return (
    <div className="capp">
      <header className="capp-header">
        <div className="capp-row">
          <Logo height={20} />
          <AppTabs unread={unread} signedIn={!!member} />
        </div>
      </header>
      <main id="main" className="capp-main">
        {children}
      </main>
      <footer className="capp-footer">
        {customer && !inLine && (
          <div className="capp-account">
            <span className="muted">
              {customer.kind === "line" ? "เข้าสู่ระบบด้วย LINE" : "เข้าสู่ระบบแล้ว"}
              {label ? ` · ${label}` : ""}
            </span>
            <LogoutButton liffId={liffId} />
          </div>
        )}
        <nav className="capp-links" aria-label="ลิงก์เว็บไซต์">
          <Link href="/">หน้าแรก</Link>
          <Link href="/rewards">สิทธิ์สมาชิก</Link>
          <Link href="/golf-simulator">ราคาซิม</Link>
          <Link href="/contact">ติดต่อเรา</Link>
          <Link href="/terms">ข้อกำหนด</Link>
          <Link href="/privacy">ความเป็นส่วนตัว</Link>
        </nav>
      </footer>
      <AppBar unread={unread} signedIn={!!member} />
    </div>
  );
}
