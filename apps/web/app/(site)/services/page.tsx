import type { Metadata } from "next";
import Link from "next/link";
import { IconCheck } from "@/components/icons";
import { SERVICES } from "@/lib/content";
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

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <h1>บริการ</h1>
          <p className="lede">ทุกบริการใช้ห้องซิมเป็นเครื่องมือเดียวกัน คุณจึงเห็นตัวเลขวงสวิงของตัวเองตั้งแต่ลองไม้ ฟิตติ้ง ไปจนถึงเรียนกับโปร</p>
          <nav className="jump" aria-label="ไปยังบริการ">
            {SERVICES.map((s) => (
              <a key={s.slug} href={`#${s.slug}`} className="jump-link">
                {s.name}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {SERVICES.map((svc, i) => (
        <section key={svc.slug} id={svc.slug} className={`svc-detail${i % 2 ? " alt" : ""}`} aria-labelledby={`${svc.slug}-h`}>
          <div className="wrap svc-detail-grid">
            <div className="svc-detail-head">
              <h2 id={`${svc.slug}-h`}>{svc.name}</h2>
              <p className="svc-thai">{svc.thai}</p>
            </div>
            <div className="svc-detail-body">
              {svc.body.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
              <ul className="ticks">
                {svc.points.map((p) => (
                  <li key={p}>
                    <IconCheck size={18} />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <div className="cta-row">
                {svc.slug === "golf-simulator" ? (
                  <>
                    <Link href="/app/booking" className="btn btn-primary">
                      จองซิม
                    </Link>
                    <Link href="/golf-simulator" className="btn btn-secondary">
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
