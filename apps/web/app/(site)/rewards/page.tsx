import type { Metadata } from "next";
import Link from "next/link";
import { publicRewards } from "@mstgolf/core";
import { earnRateText } from "@mstgolf/shared/tiers";
import { PromoList } from "@/components/PromoList";
import { TierTable } from "@/components/TierTable";
import { formatBaht, formatPoints } from "@/lib/format";
import { getOrg } from "@/lib/org";
import { currentPromotions } from "@/lib/posts";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "สิทธิ์สมาชิกและรางวัล",
  description: "สมัครสมาชิก MST Golf ฟรีด้วยเบอร์มือถือ สะสมแต้มทุกการซื้อทั้งที่ร้านและออนไลน์ ระดับ Member / Silver / Gold และรางวัลที่แลกได้",
  alternates: { canonical: "/rewards" },
  openGraph: { title: "สิทธิ์สมาชิกและรางวัล | MST Golf", url: "/rewards" },
};

// /rewards — the public explanation of the membership: how points are earned,
// what each tier gets, and the live rewards catalogue. Every number comes from
// settings or the catalogue in the back office.
export default async function RewardsInfoPage() {
  const org = await getOrg();
  const s = org.settings;
  const [rewards, promos] = await Promise.all([s.features.rewards ? publicRewards(org.id) : Promise.resolve([]), currentPromotions(6)]);
  const birthday = Math.max(...s.tiers.map((t) => t.benefits.birthdayPointMultiplier));

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <h1>สิทธิ์สมาชิกและรางวัล</h1>
          <p className="lede">สมัครฟรีด้วยเบอร์มือถือ สะสมแต้มทุกการซื้อ แล้วใช้แต้มแลกคูปองและของรางวัล</p>
          <div className="cta-row">
            <Link href="/register" className="btn btn-primary">
              สมัครสมาชิก รับ {formatPoints(s.welcomeBonus)} แต้ม
            </Link>
            <Link href="/app/rewards" className="btn btn-outline">
              ดูแต้มและแลกรางวัล
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-tight" aria-labelledby="earn-h">
        <div className="wrap">
          <h2 id="earn-h" className="section-h">สะสมแต้ม</h2>
          <ol className="earn-steps">
            <li>
              <b>สมัครฟรี</b>
              <span>ใส่เบอร์มือถือ รับรหัสทาง SMS ได้บัตรสมาชิกพร้อม QR ทันที และแต้มต้อนรับ {formatPoints(s.welcomeBonus)} แต้ม</span>
            </li>
            <li>
              <b>แจ้งเบอร์หรือแสดง QR ตอนจ่ายเงิน</b>
              <span>
                แต้มฐาน {earnRateText(s.pointsPerBaht)} (คิดต่อบิล) คูณอัตราตามระดับ
                {s.site.shopUrl ? " · ซื้อที่ร้านออนไลน์ก็ได้แต้มเหมือนกัน (หลังพ้นช่วงคืนสินค้า)" : ""}
              </span>
            </li>
            <li>
              <b>ใช้แต้ม</b>
              <span>แลกคูปองส่วนลดหรือของรางวัลในหน้าสมาชิก{birthday > 1 ? ` · เดือนเกิดรับแต้ม ×${birthday}` : ""}{s.birthdayBonus > 0 ? ` และโบนัสวันเกิด ${formatPoints(s.birthdayBonus)} แต้ม` : ""}</span>
            </li>
          </ol>
        </div>
      </section>

      <section className="section section-rule" aria-labelledby="tiers-h">
        <div className="wrap">
          <h2 id="tiers-h" className="section-h">ระดับสมาชิก</h2>
          <p className="section-lede">ระดับคิดจากยอดซื้อสุทธิ 12 เดือนล่าสุด ไม่ใช่แต้มคงเหลือ แลกรางวัลแล้วระดับไม่ลด</p>
          <TierTable tiers={s.tiers} pointsPerBaht={s.pointsPerBaht} />
        </div>
      </section>

      {rewards.length > 0 && (
        <section className="section section-rule" aria-labelledby="rewards-h">
          <div className="wrap">
            <h2 id="rewards-h" className="section-h">รางวัลที่แลกได้ตอนนี้</h2>
            <ul className="reward-grid">
              {rewards.map((r) => (
                <li key={r.id} className={`reward-card${r.soldOut ? " sold-out" : ""}`}>
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- catalogue images live in MST's public Blob store
                    <img src={r.imageUrl} alt="" loading="lazy" width={320} height={240} />
                  ) : (
                    <span className="reward-blank" aria-hidden="true">{r.kind === "COUPON" && r.valueSatang ? formatBaht(r.valueSatang) : "🎁"}</span>
                  )}
                  <b>{r.name}</b>
                  <span className="reward-cost mono">{formatPoints(r.costPoints)} แต้ม</span>
                  <span className="reward-meta">
                    {[
                      r.kind === "COUPON" ? (r.minSpendSatang ? `ใช้เมื่อซื้อครบ ${formatBaht(r.minSpendSatang)}` : "คูปองใช้ที่ร้าน") : "ของรางวัล",
                      r.minTierName ? `${r.minTierName} ขึ้นไป` : null,
                      r.soldOut ? "หมดแล้ว" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/app/rewards" className="text-link">
              แลกรางวัลในหน้าสมาชิก
            </Link>
          </div>
        </section>
      )}

      {promos.length > 0 && (
        <section className="section section-rule" aria-labelledby="promo-h">
          <div className="wrap">
            <div className="notes-head">
              <h2 id="promo-h" className="section-h">โปรโมชันตอนนี้</h2>
              <Link href="/promotions" className="text-link">
                ทั้งหมด
              </Link>
            </div>
            <PromoList promos={promos} />
          </div>
        </section>
      )}
    </>
  );
}
