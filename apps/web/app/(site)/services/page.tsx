import type { Metadata } from "next";
import Link from "next/link";
import { Photo } from "@/components/Photo";
import { SectionHead } from "@/components/SectionHead";
import { SheetHead } from "@/components/SheetHead";
import { hoursLines } from "@/lib/format";
import { siteServices } from "@/lib/content";
import { servicePhotos, sitePhotos } from "@/lib/images";
import { getOrg, getStore } from "@/lib/org";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "บริการ — Pro shop · Club fitting · Golf Simulator",
  description: "บริการของ MST Golf ชาญอิสสระ ทาวเวอร์ 1: ร้านอุปกรณ์กอล์ฟ ฟิตติ้งไม้กอล์ฟตามวงสวิง และ Golf Simulator จองออนไลน์",
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
        label="Services"
        title="บริการในร้าน"
        lede="ทุกบริการใช้ห้องซิมเป็นเครื่องมือเดียวกัน คุณจึงเห็นตัวเลขวงสวิงของตัวเองตั้งแต่ลองไม้ ฟิตติ้ง ไปจนถึงซ้อมบนซิม"
        full
        media={<Photo photo={photos.hero} ratio="16 / 9" priority sizes="100vw" />}
      />

      {SERVICES.map((svc, i) => (
        <section key={svc.slug} id={svc.slug} className={`q-sec${i % 2 ? " q-alt" : ""}`} aria-labelledby={`${svc.slug}-h`}>
          <div className={`wrap q-split${i % 2 ? " q-split-flip" : ""}`}>
            {SERVICE_PHOTO[svc.slug] && <Photo photo={SERVICE_PHOTO[svc.slug]!} ratio="4 / 5" className="q-split-img" sizes="(min-width: 900px) 50vw, 100vw" />}
            <div className="q-split-copy">
              <SectionHead id={`${svc.slug}-h`} label={svc.name} title={svc.thai} lede={svc.body[0]} />
              {svc.body.slice(1).map((p) => (
                <p key={p.slice(0, 24)} className="q-body">
                  {p}
                </p>
              ))}
              <ul className="q-points">
                {svc.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <div className="q-actions">
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
