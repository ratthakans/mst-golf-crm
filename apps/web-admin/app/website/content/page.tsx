import { listLanes } from "@mstgolf/core";
import { DEFAULT_HOME_COPY, DEFAULT_SERVICES, SITE_PHOTO_KEYS, SITE_PHOTO_LABEL } from "@mstgolf/shared/site";
import { allowPage } from "../../../lib/auth";
import { currentOrg } from "../../../lib/org";
import { webOrigin } from "../../../lib/web-origin";
import { Forbidden } from "../../Forbidden";
import { WebsiteTabs } from "../WebsiteTabs";
import { ContentForm } from "./ContentForm";

export const dynamic = "force-dynamic";

// Website photos and text (docs/PRODUCT.md §7.3). Blank = the placeholder the
// website already shows, so MST can replace things one at a time.
export default async function SiteContentPage() {
  const user = await allowPage("posts.manage");
  if (!user) return <Forbidden />;
  const org = await currentOrg();
  const lanes = await listLanes(org.id);
  const site = org.settings.site;
  const origin = webOrigin(site.siteUrl);
  const mockLeft = SITE_PHOTO_KEYS.filter((k) => !site.photos?.[k]).length;
  return (
    <>
      <div className="page-head">
        <h1>เว็บไซต์</h1>
        <p>
          รูปและข้อความบนหน้าเว็บ · ช่องที่เว้นว่างใช้ข้อความตั้งต้นที่แสดงเป็นตัวจาง · บันทึกแล้วขึ้นเว็บภายใน 5 นาที
          {origin && (
            <>
              {" "}· <a href={origin} target="_blank" rel="noreferrer">เปิดเว็บไซต์ ↗</a>
            </>
          )}
        </p>
      </div>
      <WebsiteTabs on="content" />
      {mockLeft > 0 && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          ยังเป็นรูปตัวอย่าง (AI mockup) {mockLeft} จาก {SITE_PHOTO_KEYS.length} รูป — ต้องเปลี่ยนเป็นรูปจริงของร้านก่อนเปิดเว็บ
        </div>
      )}
      <ContentForm
        initial={{ photos: site.photos ?? {}, copy: site.copy ?? {} }}
        slots={SITE_PHOTO_KEYS.map((k) => ({ key: k, ...SITE_PHOTO_LABEL[k] }))}
        services={DEFAULT_SERVICES.map((s) => ({ slug: s.slug, name: s.name, thai: s.thai, short: s.short, body: s.body.join("\n\n"), points: s.points.join("\n") }))}
        defaults={{ ...DEFAULT_HOME_COPY, heroLede: DEFAULT_HOME_COPY.heroLede(lanes.length || 3) }}
        origin={origin}
        uploadsEnabled={!!process.env.PUBLIC_BLOB_READ_WRITE_TOKEN}
      />
    </>
  );
}
