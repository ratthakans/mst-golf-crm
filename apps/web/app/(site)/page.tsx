import type { Metadata } from "next";
import Link from "next/link";
import { localDateKey } from "@mstgolf/core";
import { SectionHead } from "@/components/SectionHead";
import { SheetHead } from "@/components/SheetHead";
import { Photo } from "@/components/Photo";
import { servicePhotos, sitePhotos } from "@/lib/images";
import { homeCopy, siteServices } from "@/lib/content";
import { CATEGORY_LABEL, formatBaht, formatBahtWhole, formatHm, formatPoints, formatThaiDate, hoursLines, openingSpec } from "@/lib/format";
import { getLanes, getOrg, getStore, siteOrigin } from "@/lib/org";
import { lanesToShow } from "@/lib/lanes";
import { currentPromotions, publishedPosts } from "@/lib/posts";
import { endsSoon, promoHref, untilText } from "@/lib/promo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "MST Golf — ร้านกอล์ฟ โปรโมชัน ฟิตติ้ง อคาเดมี และ Golf Simulator ชาญอิสสระ ทาวเวอร์ 1" },
  description:
    "ร้านอุปกรณ์กอล์ฟ MST Golf ชาญอิสสระ ทาวเวอร์ 1 ถนนพระราม 4 — โปรโมชันไม้กอล์ฟ รองเท้า เสื้อผ้า และอุปกรณ์ · Club fitting · Academy · Golf Simulator · สมัครสมาชิกสะสมแต้มทุกการซื้อ",
  alternates: { canonical: "/" },
  openGraph: { title: "MST Golf", description: "โปรโมชันล่าสุด ไม้กอล์ฟ อุปกรณ์ ฟิตติ้ง อคาเดมี และ Golf Simulator", url: "/" },
};

