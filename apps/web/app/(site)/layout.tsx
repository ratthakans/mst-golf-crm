import Link from "next/link";
import "./site.css";
import { HeaderAccount } from "@/components/HeaderAccount";
import { IconClock, IconPhone, IconPin } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { NAV } from "@/lib/nav";
import { hoursLines } from "@/lib/format";
import { getOrg, getStore } from "@/lib/org";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [org, store] = await Promise.all([getOrg(), getStore()]);
  const site = org.settings.site;
  const address = site.address ?? store?.address ?? null;
  const hours = store ? hoursLines(store.openHours) : [];

  return (
    <>
      <a href="#main" className="skip-link">
        ข้ามไปเนื้อหา
      </a>
      <header className="site-header">
        <div className="wrap site-header-row">
          <Logo height={22} />
          <nav className="site-nav" aria-label="เมนูหลัก">
            <NavLinks />
          </nav>
          <div className="site-account">
            <HeaderAccount />
          </div>
        </div>
      </header>

      <main id="main">{children}</main>

      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div className="footer-store">
            <p className="footer-name">{store?.name ?? org.name}</p>
            <ul className="footer-facts">
              {address && (
                <li>
                  <IconPin size={18} />
                  <span>{address}</span>
                </li>
              )}
              {hours.map((h) => (
                <li key={h}>
                  <IconClock size={18} />
                  <span>{h}</span>
                </li>
              ))}
              {site.phone && (
                <li>
                  <IconPhone size={18} />
                  <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`}>{site.phone}</a>
                </li>
              )}
            </ul>
            <div className="footer-actions">
              {site.lineOaUrl && (
                <a href={site.lineOaUrl} className="btn btn-on-dark btn-sm" rel="noopener" target="_blank">
                  เพิ่มเพื่อน LINE OA
                </a>
              )}
              {site.mapsUrl && (
                <a href={site.mapsUrl} className="btn btn-quiet-dark btn-sm" rel="noopener" target="_blank">
                  เปิดใน Google Maps
                </a>
              )}
            </div>
          </div>
          <nav className="footer-links" aria-label="ลิงก์ท้ายเว็บ">
            <ul>
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href}>{n.label}</Link>
                </li>
              ))}
            </ul>
            <ul>
              <li>
                <Link href="/app/member">บัตรสมาชิก</Link>
              </li>
              <li>
                <Link href="/app/booking">จองซิมกอล์ฟ</Link>
              </li>
              <li>
                <Link href="/terms">ข้อกำหนดสมาชิก</Link>
              </li>
              <li>
                <Link href="/privacy">นโยบายความเป็นส่วนตัว</Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="wrap footer-base">
          <span>© {new Date().getFullYear()} {org.name}</span>
        </div>
      </footer>
    </>
  );
}
