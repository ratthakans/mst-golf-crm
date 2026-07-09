"use client";

import { useMemo, useState } from "react";

interface Props {
  orgName: string;
  currency: string;
  totalMembers: number;
  atRiskCount: number;
  moneyAtRisk: number;
  avgAnnualValue: number;
  projectedAnnual: number;
  churnDays: number;
}

interface Package {
  key: string; label: string; scope: string; setup: number; monthly: number; recommended?: boolean;
}
const PACKAGES: Package[] = [
  { key: "starter", label: "Starter", scope: "M0–M1", setup: 80000, monthly: 3900 },
  { key: "growth", label: "Growth", scope: "M0–M3", setup: 180000, monthly: 8900, recommended: true },
  { key: "pro", label: "Pro", scope: "M0–M4", setup: 350000, monthly: 19900 },
];

const RECOVERY_RATES = [0.05, 0.1, 0.15];

const fmt = (n: number) =>
  "฿" + new Intl.NumberFormat("en-TH", { maximumFractionDigits: 0 }).format(Math.round(n));

export function QuoteView({
  orgName,
  totalMembers,
  atRiskCount,
  moneyAtRisk,
  avgAnnualValue,
  projectedAnnual,
  churnDays,
}: Props) {
  const [pkgKey, setPkgKey] = useState<string>("growth");
  const [rate, setRate] = useState(0.1);

  const pkg = PACKAGES.find((p) => p.key === pkgKey)!;

  const roi = useMemo(() => {
    const recoveredYear = moneyAtRisk * rate; // annual revenue won back
    const recoveredMonth = recoveredYear / 12;
    const annualCost = pkg.setup + pkg.monthly * 12;
    const monthlyNet = recoveredMonth - pkg.monthly;
    const paybackMonths = monthlyNet > 0 ? pkg.setup / monthlyNet : null;
    const year1Roi = annualCost > 0 ? (recoveredYear - annualCost) / annualCost : 0;
    return { recoveredYear, recoveredMonth, annualCost, monthlyNet, paybackMonths, year1Roi };
  }, [moneyAtRisk, rate, pkg]);

  const today = new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date());

  return (
    <div className="quote">
      {/* Toolbar (hidden when printing) */}
      <div className="quote-toolbar no-print">
        <div className="qt-left">
          <span className="qt-label">แพ็กเกจ</span>
          {PACKAGES.map((p) => (
            <button
              key={p.key}
              className={`qt-pill${pkgKey === p.key ? " on" : ""}`}
              onClick={() => setPkgKey(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="qt-left">
          <span className="qt-label">กู้กลับ</span>
          {RECOVERY_RATES.map((r) => (
            <button key={r} className={`qt-pill${rate === r ? " on" : ""}`} onClick={() => setRate(r)}>
              {Math.round(r * 100)}%
            </button>
          ))}
        </div>
        <button className="btn" onClick={() => window.print()}>🖨️ พิมพ์ / บันทึก PDF</button>
      </div>

      {/* The document */}
      <div className="paper">
        <div className="paper-head">
          <div>
            <div className="paper-brand">[ชื่อบริษัทผู้เสนอ]</div>
            <div className="paper-sub">ระบบ CRM สมาชิกผ่าน LINE</div>
          </div>
          <div className="paper-meta">
            <div><b>ใบเสนอราคา</b></div>
            <div>เลขที่ QT-{new Date().getFullYear()}-001</div>
            <div>วันที่ {today}</div>
            <div>ยืนราคา 30 วัน</div>
          </div>
        </div>

        <div className="paper-to">
          <span className="paper-k">เสนอต่อ</span>
          <b>{orgName}</b> — บริษัท เอ็มเอสที กอล์ฟ จำกัด
        </div>

        {/* ROI hero — real data */}
        <div className="roi-hero">
          <div className="roi-title">💡 มูลค่าที่ระบบช่วยกู้กลับได้ (จากข้อมูลจริงของคุณ)</div>
          <div className="roi-grid">
            <div className="roi-cell">
              <div className="roi-num warn">{atRiskCount.toLocaleString("en-TH")}</div>
              <div className="roi-cap">ลูกค้าเสี่ยงหลุด (เงียบเกิน {churnDays} วัน)</div>
            </div>
            <div className="roi-cell">
              <div className="roi-num">{fmt(moneyAtRisk)}</div>
              <div className="roi-cap">รายได้ 12 เดือนที่กำลังจะหลุดไป</div>
            </div>
            <div className="roi-cell">
              <div className="roi-num accent">{fmt(roi.recoveredYear)}</div>
              <div className="roi-cap">กู้กลับได้ ถ้าดึงกลับ {Math.round(rate * 100)}% ({fmt(roi.recoveredMonth)}/เดือน)</div>
            </div>
            <div className="roi-cell">
              <div className="roi-num accent">
                {roi.paybackMonths != null ? `${roi.paybackMonths.toFixed(1)} เดือน` : "—"}
              </div>
              <div className="roi-cap">คืนทุนค่าระบบ (แพ็กเกจ {pkg.label})</div>
            </div>
          </div>
          <div className="roi-foot">
            ฐานสมาชิก {totalMembers.toLocaleString("en-TH")} ราย · มูลค่าคาดการณ์ทั้งฐาน {fmt(projectedAnnual)}/ปี ·
            สมมติกู้กลับเพียง {Math.round(rate * 100)}% ของลูกค้าเสี่ยงหลุด ระบบก็คืนทุนภายใน{" "}
            <b>{roi.paybackMonths != null ? `${roi.paybackMonths.toFixed(1)} เดือน` : "ไม่ถึงปี"}</b> — หลังจากนั้นเป็นกำไรล้วน
          </div>
        </div>

        {/* Packages */}
        <h3 className="paper-h3">แพ็กเกจ &amp; ราคา</h3>
        <table className="paper-tbl">
          <thead>
            <tr><th>แพ็กเกจ</th><th>ขอบเขต</th><th className="num">ค่าติดตั้ง (ครั้งเดียว)</th><th className="num">ค่าบริการ/เดือน</th></tr>
          </thead>
          <tbody>
            {PACKAGES.map((p) => (
              <tr key={p.key} className={p.key === pkgKey ? "sel" : ""}>
                <td>
                  <b>{p.label}</b>
                  {p.recommended && <span className="rec-tag">แนะนำ</span>}
                </td>
                <td className="dim">{p.scope}</td>
                <td className="num">{fmt(p.setup)}</td>
                <td className="num">{fmt(p.monthly)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="paper-note">ราคายังไม่รวม VAT 7% · จ่ายรายปีลด 10% · ไม่รวมค่า LINE OA / ค่าข้อความ (ลูกค้ารับผิดชอบ)</div>

        {/* Scope */}
        <h3 className="paper-h3">ขอบเขตงาน (แพ็กเกจ {pkg.label})</h3>
        <table className="paper-tbl">
          <tbody>
            <tr><td><b>M0 ฐานระบบ</b></td><td className="dim">Multi-tenant, ฐานสมาชิก, ฟิลด์ยืดหยุ่น, ระบบแต้ม (ledger), PDPA consent</td></tr>
            <tr><td><b>M1 LINE + สมัคร</b></td><td className="dim">LINE OA, LIFF signup, Rich Menu, ต้อนรับ, สะสม/แลกแต้ม</td></tr>
            {(pkg.key === "growth" || pkg.key === "pro") && (
              <>
                <tr><td><b>M2 Segment + Broadcast</b></td><td className="dim">จัดกลุ่มลูกค้า, ยิงแคมเปญ, แดชบอร์ด</td></tr>
                <tr><td><b>M3 Analytics + Automation</b></td><td className="dim">RFM/CLV/churn, Playbook, สัญญาณการเคลื่อนไหว, ระบบอัตโนมัติ</td></tr>
              </>
            )}
            {pkg.key === "pro" && (
              <tr><td><b>M4 SaaS / Onboarding</b></td><td className="dim">ตั้งค่า LINE ต่อสาขา, สิทธิ์ผู้ใช้, บิลลิ่ง, security (RLS)</td></tr>
            )}
          </tbody>
        </table>

        <div className="paper-terms">
          <b>เงื่อนไข:</b> มัดจำ 50% เริ่มงาน · 50% ส่งมอบ · รับประกัน 30 วัน · ค่าบริการรายเดือนชำระล่วงหน้า ·
          ลูกค้าเป็น Data Controller ตาม PDPA
        </div>

        <div className="paper-sign">
          <div>
            <div className="sign-line" />
            ผู้เสนอราคา
          </div>
          <div>
            <div className="sign-line" />
            ผู้อนุมัติ ({orgName})
          </div>
        </div>
      </div>
    </div>
  );
}
