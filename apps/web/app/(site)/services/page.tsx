import type { Metadata } from "next";
import Link from "next/link";
import { Photo } from "@/components/Photo";
import { siteServices } from "@/lib/content";
import { servicePhotos, sitePhotos } from "@/lib/images";
import { getOrg } from "@/lib/org";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "บริการ — Pro shop · Club fitting · Academy · Golf Simulator",
  description: "บริการของ MST Golf ชาญอิสสระ ทาวเวอร์ 1: ร้านอุปกรณ์กอล์ฟ ฟิตติ้งไม้กอล์ฟตามวงสวิง คลาสเรียนกับโปร และ Golf Simulator จองออนไลน์",
  alternates: { canonical: "/services" },
  openGraph: { title: "บริการ | MST Golf", url: "/services" },
};

export default async function ServicesPage() {
  const org = await getOrg();
  const lineOa = org.settings.site.lineOaUrl;
  const SERVICES = siteServices(org.settings.site.copy);
  const photos = sitePhotos(org.settings.site);
  const SERVICE_PHOTO = servicePhotos(photos);

  return (
    <>
      <section className="page-head book-head">
        <div className="wrap">
          <h1>บริการ</h1>
          <p className="lede">ทุกบริการใช้ห้องซิมเป็นเครื่องมือเดียวกัน คุณจึงเห็นตัวเลขวงสวิงของตัวเองตั้งแต่ลองไม้ ฟิตติ้ง ไปจนถึงเรียนกับโปร</p>
          <nav className="stops" aria-label="ไปยังบริการ">
            {SERVICES.map((s, i) => (
              <a key={s.slug} href={`#${s.slug}`} className="stop-link">
                <span className="y-dot mono" aria-hidden="true">
                  {i + 1}
                </span>
                {s.name}
              </a>
            ))}
          </nav>
          <figure className="book-hero">
            <Photo photo={photos.hero} ratio="21 / 9" priority sizes="(min-width: 1120px) 1120px, 100vw" />
          </figure>
        </div>
      </section>

      {SERVICES.map((svc, i) => (
        <section key={svc.slug} id={svc.slug} className="book-page" aria-labelledby={`${svc.slug}-h`}>
          <div className="wrap book-grid">
            <div className="book-side">
              <h2 id={`${svc.slug}-h`}>
                <span className="y-dot mono" aria-hidden="true">
                  {i + 1}
                </span>
                {svc.name}
              </h2>
              <p className="book-thai">{svc.thai}</p>
              {SERVICE_PHOTO[svc.slug] && (
                <figure className="book-figure">
                  <Photo photo={SERVICE_PHOTO[svc.slug]!} ratio="4 / 3" sizes="(min-width: 900px) 34vw, 100vw" />
                </figure>
              )}
            </div>
            <div className="book-body">
              {svc.body.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
              <ul className="book-points">
                {svc.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <div className="cta-row">
                {svc.slug === "golf-simulator" ? (
                  <>
                    <Link href="/app/booking" className="btn btn-primary">
                      จองซิม
                    </Link>
                    <Link href="/golf-simulator" className="text-link">
                      ราคาและกติกา
                    </Link>
                  </>
                ) : lineOa ? (
                  <a href={lineOa} className="btn btn-line" target="_blank" rel="noopener">
                    สอบถามทาง LINE
                  </a>
                ) : (
                  <p className="hint">สอบถามรายละเอียดได้ที่หน้าร้าน</p>
                )}
              </div>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
