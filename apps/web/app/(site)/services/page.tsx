import type { Metadata } from "next";
import Link from "next/link";
import { Photo } from "@/components/Photo";
import { ServiceDirectory } from "@/components/ServiceDirectory";
import { SheetHead } from "@/components/SheetHead";
import { hoursLines } from "@/lib/format";
import { siteServices } from "@/lib/content";
import { servicePhotos, sitePhotos } from "@/lib/images";
import { getOrg, getStore } from "@/lib/org";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "บริการ — Pro shop · Club fitting · Academy · Golf Simulator",
  description: "บริการของ MST Golf ชาญอิสสระ ทาวเวอร์ 1: ร้านอุปกรณ์กอล์ฟ ฟิตติ้งไม้กอล์ฟตามวงสวิง คลาสเรียนกับโปร และ Golf Simulator จองออนไลน์",
  alternates: { canonical: "/services" },
  openGraph: { title: "บริการ | MST Golf", url: "/services" },
};

export default async function ServicesPage() {
  const [org, store] = await Promise.all([getOrg(), getStore()]);
  const lineOa = org.settings.features.line ? org.settings.site.lineOaUrl : null;
  const SERVICES = siteServices(org.settings.site.copy);
  const photos = sitePhotos(org.settings.site);
  const SERVICE_PHOTO = servicePhotos(photos);
  const hours = store ? hoursLines(store.openHours) : [];

  return (
    <>
      <SheetHead
        title="บริการในร้าน"
        lede="ทุกบริการใช้ห้องซิมเป็นเครื่องมือเดียวกัน คุณจึงเห็นตัวเลขวงสวิงของตัวเองตั้งแต่ลองไม้ ฟิตติ้ง ไปจนถึงเรียนกับโปร"
        full
        media={<Photo photo={photos.hero} ratio="16 / 9" priority sizes="100vw" />}
      />

      <section className="pg-body" aria-label="บริการทั้งหมด">
        <div className="wrap">
          <ServiceDirectory services={SERVICES} onPage />
        </div>
      </section>

      {SERVICES.map((svc) => (
        <section key={svc.slug} id={svc.slug} className="svc" aria-labelledby={`${svc.slug}-h`}>
          <div className="wrap svc-grid">
            <div className="svc-side">
              <h2 id={`${svc.slug}-h`} className="svc-name">
                {svc.name}
              </h2>
              <p className="svc-thai">{svc.thai}</p>
              {SERVICE_PHOTO[svc.slug] && <Photo photo={SERVICE_PHOTO[svc.slug]!} ratio="4 / 3" className="svc-photo" sizes="(min-width: 900px) 34vw, 100vw" />}
            </div>
            <div className="svc-body">
              {svc.body.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
              <ul className="svc-points">
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
                  <Link href="/contact" className="btn btn-outline">
                    สอบถาม
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
