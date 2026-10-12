import Link from "next/link";
import "./site.css";
import { HeaderAccount } from "@/components/HeaderAccount";
import { Logo } from "@/components/Logo";
import { SiteMenu } from "@/components/SiteMenu";
import { currentPromotions } from "@/lib/posts";
import { NAV } from "@/lib/nav";
import { hoursLines } from "@/lib/format";
import { getOrg, getStore } from "@/lib/org";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [org, store, promos] = await Promise.all([getOrg(), getStore(), currentPromotions(1).catch(() => [])]);
  const top = promos[0] ?? null;
  const site = org.settings.site;
  const address = site.address ?? store?.address ?? null;
  const hours = store ? hoursLines(store.openHours) : [];

  return (
    <>
      <a href="#main" className="skip-link">
        ข้ามไปเนื้อหา
      </a>
      {top && (
        <Link href={`/promotions/${top.slug}`} className="promo-bar">
          <span className="promo-bar-tag">โปรโมชัน</span>
          <span className="promo-bar-text">{top.title}</span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
      {/* Logo left, page links in the middle (a menu button on phones); booking is the primary action on every width, the account sits next to it. */}
      <header className="site-header">
        <div className="wrap site-header-row">
          <Logo height={22} />
          <SiteMenu shopUrl={site.shopUrl ?? null} />
          <div className="site-account">
            <Link href="/app/booking" className="btn btn-primary btn-sm head-book">
              จองซิม
            </Link>
            <HeaderAccount />
          </div>
        </div>
      </header>

      <main id="main">{children}</main>

      {/* CVI band: the white logo on the green box, and the Let's Golf tagline. */}
      <section className="brand-band" aria-label="MST Golf">
        <div className="wrap brand-band-row">
          {/* eslint-disable-next-line @next/next/no-img-element -- the CVI logo, shown in its white "green box" version */}
          <img src="/mst-logo.png" alt="MST Golf" className="logo-white" width={161} height={30} />
          <div className="brand-band-tag">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lets-golf-white.png" alt="Let's Golf" width={112} height={86} />
            <p lang="en">Let&rsquo;s belong. Let&rsquo;s improve. Let&rsquo;s enjoy every moment.</p>
          </div>
        </div>
      </section>

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
            {site.shopUrl && (
              <span>
                <a href={site.shopUrl} rel="noopener" target="_blank">ร้านออนไลน์</a>
              </span>
            )}
            {org.settings.features.line && site.lineOaUrl && (
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
              <Link href="/register">สมัครสมาชิก</Link>
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
