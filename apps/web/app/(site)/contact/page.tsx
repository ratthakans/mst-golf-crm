import type { Metadata } from "next";
import { CONTACT_TOPICS, emailConfigured } from "@mstgolf/core";
import { ContactForm } from "@/components/ContactForm";
import { Photo } from "@/components/Photo";
import { SheetHead } from "@/components/SheetHead";
import { hoursLines } from "@/lib/format";
import { sitePhotos } from "@/lib/images";
import { getOrg, getStore } from "@/lib/org";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "ติดต่อเรา",
  description: "ที่อยู่ เวลาเปิด เบอร์โทร แผนที่ และฝากข้อความถึงทีม MST Golf",
  alternates: { canonical: "/contact" },
  openGraph: { title: "ติดต่อเรา | MST Golf", url: "/contact" },
};

export default async function ContactPage() {
  const [org, store] = await Promise.all([getOrg(), getStore()]);
  const site = org.settings.site;
  const address = site.address ?? store?.address ?? null;
  const hours = store ? hoursLines(store.openHours) : [];
  // The form only appears when a message would reach someone (Marketing's email + the mail service).
  const formOpen = org.settings.redemption.alertEmails.length > 0 && emailConfigured();
  const photos = sitePhotos(site);

  return (
    <>
      <SheetHead
        label="Contact"
        title="ติดต่อเรา"
        lede={`แวะมาลองไม้ ฟิตติ้ง หรือจองซิมกอล์ฟ · สอบถามได้ทางโทรศัพท์${formOpen ? " หรือฝากข้อความด้านล่าง" : ""}`}
      />
      <section className="pg-body">
        <div className="wrap contact-grid">
          <div className="contact-facts">
            <dl className="card-facts">
              <div>
                <dt>ร้าน</dt>
                <dd>{store?.name ?? org.name}</dd>
              </div>
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
                      <span key={h} className="contact-line">
                        {h}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {site.phone && (
                <div>
                  <dt>โทร</dt>
                  <dd>
                    <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`} className="num">
                      {site.phone}
                    </a>
                  </dd>
                </div>
              )}
              {(site.facebookUrl || site.instagramUrl) && (
                <div>
                  <dt>ติดตาม</dt>
                  <dd className="contact-social">
                    {site.facebookUrl && (
                      <a href={site.facebookUrl} target="_blank" rel="noopener">
                        Facebook ↗
                      </a>
                    )}
                    {site.instagramUrl && (
                      <a href={site.instagramUrl} target="_blank" rel="noopener">
                        Instagram ↗
                      </a>
                    )}
                  </dd>
                </div>
              )}
            </dl>
            <div className="cta-row">
              {site.mapsUrl && (
                <a href={site.mapsUrl} className="btn btn-primary" target="_blank" rel="noopener">
                  นำทางด้วย Google Maps
                </a>
              )}
              {site.shopUrl && (
                <a href={site.shopUrl} className="btn btn-outline" target="_blank" rel="noopener">
                  ร้านออนไลน์
                </a>
              )}
              {org.settings.features.line && site.lineOaUrl && (
                <a href={site.lineOaUrl} className="btn btn-line" target="_blank" rel="noopener">
                  เพิ่มเพื่อน LINE OA
                </a>
              )}
            </div>
          </div>
          {formOpen ? (
            <ContactForm topics={[...CONTACT_TOPICS]} />
          ) : (
            // No form until a message would reach someone: show the storefront instead of a "not open yet" box.
            <Photo photo={photos.store} ratio="4 / 3" className="contact-photo" position="80% 50%" sizes="(min-width: 900px) 50vw, 100vw" />
          )}
        </div>
      </section>
    </>
  );
}
