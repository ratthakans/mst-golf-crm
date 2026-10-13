import Link from "next/link";
import "./site.css";
import { HeaderAccount } from "@/components/HeaderAccount";
import { Logo } from "@/components/Logo";
import { SiteMenu } from "@/components/SiteMenu";
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
      {/* Logo left, page links in the middle (a menu button on phones); booking is the primary action on every width, the account sits next to it. */}
      <header className="site-header">
        <div className="wrap site-header-row">
          <Logo height={26} />
          <SiteMenu
            shopUrl={site.shopUrl ?? null}
            store={{ name: store?.name ?? org.name, address, hours, phone: site.phone ?? null, mapsUrl: site.mapsUrl ?? null }}
          />
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

      {/* Colophon: the store's details on the left, the links in three short groups. */}
      <footer className="site-footer colophon">
        <div className="wrap colophon-grid">
          <div className="colophon-store">
            <p className="colophon-name">{store?.name ?? org.name}</p>
            {address && <p>{address}</p>}
            {hours.map((h) => (
              <p key={h}>{h}</p>
            ))}
            {site.phone && (
              <p>
                โทร <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`} className="num">{site.phone}</a>
              </p>
            )}
            {site.mapsUrl && (
              <p>
                <a href={site.mapsUrl} rel="noopener" target="_blank">เปิดแผนที่ Google Maps ↗</a>
              </p>
            )}
            {org.settings.features.line && site.lineOaUrl && (
              <p>
                <a href={site.lineOaUrl} rel="noopener" target="_blank">เพิ่มเพื่อน LINE OA</a>
              </p>
            )}
          </div>
          <nav className="colophon-nav" aria-label="ลิงก์ท้ายเว็บ">
            <div>
              <p className="colophon-h" lang="en">Store</p>
              {NAV.map((n) => (
                <Link key={n.href} href={n.href}>{n.label}</Link>
              ))}
              {site.shopUrl && (
                <a href={site.shopUrl} rel="noopener" target="_blank">ร้านออนไลน์ ↗</a>
              )}
            </div>
            <div>
              <p className="colophon-h" lang="en">Members</p>
              <Link href="/register">สมัครสมาชิก</Link>
              <Link href="/app/member">บัตรสมาชิก</Link>
              <Link href="/app/booking">จองซิมกอล์ฟ</Link>
              <Link href="/app/rewards">แลกรางวัล</Link>
            </div>
            <div>
              <p className="colophon-h" lang="en">Legal</p>
              <Link href="/terms">ข้อกำหนดสมาชิก</Link>
              <Link href="/privacy">นโยบายความเป็นส่วนตัว</Link>
            </div>
          </nav>
          <p className="colophon-fine">
            © {new Date().getFullYear()} {org.name} · ราคาและเวลาเปิดบนหน้านี้มาจากระบบของร้านโดยตรง
          </p>
        </div>
      </footer>
    </>
  );
}
