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

      {/* One footer in the CVI green: the white logo and Let's Golf, the store,
          then every link on one wrapping line. */}
      <footer className="ft">
        <div className="wrap ft-top">
          {/* eslint-disable-next-line @next/next/no-img-element -- the CVI logo, white on the green box */}
          <img src="/mst-logo.png" alt="MST Golf" className="ft-logo" width={161} height={30} />
          <div className="ft-tag">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lets-golf-white.png" alt="Let's Golf" width={92} height={71} />
            <p lang="en">Let&rsquo;s belong. Let&rsquo;s improve. Let&rsquo;s enjoy every moment.</p>
          </div>
        </div>
        <div className="wrap ft-main">
          <div className="ft-store">
            <p className="ft-name">{store?.name ?? org.name}</p>
            {address && <p>{address}</p>}
            {hours.map((h) => (
              <p key={h}>{h}</p>
            ))}
            <p className="ft-inline">
              {site.phone && (
                <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`} className="num">
                  โทร {site.phone}
                </a>
              )}
              {site.mapsUrl && (
                <a href={site.mapsUrl} rel="noopener" target="_blank">
                  Google Maps ↗
                </a>
              )}
              {site.facebookUrl && (
                <a href={site.facebookUrl} rel="noopener" target="_blank">
                  Facebook ↗
                </a>
              )}
              {site.instagramUrl && (
                <a href={site.instagramUrl} rel="noopener" target="_blank">
                  Instagram ↗
                </a>
              )}
              {org.settings.features.line && site.lineOaUrl && (
                <a href={site.lineOaUrl} rel="noopener" target="_blank">
                  LINE OA ↗
                </a>
              )}
            </p>
          </div>
          <nav className="ft-links" aria-label="ลิงก์ท้ายเว็บ">
            {NAV.filter((n) => n.href !== "/").map((n) => (
              <Link key={n.href} href={n.href}>
                {n.label}
              </Link>
            ))}
            <Link href="/register">สมัครสมาชิก</Link>
            <Link href="/app/member">บัตรสมาชิก</Link>
            {site.shopUrl && (
              <a href={site.shopUrl} rel="noopener" target="_blank">
                ร้านออนไลน์ ↗
              </a>
            )}
          </nav>
        </div>
        <div className="wrap ft-fine">
          <p>© {new Date().getFullYear()} {org.name}</p>
          <p className="ft-legal">
            <Link href="/terms">ข้อกำหนดสมาชิก</Link>
            <Link href="/privacy">นโยบายความเป็นส่วนตัว</Link>
          </p>
        </div>
      </footer>
    </>
  );
}
