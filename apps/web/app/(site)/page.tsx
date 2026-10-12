import type { Metadata } from "next";
import Link from "next/link";
import { availability, localDateKey } from "@mstgolf/core";
import { earnRateText } from "@mstgolf/shared/tiers";
import { PostList } from "@/components/PostList";
import { PromoCarousel, type HeroSlide } from "@/components/PromoCarousel";
import { Photo } from "@/components/Photo";
import { servicePhotos, sitePhotos } from "@/lib/images";
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

// The home page of a golf shop: what's on offer now first, then the brands,
// the services (simulator booking is one of them), membership, articles, and
// how to find the store. Every promotion comes from the back office.
export default async function HomePage() {
  const [org, store, lanes, posts, origin, promos] = await Promise.all([getOrg(), getStore(), getLanes(), publishedPosts(3), siteOrigin(), currentPromotions(9)]);
  const s = org.settings;
  const photos = sitePhotos(s.site);
  const svcPhotos = servicePhotos(photos);
  const services = siteServices(s.site.copy);
  const copy = homeCopy(s.site.copy, lanes.length || 3);
  const address = s.site.address ?? store?.address ?? null;
  const hours = store ? hoursLines(store.openHours) : [];
  const prices = Array.from(new Set(lanes.map((l) => l.hourlyPriceSatang))).sort((x, y) => x - y);
  const now = new Date();
  const today = s.features.booking && lanes.length ? await availability(org.id, localDateKey(now), now).catch(() => null) : null;
  const freeToday = today?.open ? today.slots.reduce((n, sl) => n + sl.lanes.filter((l) => l.state === "free").length, 0) : null;

  // Hero: every running promotion that has a picture, then the store itself.
  const slides: HeroSlide[] = [
    ...promos
      .filter((p) => p.coverUrl)
      .slice(0, 5)
      .map((p) => {
        const left = daysLeft(p.endsAt, now);
        const cta = promoHref(p);
        return {
          key: p.slug,
          image: p.coverUrl!,
          eyebrow: left === null ? "โปรโมชัน" : left <= 7 ? `โปรโมชัน · เหลืออีก ${left} วัน` : `โปรโมชัน · ถึง ${formatThaiDate(new Date(p.endsAt!))}`,
          title: p.title,
          text: p.excerpt,
          cta: { label: p.linkLabel || "ดูโปรโมชัน", ...cta },
          more: p.linkUrl && p.hasBody ? { label: "เงื่อนไข", href: `/promotions/${p.slug}` } : null,
        };
      }),
    {
      key: "store",
      image: photos.hero.src,
      eyebrow: store?.name ?? org.name,
      title: copy.heroHighlight ? `${copy.heroTitle} ${copy.heroHighlight}` : copy.heroTitle,
      text: copy.heroLede,
      cta: { label: "ดูโปรโมชันทั้งหมด", href: "/promotions", external: false },
      more: { label: "บริการในร้าน", href: "/services" },
    },
  ];

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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <h1 className="visually-hidden">{org.name} — ร้านกอล์ฟ ชาญอิสสระ ทาวเวอร์ 1</h1>

      <PromoCarousel slides={slides} />

      {promos.length > 0 && (
        <section className="home-section" aria-labelledby="deals-h">
          <div className="wrap">
            <div className="section-head">
              <h2 id="deals-h">โปรโมชันตอนนี้</h2>
              <Link href="/promotions" className="text-link">
                ดูทั้งหมด
              </Link>
            </div>
            <div className={`deal-grid deal-n${Math.min(rest.length, 4)}`}>
              {[lead!, ...rest.slice(0, 4)].map((p, i) => {
                const left = daysLeft(p.endsAt, now);
                return (
                  <Link key={p.slug} href={`/promotions/${p.slug}`} className={`deal${i === 0 ? " deal-lead" : ""}`}>
                    <span className="deal-img">
                      {p.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- promotion covers come from MST's uploads
                        <img src={p.coverUrl} alt="" loading="lazy" />
                      ) : (
                        <span className="deal-blank" aria-hidden="true" />
                      )}
                    </span>
                    <span className="deal-body">
                      {left !== null && <span className={`deal-badge${left <= 3 ? " soon" : ""}`}>{left === 0 ? "วันสุดท้าย" : `เหลือ ${left} วัน`}</span>}
                      <span className="deal-title">{p.title}</span>
                      {p.excerpt && <span className="deal-text">{p.excerpt}</span>}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {copy.brands.length > 0 && (
        <section className="brand-strip" aria-label="แบรนด์ในร้าน">
          <div className="brand-marquee">
            {[0, 1].map((k) => (
              <ul key={k} className="brand-row" aria-hidden={k === 1}>
                {copy.brands.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ))}
          </div>
        </section>
      )}

      <section className="home-section" aria-labelledby="svc-h">
        <div className="wrap">
          <div className="section-head">
            <h2 id="svc-h">{copy.servicesTitle}</h2>
            <Link href="/services" className="text-link">
              บริการทั้งหมด
            </Link>
          </div>
          <p className="section-lede">{copy.servicesLede}</p>
          <ul className="svc-grid">
            {services.map((svc) => {
              const sim = svc.slug === "golf-simulator";
              return (
                <li key={svc.slug} className={`svc-card${sim ? " svc-sim" : ""}`}>
                  <Link href={sim ? "/golf-simulator" : `/services#${svc.slug}`} className="svc-link">
                    <Photo photo={svcPhotos[svc.slug] ?? photos.proShop} ratio="4 / 5" sizes="(min-width: 900px) 25vw, 50vw" />
                    <span className="svc-text">
                      <span className="svc-name">{svc.name}</span>
                      <span className="svc-thai">{svc.thai}</span>
                    </span>
                  </Link>
                  {sim && (
                    <p className="svc-sim-row">
                      <span>
                        {prices.length ? `${prices.map((p) => formatBaht(p)).join(" / ")} /ชม.` : ""}
                        {freeToday !== null ? ` · วันนี้ว่าง ${freeToday} ช่อง` : ""}
                      </span>
                      <Link href="/app/booking" className="btn btn-primary btn-sm">
                        จองซิม
                      </Link>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="member-band" aria-labelledby="member-h">
        <div className="wrap member-band-grid">
          <div>
            <p className="member-band-eyebrow">สมาชิก MST Golf</p>
            <h2 id="member-h">สมัครฟรี รับ {formatPoints(s.welcomeBonus)} แต้มทันที</h2>
            <p>
              สะสมแต้มทุกการซื้อ ({earnRateText(s.pointsPerBaht)}) · ส่วนลดตามระดับ {s.tiers.map((t) => t.name).join(" / ")} · แลกคูปองและของรางวัล · จองซิมออนไลน์
            </p>
          </div>
          <div className="member-band-cta">
            <Link href="/register" className="btn btn-light">
              สมัครสมาชิก
            </Link>
            <Link href="/rewards" className="btn btn-ghost-light">
              สิทธิ์และรางวัล
            </Link>
          </div>
        </div>
      </section>

      <section className="home-section" aria-labelledby="posts-h">
        <div className="wrap">
          <div className="section-head">
            <h2 id="posts-h">บทความและข่าว</h2>
            <Link href="/blog" className="text-link">
              ทั้งหมด
            </Link>
          </div>
          {posts.length ? <PostList posts={posts} /> : <p className="empty">บทความชุดแรกกำลังจะมา — เทคนิคการซ้อมและข่าวจากร้าน</p>}
        </div>
      </section>

      <section className="visit-section" aria-labelledby="visit-h">
        <div className="wrap visit-grid">
          <Photo photo={photos.store} ratio="4 / 3" className="visit-photo" sizes="(min-width: 900px) 40vw, 100vw" />
          <div className="visit-copy">
            <h2 id="visit-h">แวะมาที่ร้าน</h2>
            <p className="visit-store">{store?.name ?? org.name}</p>
            {address && <p>{address}</p>}
            {hours.map((h) => (
              <p key={h} className="visit-hours">
                {h}
              </p>
            ))}
            {s.site.phone && (
              <p>
                โทร{" "}
                <a href={`tel:${s.site.phone.replace(/[^\d+]/g, "")}`} className="num">
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
        </div>
      </section>
    </>
  );
}
