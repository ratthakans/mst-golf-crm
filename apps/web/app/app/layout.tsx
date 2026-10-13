import { headers } from "next/headers";
import Link from "next/link";
import { unreadCount } from "@mstgolf/core";
import "./customer.css";
import { AppBar, AppTabs } from "@/components/customer/AppTabs";
import { LogoutButton } from "@/components/customer/LogoutButton";
import { Logo } from "@/components/Logo";
import { currentMember } from "@/lib/member";
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
      {/* one quiet line: back to the website, contact, privacy, and log out */}
      <footer className="capp-footer">
        <nav className="capp-links" aria-label="ลิงก์เว็บไซต์">
          <Link href="/">หน้าเว็บ MST Golf</Link>
          <Link href="/contact">ติดต่อเรา</Link>
          <Link href="/privacy">ความเป็นส่วนตัว</Link>
          {customer && !inLine && <LogoutButton liffId={liffId} />}
        </nav>
      </footer>
      <AppBar unread={unread} signedIn={!!member} />
    </div>
  );
}