// The home page, "quiet premium": one full-bleed hero (the lead promotion),
// then white sections that all share one head (label · title · see all) and
// one rhythm — promotions as big cards, the simulator as one calm module with
// the next free times, the services, membership, articles and the store.
// Green is kept for the primary action; every number comes from the back
// office or live data.
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
  const lanesDay = s.features.booking && lanes.length ? await lanesToShow(org.id, now) : null;

  // The next free start times (any lane), each a link straight to that slot.
  const nextFree = lanesDay
    ? lanesDay.avail.slots
        .map((slot) => ({ slot, lane: slot.lanes.find((l) => l.state === "free") }))
        .filter((x): x is { slot: (typeof x)["slot"]; lane: NonNullable<(typeof x)["lane"]> } => !!x.lane)
        .slice(0, 4)
        .map(({ slot, lane }) => ({
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

  const [lead, ...rest] = promos;
  const leadCta = lead ? promoHref(lead) : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <h1 className="visually-hidden">{org.name} — ร้านกอล์ฟ ชาญอิสสระ ทาวเวอร์ 1</h1>

      {lead ? (
        <SheetHead
          full
          label="Promotion"
          kicker={untilText(lead.endsAt, now)}
          kickerSoon={endsSoon(lead.endsAt, now)}
          titleAs="h2"
          titleId="window-h"
          title={lead.title}
          lede={lead.excerpt || null}
          actions={
            <>
              {leadCta!.external ? (
                <a href={leadCta!.href} className="btn btn-light" target="_blank" rel="noopener">
                  {lead.linkLabel || "ดูโปรโมชัน"}
                </a>
              ) : (
                <Link href={leadCta!.href} className="btn btn-light">
                  {lead.linkLabel || "ดูรายละเอียด"}
                </Link>
              )}
              <Link href={`/promotions/${lead.slug}`} className="text-link">
                {lead.hasBody ? "รายละเอียดและเงื่อนไข" : "ดูโปรโมชัน"}
              </Link>
            </>
          }
          media={
            // eslint-disable-next-line @next/next/no-img-element -- promotion covers come from MST's uploads
            <img src={lead.coverUrl ?? photos.hero.src} alt="" fetchPriority="high" />
          }
        />
      ) : (
        <SheetHead
          full
          label="MST Golf"
          titleAs="h2"
          titleId="window-h"
          title={copy.heroHighlight ? `${copy.heroTitle} ${copy.heroHighlight}` : copy.heroTitle}
          lede={copy.heroLede}
          media={<Photo photo={photos.hero} ratio="16 / 9" priority sizes="100vw" />}
        />
      )}

      {rest.length > 0 && (
        <section className="q-sec" aria-labelledby="promos-h">
          <div className="wrap">
            <SectionHead id="promos-h" label="Promotions" title="โปรโมชันเดือนนี้" link={{ href: "/promotions", text: "ดูทั้งหมด" }} />
            <ul className="q-cards">
              {rest.slice(0, 3).map((p) => (
                <li key={p.slug}>
                  <Link href={`/promotions/${p.slug}`} className="q-card">
                    <span className="q-card-img">
                      {/* eslint-disable-next-line @next/next/no-img-element -- promotion covers come from MST's uploads */}
                      {p.coverUrl ? <img src={p.coverUrl} alt="" loading="lazy" /> : null}
                    </span>
                    <span className={`q-card-meta${endsSoon(p.endsAt, now) ? " soon" : ""}`}>{untilText(p.endsAt, now)}</span>
                    <span className="q-card-title">{p.title}</span>
                    {p.excerpt && <span className="q-card-text">{p.excerpt}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {lanesDay && (
        <section className="q-sec q-alt" aria-labelledby="sim-h">
          <div className="wrap q-split">
            <Photo photo={photos.simBays} ratio="4 / 3" className="q-split-img" sizes="(min-width: 900px) 50vw, 100vw" />
            <div className="q-split-copy">
              <SectionHead id="sim-h" label="Golf Simulator" title="ซิมกอล์ฟ จองได้ทันที" lede="ช่องว่างจองได้ทันทีบนเว็บไซต์ ไม่ต้องรอร้านยืนยัน ชำระเงินที่ร้านตอนเช็กอิน" />
              <dl className="q-facts">
                <div>
                  <dt>ว่าง{lanesDay.word}</dt>
                  <dd>
                    <span className="mono">{freeCount}</span> ช่อง · {lanes.length} lane
                  </dd>
                </div>
                {prices.length > 0 && (
                  <div>
                    <dt>ราคา</dt>
                    <dd>{prices.map((x) => formatBaht(x)).join(" / ")} ต่อชั่วโมง · สมาชิกลดตามระดับ</dd>
                  </div>
                )}
                {hours[0] && (
                  <div>
                    <dt>เวลาเปิด</dt>
                    <dd>{hours[0]}</dd>
                  </div>
                )}
              </dl>
              {nextFree.length > 0 && (
                <div className="q-times">
                  <p className="q-times-label">เวลาว่างถัดไป{lanesDay.word === "พรุ่งนี้" ? " (พรุ่งนี้)" : ""}</p>
                  <ul>
                    {nextFree.map((t) => (
                      <li key={t.href}>
                        <Link href={t.href} className="q-time mono" aria-label={`จองเวลา ${t.label} น.`}>
                          {t.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="q-actions">
                <Link href="/app/booking" className="btn btn-primary">
                  จองซิม
                </Link>
                <Link href="/golf-simulator" className="text-link">
                  ราคาและกติกา
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="q-sec" aria-labelledby="svc-h">
        <div className="wrap">
          <SectionHead id="svc-h" label="Services" title={copy.servicesTitle} link={{ href: "/services", text: "บริการทั้งหมด" }} />
          <ul className="q-svc">
            {services.map((svc) => (
              <li key={svc.slug}>
                <Link href={svc.slug === "golf-simulator" ? "/golf-simulator" : `/services#${svc.slug}`} className="q-svc-item">
                  <Photo photo={svcPhotos[svc.slug] ?? photos.proShop} ratio="4 / 5" sizes="(min-width: 900px) 25vw, 50vw" />
                  <span className="q-svc-name" lang="en">
                    {svc.name}
                  </span>
                  <span className="q-svc-thai">{svc.thai}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="q-sec q-alt" aria-labelledby="club-h">
        <div className="wrap q-club">
          <div>
            <SectionHead
              id="club-h"
              label="Membership"
              title={
                <>
                  สมัครฟรี รับ <span className="mono">{formatPoints(s.welcomeBonus)}</span> แต้ม
                </>
              }
              lede="สมัครด้วยเบอร์มือถือ บัตรสมาชิกอยู่ในมือถือ สะสมแต้มทุกการซื้อ รับส่วนลด แลกคูปอง และจองซิม"
            />
            <div className="q-actions">
              <Link href="/register" className="btn btn-primary">
                สมัครสมาชิก
              </Link>
              <Link href="/rewards" className="text-link">
                สิทธิ์และรางวัล
              </Link>
            </div>
          </div>
          <ul className="q-tiers">
            {s.tiers.map((t) => (
              <li key={t.key} className={`q-tier q-tier-${t.key.toLowerCase()}`}>
                <span className="q-tier-name" lang="en">
                  {t.name}
                </span>
                <span className="q-tier-min">{t.minSpend12m === 0 ? "สมัครฟรี" : `ยอดซื้อ ${formatBahtWhole(t.minSpend12m)}+ / 12 เดือน`}</span>
                <span className="q-tier-perk">แต้ม ×{t.pointRate}</span>
                <span className="q-tier-perk">{t.benefits.discountPct ? `ส่วนลดสินค้า ${t.benefits.discountPct}%` : "ราคาปกติ"}</span>
                <span className="q-tier-perk">{t.benefits.simDiscountPct ? `ส่วนลดซิม ${t.benefits.simDiscountPct}%` : `จองซิมล่วงหน้า ${t.benefits.simBookingDaysAhead} วัน`}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {posts.length > 0 && (
        <section className="q-sec" aria-labelledby="journal-h">
          <div className="wrap">
            <SectionHead id="journal-h" label="Journal" title="บทความและข่าวจากร้าน" link={{ href: "/blog", text: "บทความทั้งหมด" }} />
            <ul className="q-cards q-cards-wide">
              {posts.map((p) => (
                <li key={p.slug}>
                  <Link href={`/blog/${p.slug}`} className="q-card">
                    <span className="q-card-img q-card-img-wide">
                      {/* eslint-disable-next-line @next/next/no-img-element -- covers live in MST's public Blob store or /mock */}
                      {p.coverUrl ? <img src={p.coverUrl} alt="" loading="lazy" /> : null}
                    </span>
                    <span className="q-card-meta">
                      {CATEGORY_LABEL[p.category]}
                      {p.publishedAt ? ` · ${formatThaiDate(new Date(p.publishedAt))}` : ""}
                    </span>
                    <span className="q-card-title">{p.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {copy.brands.length > 0 && (
        <section className="q-brands" aria-label="แบรนด์ในร้าน">
          <div className="wrap">
            <ul lang="en">
              {copy.brands.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="q-sec q-alt" aria-labelledby="visit-h">
        <div className="wrap q-split q-split-flip">
          <Photo photo={photos.store} ratio="4 / 3" className="q-split-img" sizes="(min-width: 900px) 50vw, 100vw" />
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
              {s.site.mapsUrl && (
                <a href={s.site.mapsUrl} className="btn btn-outline" target="_blank" rel="noopener">
                  เปิดใน Google Maps
                </a>
              )}
              <Link href="/contact" className="text-link">
                ติดต่อเรา
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
