import Link from "next/link";
import "./site.css";
import { HeaderAccount } from "@/components/HeaderAccount";
import { Logo } from "@/components/Logo";
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
      {/* N9 edge-aligned: wordmark hard left, the one action hard right. The map on
          the home page and the colophon below carry the rest of the navigation. */}
      <header className="site-header">
        <div className="wrap site-header-row">
          <Logo height={22} />
          <div className="site-account">
            <Link href="/app/booking" className="btn btn-outline btn-sm head-book">
              จองซิม
            </Link>
            <HeaderAccount />
          </div>
        </div>
      </header>

      <main id="main">{children}</main>

      {/* Ft4 dense colophon: everything a visitor needs to find the store, set small. */}
      <footer className="site-footer colophon">
        <div className="wrap">
          <p className="colophon-name">{store?.name ?? org.name}</p>
          <p className="colophon-body">
            {address && <span>{address}</span>}
            {hours.map((h) => (
              <span key={h}>{h}</span>
            ))}
            {site.phone && (
              <span>
                โทร <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`} className="num">{site.phone}</a>
              </span>
            )}
            {site.mapsUrl && (
              <span>
                <a href={site.mapsUrl} rel="noopener" target="_blank">แผนที่ Google Maps</a>
              </span>
            )}
            {site.lineOaUrl && (
              <span>
                <a href={site.lineOaUrl} rel="noopener" target="_blank">เพิ่มเพื่อน LINE OA</a>
              </span>
            )}
          </p>
          <nav aria-label="ลิงก์ท้ายเว็บ">
            <p className="colophon-links">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href}>{n.label}</Link>
              ))}
              <Link href="/app/member">บัตรสมาชิก</Link>
              <Link href="/app/booking">จองซิมกอล์ฟ</Link>
              <Link href="/terms">ข้อกำหนดสมาชิก</Link>
              <Link href="/privacy">นโยบายความเป็นส่วนตัว</Link>
            </p>
          </nav>
          <p className="colophon-fine">
            © {new Date().getFullYear()} {org.name} · ราคาและเวลาเปิดบนหน้านี้มาจากระบบของร้านโดยตรง
          </p>
        </div>
      </footer>
    </>
  );
}
