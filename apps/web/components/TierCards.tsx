import type { TierSettings } from "@mstgolf/shared";
import { formatBahtWhole } from "@/lib/format";

// Membership tiers straight from settings.tiers — thresholds and benefits are
// MST's to change in the back office, so nothing here is hard-coded.
export function TierCards({ tiers }: { tiers: TierSettings[] }) {
  return (
    <ol className="tier-cards">
      {tiers.map((t) => {
        const b = t.benefits;
        const perks = [
          t.pointRate !== 1 ? `แต้ม ×${t.pointRate} ทุกการซื้อ` : "สะสมแต้มทุกการซื้อ",
          b.discountPct > 0 ? `ส่วนลดสินค้า ${b.discountPct}%` : null,
          b.simDiscountPct > 0 ? `ส่วนลด Golf Simulator ${b.simDiscountPct}%` : null,
          `จองซิมล่วงหน้าได้ ${b.simBookingDaysAhead} วัน`,
          b.birthdayPointMultiplier > 1 ? `แต้ม ×${b.birthdayPointMultiplier} ในเดือนเกิด` : null,
          b.exclusiveCampaigns ? "สิทธิ์กิจกรรมเฉพาะระดับนี้" : null,
        ].filter((p): p is string => !!p);
        return (
          <li key={t.key} className={`tier-card tier-${tierClass(t.key)}`}>
            <div className="tier-card-head">
              <h3>{t.name}</h3>
              <p className="tier-threshold">
                {t.minSpend12m === 0 ? "สมัครฟรี" : <>ยอดซื้อ 12 เดือน <span className="num">{formatBahtWhole(t.minSpend12m)}</span> ขึ้นไป</>}
              </p>
            </div>
            <ul className="tier-perks">
              {perks.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

export function tierClass(key: string): "member" | "silver" | "gold" {
  return key === "gold" ? "gold" : key === "silver" ? "silver" : "member";
}
