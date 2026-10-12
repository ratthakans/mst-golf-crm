import type { Metadata } from "next";
import Link from "next/link";
import { PromoList } from "@/components/PromoList";
import { getOrg } from "@/lib/org";
import { currentPromotions } from "@/lib/posts";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "โปรโมชัน",
  description: "โปรโมชันล่าสุดจาก MST Golf — ไม้กอล์ฟ อุปกรณ์ ฟิตติ้ง และ Golf Simulator",
  alternates: { canonical: "/promotions" },
  openGraph: { title: "โปรโมชัน | MST Golf", url: "/promotions" },
};

export default async function PromotionsPage() {
  const [promos, org] = await Promise.all([currentPromotions(30), getOrg()]);
  const shop = org.settings.site.shopUrl;
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <h1>โปรโมชัน</h1>
          <p className="lede">ข้อเสนอที่ใช้ได้ตอนนี้ที่ร้าน{shop ? "และร้านออนไลน์" : ""} · สมาชิกได้แต้มทุกการซื้อ</p>
        </div>
      </section>
      <section className="section section-tight">
        <div className="wrap">
          {promos.length ? (
            <PromoList promos={promos} />
          ) : (
            <p className="empty">ยังไม่มีโปรโมชันในช่วงนี้ — ดูสิทธิ์สมาชิกและรางวัลที่แลกได้ระหว่างนี้</p>
          )}
          <p className="promo-foot">
            <Link href="/rewards" className="text-link">สิทธิ์สมาชิกและรางวัล</Link>
            {shop && (
              <>
                {" · "}
                <a href={shop} className="text-link" target="_blank" rel="noopener">
                  ช้อปออนไลน์
                </a>
              </>
            )}
          </p>
        </div>
      </section>
    </>
  );
}
