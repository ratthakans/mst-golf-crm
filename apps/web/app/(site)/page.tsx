import type { Metadata } from "next";
import Link from "next/link";
import { localDateKey } from "@mstgolf/core";
import { SectionHead } from "@/components/SectionHead";
import { SheetHead } from "@/components/SheetHead";
import { Photo } from "@/components/Photo";
import { servicePhotos, sitePhotos } from "@/lib/images";
import { EXCLUSIVE_BRANDS } from "@mstgolf/shared/site";
import { homeCopy, siteServices } from "@/lib/content";
import { formatBaht, formatBahtWhole, formatHm, formatPoints, hoursLines, openingSpec } from "@/lib/format";
import { getLanes, getOrg, getStore, siteOrigin } from "@/lib/org";
import { lanesToShow } from "@/lib/lanes";
import { currentPromotions } from "@/lib/posts";
import { endsSoon, promoHref, untilText } from "@/lib/promo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "MST Golf — ร้านกอล์ฟ โปรโมชัน ฟิตติ้ง และ Golf Simulator ชาญอิสสระ ทาวเวอร์ 1" },
  description:
    "ร้านอุปกรณ์กอล์ฟ MST Golf ชาญอิสสระ ทาวเวอร์ 1 ถนนพระราม 4 — โปรโมชันไม้กอล์ฟ รองเท้า เสื้อผ้า และอุปกรณ์ · Club fitting · Golf Simulator · สมัครสมาชิกสะสมแต้มทุกการซื้อ",
  alternates: { canonical: "/" },
  openGraph: { title: "MST Golf", description: "โปรโมชันล่าสุด ไม้กอล์ฟ อุปกรณ์ ฟิตติ้ง และ Golf Simulator", url: "/" },
};

