import type { Metadata } from "next";
import Link from "next/link";
import { availability, formatThaiDate, localDateKey } from "@mstgolf/core";
import { Photo } from "@/components/Photo";
import { PostList } from "@/components/PostList";
import { SimScorecard } from "@/components/SimScorecard";
import { TierTable } from "@/components/TierTable";
import { YardageMap } from "@/components/YardageMap";
import { sitePhotos } from "@/lib/images";
import { homeCopy, siteServices } from "@/lib/content";
import { formatBaht, formatPoints, hoursLines, openingSpec } from "@/lib/format";
import { getLanes, getOrg, getStore, siteOrigin } from "@/lib/org";
import { publishedPosts } from "@/lib/posts";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "MST Golf — ร้านกอล์ฟ ฟิตติ้ง อคาเดมี และ Golf Simulator ชาญอิสสระ ทาวเวอร์ 1" },
  description:
    "Pro shop · Club fitting · Academy · Golf Simulator 3 lane ที่ชาญอิสสระ ทาวเวอร์ 1 ถนนพระราม 4 จองซิมกอล์ฟออนไลน์ สมัครสมาชิกผ่าน LINE สะสมแต้มทุกการซื้อ",
  alternates: { canonical: "/" },
  openGraph: { title: "MST Golf", description: "ร้านกอล์ฟที่ให้คุณลองก่อนเลือก — Pro shop · Club fitting · Academy · Golf Simulator", url: "/" },
};

export default async function HomePage() {
  const [org, store, lanes, posts, origin] = await Promise.all([getOrg(), getStore(), getLanes(), publishedPosts(3), siteOrigin()]);
  const s = org.settings;
  const photos = sitePhotos(s.site);
  const services = siteServices(s.site.copy);
  const copy = homeCopy(s.site.copy, lanes.length || 3);
  const address = s.site.address ?? store?.address ?? null;
  const hours = store ? hoursLines(store.openHours) : [];
  const prices = Array.from(new Set(lanes.map((l) => l.hourlyPriceSatang))).sort((x, y) => x - y);
  const maxCap = lanes.reduce((m, l) => Math.max(m, l.capacity), 0);
  const maxDaysAhead = Math.max(...s.tiers.map((t) => t.benefits.simBookingDaysAhead));
  const minDaysAhead = Math.min(...s.tiers.map((t) => t.benefits.simBookingDaysAhead));
  const now = new Date();
  const today = s.features.booking && lanes.length ? await availability(org.id, localDateKey(now), now).catch(() => null) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: org.name,
    url: origin,
    image: `${origin}/mst-logo.png`,
    ...(s.site.phone ? { telephone: s.site.phone } : {}),
    ...(address
      ? { address: { "@type": "PostalAddress", streetAddress: address, addressLocality: "กรุงเทพมหานคร", addressCountry: "TH" } }
      : {}),
    ...(store ? { openingHoursSpecification: openingSpec(store.openHours).map((o) => ({ "@type": "OpeningHoursSpecification", ...o })) } : {}),
    ...(s.site.mapsUrl ? { hasMap: s.site.mapsUrl } : {}),
    ...(s.site.lineOaUrl ? { sameAs: [s.site.lineOaUrl] } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <section className="hole" aria-labelledby="hero-h">
        <div className="wrap hole-grid">
          <div className="hole-copy">
            <p className="hole-place">{store?.name ?? org.name}</p>
            <h1 id="hero-h" className="hole-title">
              {copy.heroTitle}
              {copy.heroHighlight && (
                <>
                  {" "}
                  <span className="hole-title-strong">{copy.heroHighlight}</span>
                </>
              )}
            </h1>
            <p className="hole-lede">{copy.heroLede}</p>
            <div className="cta-row">
              <Link href="/app/booking" className="btn btn-primary">
                จองซิม
              </Link>
              <Link href="/app/member" className="btn btn-outline">
                สมัครสมาชิก
              </Link>
            </div>
          </div>
          <YardageMap services={services} title={copy.servicesTitle} lede={copy.servicesLede} />
        </div>
      </section>

      <section className="card-section" aria-labelledby="today-h">
        <div className="wrap card-grid">
          <div className="card-copy">
            <h2 id="today-h">Golf Simulator วันนี้</h2>
            <p>{services.find((x) => x.slug === "golf-simulator")?.short}</p>
            <dl className="card-facts">
              {prices.length > 0 && (
                <div>
                  <dt>ราคา</dt>
                  <dd className="mono">{prices.map((p) => formatBaht(p)).join(" / ")} /ชม.</dd>
                </div>
              )}
              {maxCap > 0 && (
                <div>
                  <dt>ต่อ lane</dt>
                  <dd>
                    สูงสุด {maxCap} คน ราคาเดียว
                  </dd>
                </div>
              )}
              <div>
                <dt>จองล่วงหน้า</dt>
                <dd>
                  {minDaysAhead === maxDaysAhead ? minDaysAhead : `${minDaysAhead}–${maxDaysAhead}`} วัน ตามระดับสมาชิก
                </dd>
              </div>
              <div>
                <dt>ชำระเงิน</dt>
                <dd>ที่ร้านตอนเช็กอิน</dd>
              </div>
            </dl>
            <Link href="/golf-simulator" className="text-link">
              ราคาหลังส่วนลดและกติกาการจอง
            </Link>
          </div>
          {today ? <SimScorecard avail={today} dateLabel={formatThaiDate(now, { weekday: true, year: false })} /> : <Photo photo={photos.simBays} ratio="16 / 10" />}
        </div>
      </section>

      <section className="ledger-section" aria-labelledby="tiers-h">
        <div className="wrap ledger-grid">
          <div className="ledger-copy">
            <h2 id="tiers-h">สมาชิก MST Golf</h2>
            <p>
              สมัครฟรีด้วย LINE รับ <b className="num">{formatPoints(s.welcomeBonus)}</b> แต้มต้อนรับ แล้วใช้บัตรในมือถือที่เคาน์เตอร์ได้ทันที
            </p>
            <Link href="/app/member" className="btn btn-primary">
              สมัครสมาชิก
            </Link>
          </div>
          <TierTable tiers={s.tiers} pointsPerBaht={s.pointsPerBaht} />
        </div>
      </section>

      <section className="notes-section" aria-labelledby="posts-h">
        <div className="wrap">
          <div className="notes-head">
            <h2 id="posts-h">บทความ</h2>
            <Link href="/blog" className="text-link">
              ทั้งหมด
            </Link>
          </div>
          {posts.length ? <PostList posts={posts} /> : <p className="empty">บทความชุดแรกกำลังจะมา — ติดตามเทคนิคการซ้อมและข่าวจากร้านได้ที่นี่</p>}
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
              {s.site.lineOaUrl && (
                <a href={s.site.lineOaUrl} className="btn btn-line" target="_blank" rel="noopener">
                  เพิ่มเพื่อน LINE OA
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
