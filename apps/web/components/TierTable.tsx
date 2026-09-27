import type { TierSettings } from "@mstgolf/shared";
import { formatBahtWhole } from "@/lib/format";

// Tiers as a comparison sheet — every number comes from settings.tiers, which
// MST edits in the back office. A dash means the tier doesn't have that perk.
export function TierTable({ tiers, pointsPerBaht }: { tiers: TierSettings[]; pointsPerBaht: number }) {
  const pct = (v: number) => (v > 0 ? `${v}%` : "—");
  const rows: Array<{ label: string; cells: string[] }> = [
    { label: "ยอดซื้อ 12 เดือน", cells: tiers.map((t) => (t.minSpend12m === 0 ? "สมัครฟรี" : `${formatBahtWhole(t.minSpend12m)}+`)) },
    { label: "อัตราแต้ม", cells: tiers.map((t) => `×${t.pointRate}`) },
    { label: "ส่วนลดสินค้า", cells: tiers.map((t) => pct(t.benefits.discountPct)) },
    { label: "ส่วนลด Golf Simulator", cells: tiers.map((t) => pct(t.benefits.simDiscountPct)) },
    { label: "จองซิมล่วงหน้า", cells: tiers.map((t) => `${t.benefits.simBookingDaysAhead} วัน`) },
    { label: "แต้มเดือนเกิด", cells: tiers.map((t) => (t.benefits.birthdayPointMultiplier > 1 ? `×${t.benefits.birthdayPointMultiplier}` : "—")) },
  ];
  return (
    <div className="tier-sheet-wrap">
      <table className="tier-sheet">
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">สิทธิ์</span>
            </th>
            {tiers.map((t) => (
              <th key={t.key} scope="col" className={`ts-${t.key}`}>
                {t.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              {r.cells.map((c, i) => (
                <td key={tiers[i]!.key} className="mono">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tier-sheet-note">
        ฐานแต้ม ฿1 = <span className="mono">{pointsPerBaht}</span> แต้ม คูณอัตราของระดับ · ระดับคิดจากยอดซื้อสุทธิ 12 เดือนล่าสุด ไม่ใช่แต้มคงเหลือ
      </p>
    </div>
  );
}
