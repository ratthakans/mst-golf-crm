import type { Metadata } from "next";
import Link from "next/link";
import { publicRewards } from "@mstgolf/core";
import { earnRateText } from "@mstgolf/shared/tiers";
import { IconGift } from "@/components/icons";
import { SectionHead } from "@/components/SectionHead";
import { SheetHead } from "@/components/SheetHead";
import { TierTable } from "@/components/TierTable";
import { formatBaht, formatBahtWhole, formatPoints } from "@/lib/format";
import { tierClass } from "@/components/TierCards";
import { getOrg } from "@/lib/org";

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
  const rewards = s.features.rewards ? await publicRewards(org.id) : [];
  const birthday = Math.max(...s.tiers.map((t) => t.benefits.birthdayPointMultiplier));

  return (
    <>
      <SheetHead
        label="Membership"
        title="สิทธิ์สมาชิกและรางวัล"
        lede="สมัครฟรีด้วยเบอร์มือถือ สะสมแต้มทุกการซื้อ แล้วใช้แต้มแลกคูปองและของรางวัล"
        actions={
          <>
            <Link href="/register" className="btn btn-primary">
              สมัครสมาชิก รับ {formatPoints(s.welcomeBonus)} แต้ม
            </Link>
            <Link href="/app/rewards" className="text-link">
              ดูแต้มและแลกรางวัล
            </Link>
          </>
        }
      />

      <section className="q-sec q-sec-first" aria-labelledby="earn-h">
        <div className="wrap">
          <SectionHead id="earn-h" label="How it works" title="สะสมแต้ม 3 ขั้น" />
          <ol className="earn-steps">
            <li>
              <b>สมัครฟรี</b>
              <span>ใช้เบอร์มือถือ ได้บัตร QR และ {formatPoints(s.welcomeBonus)} แต้มทันที</span>
            </li>
            <li>
              <b>แจ้งเบอร์หรือแสดง QR ตอนจ่ายเงิน</b>
              <span>
                แต้มฐาน {earnRateText(s.pointsPerBaht)} คูณอัตราตามระดับ{s.site.shopUrl ? " · ซื้อออนไลน์ก็ได้แต้ม" : ""}
              </span>
            </li>
            <li>
              <b>ใช้แต้ม</b>
              <span>แลกคูปองหรือของรางวัลในหน้าสมาชิก{birthday > 1 ? ` · เดือนเกิดแต้ม ×${birthday}` : ""}</span>
            </li>
          </ol>
        </div>
      </section>

      <section className="q-sec" aria-labelledby="tiers-h">
        <div className="wrap">
          <SectionHead id="tiers-h" label="Tiers" title="ระดับสมาชิก" lede="ระดับคิดจากยอดซื้อสุทธิ 12 เดือนล่าสุด ไม่ใช่แต้มคงเหลือ แลกรางวัลแล้วระดับไม่ลด" />
          {/* one card per tier: the perk that matters large, the rest as short lines */}
          <ul className="sm-prices rw-tiers">
            {s.tiers.map((t) => {
              const entry = t.minSpend12m === 0;
              const perks = [
                `แต้ม ×${t.pointRate} ทุกการซื้อ`,
                t.benefits.simDiscountPct ? `ซิมกอล์ฟลด ${t.benefits.simDiscountPct}%` : null,
                `จองซิมล่วงหน้า ${t.benefits.simBookingDaysAhead} วัน`,
                t.benefits.birthdayPointMultiplier > 1 ? `เดือนเกิดแต้ม ×${t.benefits.birthdayPointMultiplier}` : null,
              ].filter(Boolean) as string[];
              return (
                <li key={t.key} className={`sm-price tier-${tierClass(t.key)}`}>
                  <span className="n-tier-name" lang="en">
                    {t.name}
                  </span>
                  <span className="sm-price-big mono">{entry ? formatPoints(s.welcomeBonus) : `${t.benefits.discountPct}%`}</span>
                  <span className="sm-price-what">{entry ? "แต้มต้อนรับเมื่อสมัคร" : "ส่วนลดสินค้าในร้าน"}</span>
                  <ul className="rw-perks">
                    {perks.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <span className="rw-min">{entry ? "สมัครฟรี" : `ยอดซื้อ ${formatBahtWhole(t.minSpend12m)}+ ใน 12 เดือน`}</span>
                </li>
              );
            })}
          </ul>
          <details className="rw-compare">
            <summary>เทียบสิทธิ์ทุกระดับในตาราง</summary>
            <TierTable tiers={s.tiers} pointsPerBaht={s.pointsPerBaht} />
          </details>
        </div>
      </section>

      {rewards.length > 0 && (
        <section className="q-sec" aria-labelledby="rewards-h">
          <div className="wrap">
            <SectionHead id="rewards-h" label="Rewards" title="รางวัลที่แลกได้ตอนนี้" link={{ href: "/app/rewards", text: "แลกในหน้าสมาชิก" }} />
            <ul className="rl">
              {rewards.map((r) => (
                <li key={r.id} className={`rl-row${r.soldOut ? " sold-out" : ""}`}>
                  <span className={`rl-tag${r.imageUrl ? "" : r.kind === "COUPON" ? " rl-coupon" : " rl-gift"}`} aria-hidden="true">
                    {r.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- catalogue images live in MST's public Blob store
                      <img src={r.imageUrl} alt="" loading="lazy" width={240} height={180} />
                    ) : r.kind === "COUPON" ? (
                      <span className="rl-value">
                        <span className="rl-kind" lang="en">
                          COUPON
                        </span>
                        {r.valueSatang ? formatBaht(r.valueSatang) : "คูปอง"}
                      </span>
                    ) : (
                      <IconGift />
                    )}
                  </span>
                  <span className="rl-main">
                    <b className="rl-name">{r.name}</b>
                    <span className="rl-meta">
                      {[
                        r.kind === "COUPON" ? (r.minSpendSatang ? `คูปองใช้ที่ร้าน เมื่อซื้อครบ ${formatBaht(r.minSpendSatang)}` : "คูปองใช้ที่ร้าน") : "ของรางวัล ร้านจัดส่งหรือรับที่ร้าน",
                        r.minTierName ? `${r.minTierName} ขึ้นไป` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="rl-cost">
                    <span>
                      <span className="mono">{formatPoints(r.costPoints)}</span> แต้ม
                    </span>
                    {r.soldOut && <span className="rl-out">หมดแล้ว</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

    </>
  );
}
