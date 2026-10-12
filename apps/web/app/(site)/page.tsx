import type { Metadata } from "next";
import Link from "next/link";
import { availability, localDateKey } from "@mstgolf/core";
import { PostList } from "@/components/PostList";
import { SimScorecard } from "@/components/SimScorecard";
import { TierTable } from "@/components/TierTable";
import { Photo } from "@/components/Photo";
import { sitePhotos } from "@/lib/images";
import { homeCopy, siteServices } from "@/lib/content";
import { formatBaht, formatPoints, formatThaiDate, hoursLines, openingSpec } from "@/lib/format";
import { getLanes, getOrg, getStore, siteOrigin } from "@/lib/org";
import { currentPromotions, publishedPosts, type PromoItem } from "@/lib/posts";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "MST Golf — ร้านกอล์ฟ โปรโมชัน ฟิตติ้ง อคาเดมี และ Golf Simulator ชาญอิสสระ ทาวเวอร์ 1" },
  description:
    "ร้านอุปกรณ์กอล์ฟ MST Golf ชาญอิสสระ ทาวเวอร์ 1 ถนนพระราม 4 — โปรโมชันไม้กอล์ฟ รองเท้า เสื้อผ้า และอุปกรณ์ · Club fitting · Academy · Golf Simulator · สมัครสมาชิกสะสมแต้มทุกการซื้อ",
  alternates: { canonical: "/" },
  openGraph: { title: "MST Golf", description: "โปรโมชันล่าสุด ไม้กอล์ฟ อุปกรณ์ ฟิตติ้ง อคาเดมี และ Golf Simulator", url: "/" },
};

const daysLeft = (iso: string | null, now: Date): number | null => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000)) : null);

