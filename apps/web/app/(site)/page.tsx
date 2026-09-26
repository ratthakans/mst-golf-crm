import type { Metadata } from "next";
import Link from "next/link";
import { Photo } from "@/components/Photo";
import { PHOTOS, SERVICE_PHOTO } from "@/lib/images";
import { IconArrow, IconClock, IconPhone, IconPin } from "@/components/icons";
import { MyStatus } from "@/components/MyStatus";
import { PostList } from "@/components/PostList";
import { TierCards } from "@/components/TierCards";
import { SERVICES } from "@/lib/content";
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
  const address = s.site.address ?? store?.address ?? null;
  const hours = store ? hoursLines(store.openHours) : [];
  const prices = Array.from(new Set(lanes.map((l) => l.hourlyPriceSatang))).sort((a, b) => a - b);
  const maxCap = lanes.reduce((m, l) => Math.max(m, l.capacity), 0);
  const maxDaysAhead = Math.max(...s.tiers.map((t) => t.benefits.simBookingDaysAhead));
  const minDaysAhead = Math.min(...s.tiers.map((t) => t.benefits.simBookingDaysAhead));

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

      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="hero-place">
              <IconPin size={18} />
              <span>{store?.name ?? org.name}</span>
            </p>
            <h1 className="hero-title">
              ร้านกอล์ฟที่ให้คุณ
              <br />
              <span className="accent-line">ลองก่อนเลือก</span>
            </h1>
            <p className="lede">
              อุปกรณ์กอล์ฟ ฟิตติ้งไม้ให้เข้ากับวงสวิง คลาสกับโปร และ Golf Simulator {lanes.length || 3} lane — อยู่ในร้านเดียว ใจกลางถนนพระราม 4
            </p>
            <div className="cta-row">
              <Link href="/app/booking" className="btn btn-primary">
                จองซิม
              </Link>
              <Link href="/app/member" className="btn btn-secondary">
                สมัครสมาชิก
              </Link>
            </div>
          </div>
          <div className="hero-visual">
            <Photo photo={PHOTOS.hero} priority className="hero-photo" />
            <MyStatus welcomePoints={s.welcomeBonus} />
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="services-h">
        <div className="wrap">
          <div className="section-head">
            <h2 id="services-h">ครบตั้งแต่เลือกไม้ จนถึงวันออกรอบ</h2>
            <p>สี่บริการที่ต่อกันเป็นเส้นเดียว ลองไม้บนซิม ฟิตติ้งให้เข้ากับวงสวิง แล้วซ้อมต่อกับโปรได้ในที่เดียว</p>
          </div>
          <ul className="svc-list">
            {SERVICES.map((svc) => (
              <li key={svc.slug} className="svc-row">
                {SERVICE_PHOTO[svc.slug] && <Photo photo={SERVICE_PHOTO[svc.slug]!} className="svc-thumb" sizes="(min-width: 900px) 180px, 100vw" />}
                <div className="svc-name">
                  <h3>{svc.name}</h3>
                  <span>{svc.thai}</span>
                </div>
                <p className="svc-short">{svc.short}</p>
                <Link href={svc.slug === "golf-simulator" ? "/golf-simulator" : `/services#${svc.slug}`} className="link-arrow svc-more">
                  <span>ดูรายละเอียด</span>
                  <IconArrow size={18} />
                  <span className="visually-hidden">{svc.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="band-sim" aria-labelledby="sim-h">
        <div className="wrap sim-grid">
          <div className="sim-copy">
            <h2 id="sim-h">Golf Simulator {lanes.length || 3} lane</h2>
            <p>ซ้อมไดรฟ์ ซ้อมเหล็ก หรือเล่นสนามจำลองกับเพื่อน จองรายชั่วโมงผ่าน LINE หรือเว็บไซต์ ช่องว่างตรงกันทุกช่องทาง ไม่มีจองซ้อน</p>
            <dl className="sim-facts">
              {prices.length > 0 && (
                <div>
                  <dt>ราคา</dt>
                  <dd className="num">
                    {prices.map((p) => formatBaht(p)).join(" / ")}
                    <small className="nowrap"> /ชม.</small>
                  </dd>
                </div>
              )}
              {maxCap > 0 && (
                <div>
                  <dt>ต่อ lane</dt>
                  <dd className="num">
                    สูงสุด {maxCap} <small>คน</small>
                  </dd>
                </div>
              )}
              <div>
                <dt>จองล่วงหน้า</dt>
                <dd className="num">
                  {minDaysAhead === maxDaysAhead ? minDaysAhead : `${minDaysAhead}–${maxDaysAhead}`} <small>วัน</small>
                </dd>
              </div>
              <div>
                <dt>ชำระเงิน</dt>
                <dd>
                  ที่ร้าน <small>ตอนเช็กอิน</small>
                </dd>
              </div>
            </dl>
            <div className="cta-row">
              <Link href="/app/booking" className="btn btn-on-dark">
                จองซิม
              </Link>
              <Link href="/golf-simulator" className="btn btn-quiet-dark">
                ราคาและกติกาการจอง
              </Link>
            </div>
          </div>
          <div className="sim-visual">
            <Photo photo={PHOTOS.simBays} ratio="16 / 10" className="sim-photo" />
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="tiers-h">
        <div className="wrap">
          <div className="section-head">
            <h2 id="tiers-h">สมาชิก MST Golf</h2>
            <p>
              สมัครฟรีผ่าน LINE รับ <b className="num">{formatPoints(s.welcomeBonus)}</b> แต้มต้อนรับ ระดับสมาชิกคิดจากยอดซื้อสะสม 12 เดือนล่าสุด ไม่ใช่แต้มคงเหลือ
              ใช้บัตรสมาชิกในมือถือแสดงที่เคาน์เตอร์ได้ทันที
            </p>
          </div>
          <TierCards tiers={s.tiers} />
          <div className="cta-row center">
            <Link href="/app/member" className="btn btn-primary">
              สมัครสมาชิก
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-rule" aria-labelledby="posts-h">
        <div className="wrap">
          <div className="section-head row">
            <h2 id="posts-h">บทความล่าสุด</h2>
            <Link href="/blog" className="link-arrow">
              <span>ดูทั้งหมด</span>
              <IconArrow size={18} />
            </Link>
          </div>
          {posts.length ? <PostList posts={posts} /> : <p className="empty">บทความชุดแรกกำลังจะมา — ติดตามเทคนิคการซ้อมและข่าวจากร้านได้ที่นี่</p>}
        </div>
      </section>

      <section className="section visit" aria-labelledby="visit-h">
        <div className="wrap visit-grid">
          <div>
            <h2 id="visit-h">แวะมาที่ร้าน</h2>
            <p className="visit-place">{store?.name ?? org.name}</p>
            <Photo photo={PHOTOS.store} ratio="16 / 9" className="visit-photo" />
          </div>
          <div className="visit-facts">
            <ul className="facts">
              {address && (
                <li>
                  <IconPin />
                  <span>{address}</span>
                </li>
              )}
              {hours.map((h) => (
                <li key={h}>
                  <IconClock />
                  <span>{h}</span>
                </li>
              ))}
              {s.site.phone && (
                <li>
                  <IconPhone />
                  <a href={`tel:${s.site.phone.replace(/[^\d+]/g, "")}`}>{s.site.phone}</a>
                </li>
              )}
            </ul>
            <div className="cta-row">
              {s.site.mapsUrl && (
                <a href={s.site.mapsUrl} className="btn btn-secondary" target="_blank" rel="noopener">
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
