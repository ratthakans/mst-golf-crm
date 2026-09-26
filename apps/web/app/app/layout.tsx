import { headers } from "next/headers";
import Link from "next/link";
import "./customer.css";
import { AppTabs } from "@/components/customer/AppTabs";
import { LogoutButton } from "@/components/customer/LogoutButton";
import { Logo } from "@/components/Logo";
import { getOrg, loginSetup } from "@/lib/org";
import { currentLineUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Customer pages (LIFF endpoint = https://<domain>/app). Narrow, phone-first
// shell; the LINE app draws its own title bar above it.
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const inLine = /\bLine\//i.test(headers().get("user-agent") ?? "");
  const user = await currentLineUser();
  const liffId = user && !inLine ? (await loginSetup((await getOrg()).id)).liffId : null;

  return (
    <div className="capp">
      <header className="capp-header">
        <div className="capp-row">
          <Logo height={20} />
          <AppTabs />
        </div>
      </header>
      <main id="main" className="capp-main">
        {children}
      </main>
      <footer className="capp-footer">
        {user && !inLine && (
          <div className="capp-account">
            <span className="muted">
              เข้าสู่ระบบด้วย LINE{user.name ? ` · ${user.name}` : ""}
            </span>
            <LogoutButton liffId={liffId} />
          </div>
        )}
        <nav className="capp-links" aria-label="ลิงก์เว็บไซต์">
          <Link href="/">หน้าแรก</Link>
          <Link href="/golf-simulator">ราคาซิม</Link>
          <Link href="/terms">ข้อกำหนด</Link>
          <Link href="/privacy">ความเป็นส่วนตัว</Link>
        </nav>
      </footer>
    </div>
  );
}
