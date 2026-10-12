import type { Metadata } from "next";
import Link from "next/link";
import { publicRewards } from "@mstgolf/core";
import { earnRateText } from "@mstgolf/shared/tiers";
import { SheetHead } from "@/components/SheetHead";
import { TierTable } from "@/components/TierTable";
import { formatBaht, formatPoints } from "@/lib/format";
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
        crumb="สิทธิ์สมาชิก"
        fact={
          <>
            สมัครฟรี · {s.tiers.map((t) => t.name).join(" / ")}
            {rewards.length ? (
              <>
                {" "}
                · รางวัล <span className="mono">{rewards.length}</span> รายการ
              </>
            ) : null}
          </>
        }
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

      <section className="section section-tight" aria-labelledby="earn-h">
        <div className="wrap">
          <h2 id="earn-h" className="section-h">สะสมแต้ม</h2>
          <ol className="earn-steps">
            <li>
              <b>สมัครฟรี</b>
              <span>ใส่เบอร์มือถือ{s.features.otp ? " รับรหัสทาง SMS" : ""} ได้บัตรสมาชิกพร้อม QR ทันที และแต้มต้อนรับ {formatPoints(s.welcomeBonus)} แต้ม</span>
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
            <ul className="rw">
              {rewards.map((r) => (
                <li key={r.id} className={`rw-row${r.soldOut ? " sold-out" : ""}`}>
                  <span className="rw-tag" aria-hidden="true">
                    {r.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- catalogue images live in MST's public Blob store
                      <img src={r.imageUrl} alt="" loading="lazy" width={240} height={180} />
                    ) : (
                      <span className="rw-value">{r.kind === "COUPON" && r.valueSatang ? formatBaht(r.valueSatang) : "ของรางวัล"}</span>
                    )}
                  </span>
                  <span className="rw-main">
                    <b className="rw-name">{r.name}</b>
                    <span className="rw-meta">
                      {[
                        r.kind === "COUPON" ? (r.minSpendSatang ? `คูปองใช้ที่ร้าน เมื่อซื้อครบ ${formatBaht(r.minSpendSatang)}` : "คูปองใช้ที่ร้าน") : "ของรางวัล ร้านจัดส่งหรือรับที่ร้าน",
                        r.minTierName ? `${r.minTierName} ขึ้นไป` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="rw-cost">
                    <span>
                      <span className="mono">{formatPoints(r.costPoints)}</span> แต้ม
                    </span>
                    {r.soldOut && <span className="rw-out">หมดแล้ว</span>}
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

    </>
  );
}
