import type { Metadata } from "next";
import Link from "next/link";
import { Photo } from "@/components/Photo";
import { SectionHead } from "@/components/SectionHead";
import { SheetHead } from "@/components/SheetHead";
import { siteServices } from "@/lib/content";
import { servicePhotos, sitePhotos } from "@/lib/images";
import { getOrg } from "@/lib/org";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "บริการ — Pro shop · Club fitting · Golf Simulator",
  description: "บริการของ MST Golf ชาญอิสสระ ทาวเวอร์ 1: ร้านอุปกรณ์กอล์ฟ ฟิตติ้งไม้กอล์ฟตามวงสวิง และ Golf Simulator จองออนไลน์",
  alternates: { canonical: "/services" },
  openGraph: { title: "บริการ | MST Golf", url: "/services" },
};

export default async function ServicesPage() {
  const org = await getOrg();
  const lineOa = org.settings.features.line ? org.settings.site.lineOaUrl : null;
  const SERVICES = siteServices(org.settings.site.copy);
  const photos = sitePhotos(org.settings.site);
  const SERVICE_PHOTO = servicePhotos(photos);
  const phone = org.settings.site.phone ?? null;
  const tel = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;
  const shop = SERVICES.find((x) => x.slug === "pro-shop");
  const fit = SERVICES.find((x) => x.slug === "club-fitting");
  const sim = SERVICES.find((x) => x.slug === "golf-simulator");

  // Ask by phone (or LINE when it's on); the sim books online instead.
  const ask = (primary: boolean) =>
    lineOa ? (
      <a href={lineOa} className="btn btn-line" target="_blank" rel="noopener">
        สอบถามทาง LINE
      </a>
    ) : tel ? (
      <a href={tel} className={`btn ${primary ? "btn-primary" : "btn-outline"}`}>
        โทร <span className="num">{phone}</span>
      </a>
    ) : (
      <Link href="/contact" className="btn btn-outline">
        สอบถาม
      </Link>
    );

  return (
    <>
      <SheetHead
        label="Services"
        title="บริการในร้าน"
        lede="ทุกบริการใช้ห้องซิมเป็นเครื่องมือเดียวกัน คุณจึงเห็นตัวเลขวงสวิงของตัวเองตั้งแต่ลองไม้ ฟิตติ้ง ไปจนถึงซ้อมบนซิม"
      />

      {/* the three services as an index, each a jump to its section */}
      <section className="q-sec sv-jump" aria-label="บริการทั้งหมด">
        <div className="wrap">
          <ul className="n-index-list sv-index">
            {SERVICES.map((svc) => (
              <li key={svc.slug}>
                <a href={`#${svc.slug}`} className="n-index-row">
                  <span className="n-index-name">
                    <span lang="en">{svc.name}</span>
                    <span className="n-index-thai">{svc.thai}</span>
                  </span>
                  <span className="n-index-short">{svc.short}</span>
                  <span className="n-index-arrow" aria-hidden="true">
                    ↓
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {shop && (
        <section id={shop.slug} className="q-sec n-ruled" aria-labelledby={`${shop.slug}-h`}>
          <div className="wrap q-split">
            {SERVICE_PHOTO[shop.slug] && <Photo photo={SERVICE_PHOTO[shop.slug]!} ratio="4 / 5" className="q-split-img" sizes="(min-width: 900px) 50vw, 100vw" />}
            <div className="q-split-copy">
              <SectionHead id={`${shop.slug}-h`} label={shop.name} title={shop.thai} lede={shop.body[0]} />
              {shop.body.slice(1).map((p) => (
                <p key={p.slice(0, 24)} className="q-body">
                  {p}
                </p>
              ))}
              <ul className="sv-points">
                {shop.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <div className="q-actions">
                {ask(true)}
                <Link href="/contact" className="text-link">
                  ที่ตั้งและเวลาเปิด
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {fit && (
        <section id={fit.slug} className="q-sec n-ruled" aria-labelledby={`${fit.slug}-h`}>
          <div className="wrap">
            <SectionHead id={`${fit.slug}-h`} label={fit.name} title={fit.thai} lede={fit.body[0]} />
            {SERVICE_PHOTO[fit.slug] && <Photo photo={SERVICE_PHOTO[fit.slug]!} ratio="21 / 9" className="sv-wide" sizes="100vw" position="50% 40%" />}
            {/* fitting is a sequence, so its points read as numbered steps */}
            <ol className="sv-steps">
              {fit.points.slice(0, 3).map((p, i) => (
                <li key={p}>
                  <span className="sv-step-n mono">{String(i + 1).padStart(2, "0")}</span>
                  <span className="sv-step-t">{p}</span>
                </li>
              ))}
            </ol>
            <div className="sv-fit-foot">
              <p className="q-body">{[...fit.body.slice(1), ...fit.points.slice(3)].join(" · ")}</p>
              <div className="q-actions">{ask(true)}</div>
            </div>
          </div>
        </section>
      )}

      {sim && (
        <section id={sim.slug} className="n-night" aria-labelledby={`${sim.slug}-h`}>
          <div className="wrap n-night-row">
            {SERVICE_PHOTO[sim.slug] && <Photo photo={SERVICE_PHOTO[sim.slug]!} ratio="4 / 5" className="n-night-img" sizes="(min-width: 900px) 45vw, 100vw" />}
            <div className="n-night-copy">
              <h2 id={`${sim.slug}-h`} className="q-title">
                {sim.thai}
              </h2>
              {sim.body.map((p) => (
                <p key={p.slice(0, 24)} className="q-lede">
                  {p}
                </p>
              ))}
              <ul className="sv-points sv-points-night">
                {sim.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
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
    </>
  );
}