function promoHref(p: PromoItem): { href: string; external: boolean } {
  if (p.linkUrl) return { href: p.linkUrl, external: /^https:\/\//.test(p.linkUrl) };
  return { href: `/promotions/${p.slug}`, external: false };
}

/** "ถึง 31 ต.ค." — or the countdown when it is close, the way a shelf tag says it. */
function untilText(p: PromoItem, now: Date): string {
  const left = daysLeft(p.endsAt, now);
  if (left === null) return "ไม่มีกำหนดสิ้นสุด";
  if (left === 0) return "วันสุดท้าย";
  if (left <= 7) return `เหลืออีก ${left} วัน`;
  return `ถึง ${formatThaiDate(new Date(p.endsAt!))}`;
}

const MONTH = new Intl.DateTimeFormat("th-TH", { month: "long", timeZone: "Asia/Bangkok" });

// The home page of a golf shop, set like the sale sheet at the counter: this
// month's promotions first (the lead one large, the rest as a ruled list), then
// the brands on the shelves, today's free simulator lanes from the live booking
// grid, what else the store does, the membership tiers and how to get there.
// Every number on it comes from the back office or live data.
export default async function HomePage() {
  const [org, store, lanes, posts, origin, promos] = await Promise.all([getOrg(), getStore(), getLanes(), publishedPosts(3), siteOrigin(), currentPromotions(9)]);
  const s = org.settings;
  const photos = sitePhotos(s.site);
  const services = siteServices(s.site.copy);
  const copy = homeCopy(s.site.copy, lanes.length || 3);
  const address = s.site.address ?? store?.address ?? null;
  const hours = store ? hoursLines(store.openHours) : [];
  const prices = Array.from(new Set(lanes.map((l) => l.hourlyPriceSatang))).sort((x, y) => x - y);
  const now = new Date();
  // Today's lanes; once the store has closed (or every hour has passed) the
  // section shows tomorrow instead, so it never sits empty in the evening.
  const dayAvail = async (at: Date) => availability(org.id, localDateKey(at), now).catch(() => null);
  const hasHoursLeft = (a: Awaited<ReturnType<typeof dayAvail>>) => !!a?.open && a.slots.some((sl) => sl.lanes.some((l) => l.state !== "past"));
  const tomorrowAt = new Date(now.getTime() + 86_400_000);
  let lanesDay: { avail: NonNullable<Awaited<ReturnType<typeof dayAvail>>>; at: Date; word: string } | null = null;
  if (s.features.booking && lanes.length) {
    const t = await dayAvail(now);
    if (t && hasHoursLeft(t)) lanesDay = { avail: t, at: now, word: "วันนี้" };
    else {
      const n = await dayAvail(tomorrowAt);
      if (n && hasHoursLeft(n)) lanesDay = { avail: n, at: tomorrowAt, word: "พรุ่งนี้" };
    }
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportingGoodsStore",
    name: org.name,
    url: origin,
    image: `${origin}/mst-logo.png`,
    ...(s.site.phone ? { telephone: s.site.phone } : {}),
    ...(address ? { address: { "@type": "PostalAddress", streetAddress: address, addressLocality: "กรุงเทพมหานคร", addressCountry: "TH" } } : {}),
    ...(store ? { openingHoursSpecification: openingSpec(store.openHours).map((o) => ({ "@type": "OpeningHoursSpecification", ...o })) } : {}),
    ...(s.site.mapsUrl ? { hasMap: s.site.mapsUrl } : {}),
    ...(s.site.shopUrl ? { sameAs: [s.site.shopUrl] } : {}),
  };

  const [lead, ...rest] = promos;
  const leadCta = lead ? promoHref(lead) : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <h1 className="visually-hidden">{org.name} — ร้านกอล์ฟ ชาญอิสสระ ทาวเวอร์ 1</h1>

      <section className="h-window" aria-labelledby="window-h">
        <div className="wrap">
          <p className="h-window-meta">
            <span>{store?.name ?? org.name}</span>
            <span>
              โปรโมชันเดือน{MONTH.format(now)} · <span className="mono">{promos.length}</span> รายการ
            </span>
          </p>

          {lead ? (
            <div className={`h-window-lead${lead.coverUrl ? "" : " no-img"}`}>
              <div className="h-window-copy">
                <p className={`h-window-until${(daysLeft(lead.endsAt, now) ?? 99) <= 3 ? " soon" : ""}`}>{untilText(lead, now)}</p>
                <h2 id="window-h" className="h-window-title">
                  {lead.title}
                </h2>
                {lead.excerpt && <p className="h-window-text">{lead.excerpt}</p>}
                <div className="h-window-cta">
                  {leadCta!.external ? (
                    <a href={leadCta!.href} className="btn btn-primary" target="_blank" rel="noopener">
                      {lead.linkLabel || "ดูโปรโมชัน"}
                    </a>
                  ) : (
                    <Link href={leadCta!.href} className="btn btn-primary">
                      {lead.linkLabel || "ดูรายละเอียด"}
                    </Link>
                  )}
                  {lead.linkUrl && lead.hasBody && (
                    <Link href={`/promotions/${lead.slug}`} className="text-link">
                      เงื่อนไข
                    </Link>
                  )}
                </div>
              </div>
              {lead.coverUrl && (
                <Link href={`/promotions/${lead.slug}`} className="h-window-img" tabIndex={-1} aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element -- promotion covers come from MST's uploads */}
                  <img src={lead.coverUrl} alt="" />
                </Link>
              )}
            </div>
          ) : (
            <div className="h-window-lead no-img">
              <div className="h-window-copy">
                <h2 id="window-h" className="h-window-title">
                  {copy.heroHighlight ? `${copy.heroTitle} ${copy.heroHighlight}` : copy.heroTitle}
                </h2>
                <p className="h-window-text">{copy.heroLede}</p>
              </div>
            </div>
          )}

          {rest.length > 0 && (
            <ol className="h-sheet" aria-label="โปรโมชันอื่นที่กำลังมี">
              {rest.slice(0, 6).map((p) => (
                <li key={p.slug}>
                  <Link href={`/promotions/${p.slug}`} className="h-sheet-row">
                    <span className="h-sheet-thumb" aria-hidden="true">
                      {/* eslint-disable-next-line @next/next/no-img-element -- promotion covers come from MST's uploads */}
                      {p.coverUrl ? <img src={p.coverUrl} alt="" loading="lazy" /> : null}
                    </span>
                    <span className="h-sheet-main">
                      <span className="h-sheet-title">{p.title}</span>
                      {p.excerpt && <span className="h-sheet-text">{p.excerpt}</span>}
                    </span>
                    <span className={`h-sheet-until${(daysLeft(p.endsAt, now) ?? 99) <= 3 ? " soon" : ""}`}>{untilText(p, now)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
          {promos.length > 0 && (
            <p className="h-sheet-all">
              <Link href="/promotions" className="text-link">
                ทุกโปรโมชันและเงื่อนไข
              </Link>
            </p>
          )}
        </div>
      </section>

      {copy.brands.length > 0 && (
        <section className="h-shelf" aria-labelledby="shelf-h">
          <div className="wrap h-shelf-row">
            <h2 id="shelf-h" className="h-shelf-h">
              แบรนด์ในร้าน
            </h2>
            <ul className="h-shelf-list">
              {copy.brands.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {lanesDay && (
        <section className="h-lanes" aria-labelledby="lanes-h">
          <div className="wrap h-lanes-grid">
            <div className="h-lanes-copy">
              <h2 id="lanes-h">ซิมกอล์ฟว่าง{lanesDay.word}</h2>
              <p>
                {lanes.length} lane{prices.length ? ` · ${prices.map((p) => formatBaht(p)).join(" / ")} ต่อชั่วโมง` : ""} · สมาชิกได้ส่วนลดตามระดับ
              </p>
              <p className="muted">ช่องว่างจองได้ทันที ไม่ต้องรอร้านยืนยัน · ชำระที่ร้าน</p>
              <div className="h-lanes-cta">
                <Link href="/app/booking" className="btn btn-primary">
                  จองซิม
                </Link>
                <Link href="/golf-simulator" className="text-link">
                  ราคาและกติกา
                </Link>
              </div>
            </div>
            <SimScorecard avail={lanesDay.avail} dateLabel={`${lanesDay.word} · ${formatThaiDate(lanesDay.at, { weekday: true, year: false })}`} />
          </div>
        </section>
      )}

      <section className="h-instore" aria-labelledby="instore-h">
        <div className="wrap">
          <h2 id="instore-h">{copy.servicesTitle}</h2>
          <p className="h-instore-lede">{copy.servicesLede}</p>
          <ul className="h-instore-list">
            {services.map((svc) => {
              const sim = svc.slug === "golf-simulator";
              return (
                <li key={svc.slug}>
                  <Link href={sim ? "/golf-simulator" : `/services#${svc.slug}`} className="h-instore-row">
                    <span className="h-instore-name">{svc.name}</span>
                    <span className="h-instore-thai">{svc.thai}</span>
                    <span className="h-instore-short">{svc.short}</span>
                    <span className="h-instore-go" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="h-club" aria-labelledby="club-h">
        <div className="wrap h-club-grid">
          <div className="h-club-copy">
            <h2 id="club-h">
              สมัครสมาชิกฟรี
              <br />
              รับ <span className="mono">{formatPoints(s.welcomeBonus)}</span> แต้มทันที
            </h2>
            <p>สมัครด้วยเบอร์มือถือ บัตรสมาชิกอยู่ในมือถือ ใช้สะสมแต้ม รับส่วนลด แลกคูปอง และจองซิม</p>
            <Link href="/register" className="btn btn-primary">
              สมัครสมาชิก
            </Link>
          </div>
          <TierTable tiers={s.tiers} pointsPerBaht={s.pointsPerBaht} />
        </div>
      </section>

      <section className="h-notes" aria-labelledby="notes-h">
        <div className="wrap">
          <div className="h-notes-head">
            <h2 id="notes-h">บทความและข่าวจากร้าน</h2>
            <Link href="/blog" className="text-link">
              บทความทั้งหมด
            </Link>
          </div>
          {posts.length ? <PostList posts={posts} /> : <p className="empty">บทความชุดแรกกำลังจะมา — เทคนิคการซ้อมและข่าวจากร้าน</p>}
        </div>
      </section>

      <section className="h-visit" aria-labelledby="visit-h">
        <div className="wrap h-visit-grid">
          <div className="h-visit-copy">
            <h2 id="visit-h">{store?.name ?? org.name}</h2>
            {address && <p className="h-visit-addr">{address}</p>}
            {hours.length > 0 && (
              <ul className="h-visit-hours">
                {hours.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
            {s.site.phone && (
              <p>
                โทร{" "}
                <a href={`tel:${s.site.phone.replace(/[^\d+]/g, "")}`} className="mono">
                  {s.site.phone}
                </a>
              </p>
            )}
            <div className="cta-row">
              {s.site.mapsUrl && (
                <a href={s.site.mapsUrl} className="btn btn-outline" target="_blank" rel="noopener">
                  เปิดใน Google Maps
                </a>
              )}
              <Link href="/contact" className="btn btn-outline">
                ติดต่อเรา
              </Link>
            </div>
          </div>
          <Photo photo={photos.store} ratio="3 / 2" className="h-visit-photo" sizes="(min-width: 900px) 50vw, 100vw" />
        </div>
      </section>
    </>
  );
}