// The home page, "clubhouse at night": one full-bleed photo with the store's
// own line, then a short run of white sections and one dark block for the
// simulator — promotions (laid out by how many there are), the sim with the
// next free times, the shop and fitting, the exclusive brands, membership in
// one line per tier, and the store. Green is kept for the primary action;
// every number comes from the back office or live data.
export default async function HomePage() {
  const [org, store, lanes, origin, promos] = await Promise.all([getOrg(), getStore(), getLanes(), siteOrigin(), currentPromotions(3)]);
  const s = org.settings;
  const photos = sitePhotos(s.site);
  const svcPhotos = servicePhotos(photos);
  const services = siteServices(s.site.copy).filter((svc) => svc.slug !== "golf-simulator"); // the sim has its own block
  const copy = homeCopy(s.site.copy, lanes.length || 3);
  const address = s.site.address ?? store?.address ?? null;
  const hours = store ? hoursLines(store.openHours) : [];
  const prices = Array.from(new Set(lanes.map((l) => l.hourlyPriceSatang))).sort((x, y) => x - y);
  const now = new Date();
  const lanesDay = s.features.booking && lanes.length ? await lanesToShow(org.id, now) : null;

  // The next free start times (any lane), each a link straight to that slot.
  const nextFree = lanesDay
    ? lanesDay.avail.slots
        .map((slot) => ({ slot, lane: slot.lanes.find((l) => l.state === "free"), free: slot.lanes.filter((l) => l.state === "free").length }))
        .filter((x): x is { slot: (typeof x)["slot"]; lane: NonNullable<(typeof x)["lane"]>; free: number } => !!x.lane)
        .slice(0, 5)
        .map(({ slot, lane, free }) => ({
          free,
          label: formatHm(new Date(slot.startAt)),
          href: `/app/booking?date=${localDateKey(new Date(slot.startAt))}&at=${encodeURIComponent(slot.startAt)}&lane=${encodeURIComponent(lane.laneId)}`,
        }))
    : [];
  const freeCount = lanesDay ? lanesDay.avail.slots.reduce((n, sl) => n + sl.lanes.filter((l) => l.state === "free").length, 0) : null;

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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <SheetHead
        full
        label="Pro shop · Club fitting · Golf Simulator"
        title={
          copy.heroHighlight ? (
            <>
              {copy.heroTitle} <span className="hero-hl">{copy.heroHighlight}</span>
            </>
          ) : (
            copy.heroTitle
          )
        }
        lede={copy.heroLede}
        actions={
          <>
            <Link href="/app/booking" className="btn btn-light">
              จองซิมกอล์ฟ
            </Link>
            <Link href="/register" className="text-link">
              สมัครสมาชิก รับ {formatPoints(s.welcomeBonus)} แต้ม
            </Link>
          </>
        }
        media={<Photo photo={photos.hero} ratio="16 / 9" priority sizes="100vw" position="50% 22%" />}
      />

      {promos.length > 0 && (
        <section className="q-sec" aria-labelledby="promos-h">
          <div className="wrap">
            <SectionHead id="promos-h" label="Promotions" title="โปรโมชันเดือนนี้" link={{ href: "/promotions", text: "ดูทั้งหมด" }} />
            {/* the layout follows the count: one wide card, two halves, or three columns */}
            <ul className={`n-promos n-promos-${promos.length}`}>
              {promos.map((p) => (
                <li key={p.slug}>
                  <Link href={`/promotions/${p.slug}`} className="n-promo">
                    <span className="n-promo-img">
                      {/* eslint-disable-next-line @next/next/no-img-element -- promotion covers come from MST's uploads */}
                      {p.coverUrl ? <img src={p.coverUrl} alt="" loading="lazy" /> : null}
                    </span>
                    <span className="n-promo-copy">
                      <span className={`n-promo-until${endsSoon(p.endsAt, now) ? " soon" : ""}`}>{untilText(p.endsAt, now)}</span>
                      <span className="n-promo-title">{p.title}</span>
                      {p.excerpt && <span className="n-promo-text">{p.excerpt}</span>}
                      <span className="n-go" aria-hidden="true">
                        ดูรายละเอียด →
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {lanesDay && (
        <section className="n-night" aria-labelledby="sim-h">
          <div className="wrap n-night-row">
            <Photo photo={photos.simBays} ratio="4 / 5" className="n-night-img" sizes="(min-width: 900px) 45vw, 100vw" />
            <div className="n-night-copy">
              <p className="q-label" lang="en">
                Golf Simulator
              </p>
              <h2 id="sim-h" className="q-title">
                ซิมกอล์ฟ จองได้ทันที
              </h2>
              <p className="q-lede">เลือกเวลาว่างแล้วจองบนเว็บไซต์ได้เลย ไม่ต้องรอร้านยืนยัน ชำระเงินที่ร้านตอนเช็กอิน</p>
              <dl className="n-stats">
                <div>
                  <dt>ว่าง{lanesDay.word}</dt>
                  <dd>
                    <b className="mono">{freeCount}</b> ช่อง
                  </dd>
                </div>
                {prices.length > 0 && (
                  <div>
                    <dt>ต่อชั่วโมง</dt>
                    <dd>
                      <b className="mono">{prices.map((x) => formatBaht(x)).join(" / ")}</b>
                    </dd>
                  </div>
                )}
                <div>
                  <dt>จำนวน</dt>
                  <dd>
                    <b className="mono">{lanes.length}</b> lane
                  </dd>
                </div>
              </dl>
              {nextFree.length > 0 && (
                <div className="n-times">
                  <p className="n-times-label">เวลาว่าง{lanesDay.word === "พรุ่งนี้" ? "พรุ่งนี้" : "วันนี้"} · แตะเพื่อจอง</p>
                  <ul>
                    {nextFree.map((t) => (
                      <li key={t.href}>
                        <Link href={t.href} className="n-time" aria-label={`จองเวลา ${t.label} น. ว่าง ${t.free} lane`}>
                          <span className="mono">{t.label}</span>
                          <span className="n-time-free">{t.free} lane</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="q-actions">
                <Link href="/app/booking" className="btn btn-primary">
                  ดูตารางและจอง
                </Link>
                <Link href="/golf-simulator" className="text-link n-link">
                  ราคา สมาชิกลด และกติกา
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="q-sec" aria-labelledby="svc-h">
        <div className="wrap">
          <SectionHead id="svc-h" label="In store" title={copy.servicesTitle} link={{ href: "/services", text: "บริการทั้งหมด" }} />
          <ul className="n-svc">
            {services.map((svc) => (
              <li key={svc.slug}>
                <Link href={`/services#${svc.slug}`} className="n-svc-item">
                  <Photo photo={svcPhotos[svc.slug] ?? photos.proShop} ratio="3 / 2" sizes="(min-width: 900px) 50vw, 100vw" />
                  <span className="n-svc-name">
                    <span lang="en">{svc.name}</span>
                    <span className="n-svc-thai">{svc.thai}</span>
                  </span>
                  <span className="n-svc-short">{svc.short}</span>
                  <span className="n-go" aria-hidden="true">
                    ดูรายละเอียด →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="q-sec n-ruled" aria-labelledby="excl-h">
        <div className="wrap">
          <SectionHead
            id="excl-h"
            label="Exclusive at MST Golf"
            title="แบรนด์ที่มีเฉพาะที่ MST Golf"
            link={s.site.shopUrl ? { href: s.site.shopUrl, text: "ดูสินค้าทั้งหมด" } : undefined}
          />
          <ul className="n-excl" tabIndex={0} aria-label="แบรนด์ที่มีเฉพาะที่ MST Golf">
            {EXCLUSIVE_BRANDS.map((b) => (
              <li key={b.name} className="n-excl-item">
                <span className="n-excl-img">
                  {/* eslint-disable-next-line @next/next/no-img-element -- MST Golf Thailand's brand photography */}
                  <img src={b.image} alt="" loading="lazy" style={b.position ? { objectPosition: b.position } : undefined} />
                </span>
                <span className="n-excl-name" lang="en">
                  {b.name}
                </span>
                <span className="n-excl-line">{b.line}</span>
              </li>
            ))}
          </ul>
          {copy.brands.length > 0 && (
            <div className="n-brands">
              <h3 className="q-label" lang="en">
                Also in store
              </h3>
              {/* one slow line of names until MST sends the logos; still for reduced motion */}
              <div className="n-brands-view">
              <div className="n-brands-track">
                <ul lang="en" aria-label="แบรนด์ในร้าน">
                  {copy.brands.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <ul lang="en" aria-hidden="true">
                  {copy.brands.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="q-sec n-ruled" aria-labelledby="club-h">
        <div className="wrap n-club">
          <div>
            <SectionHead
              id="club-h"
              label="Membership"
              title={
                <>
                  สมัครฟรี รับ <span className="mono">{formatPoints(s.welcomeBonus)}</span> แต้ม
                </>
              }
              lede="บัตรสมาชิกอยู่ในมือถือ สะสมแต้มทุกการซื้อ ระดับขึ้นตามยอดซื้อ 12 เดือน"
            />
            <div className="q-actions">
              <Link href="/register" className="btn btn-primary">
                สมัครสมาชิก
              </Link>
              <Link href="/rewards" className="text-link">
                สิทธิ์ทั้งหมดและรางวัล
              </Link>
            </div>
          </div>
          <ul className="n-tiers">
            {s.tiers.map((t) => {
              const entry = t.minSpend12m === 0;
              return (
                <li key={t.key} className={`n-tier tier-${t.key.toLowerCase()}`}>
                  <span className="n-tier-name" lang="en">
                    {t.name}
                  </span>
                  <span className="n-tier-big mono">{entry ? formatPoints(s.welcomeBonus) : `${t.benefits.discountPct}%`}</span>
                  <span className="n-tier-what">
                    {entry ? "แต้มต้อนรับเมื่อสมัคร" : `ส่วนลดสินค้า · ซิมลด ${t.benefits.simDiscountPct}%`}
                  </span>
                  <span className="n-tier-min">{entry ? "สมัครฟรี" : `ยอดซื้อ ${formatBahtWhole(t.minSpend12m)}+ ใน 12 เดือน`}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="q-sec n-ruled" aria-labelledby="visit-h">
        <div className="wrap q-split q-split-flip">
          <Photo photo={photos.store} ratio="4 / 3" className="q-split-img q-store-img" sizes="(min-width: 900px) 50vw, 100vw" />
          <div className="q-split-copy">
            <SectionHead
              id="visit-h"
              label="Visit"
              title={(store?.name ?? org.name).split(" ").map((w, i) => (
                <span key={i}>
                  {i > 0 && " "}
                  <span className="word">{w}</span>
                </span>
              ))}
            />
            <dl className="q-facts">
              {address && (
                <div>
                  <dt>ที่อยู่</dt>
                  <dd>{address}</dd>
                </div>
              )}
              {hours.length > 0 && (
                <div>
                  <dt>เวลาเปิด</dt>
                  <dd>
                    {hours.map((h) => (
                      <span key={h} className="q-line">
                        {h}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {s.site.phone && (
                <div>
                  <dt>โทร</dt>
                  <dd>
                    <a href={`tel:${s.site.phone.replace(/[^\d+]/g, "")}`} className="mono">
                      {s.site.phone}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
            <div className="q-actions">
              {s.site.mapsUrl ? (
                <a href={s.site.mapsUrl} className="btn btn-outline" target="_blank" rel="noopener">
                  นำทางด้วย Google Maps
                </a>
              ) : (
                <Link href="/contact" className="btn btn-outline">
                  ติดต่อและเดินทาง
                </Link>
              )}
              {s.site.mapsUrl && (
                <Link href="/contact" className="text-link">
                  ติดต่อเรา
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
