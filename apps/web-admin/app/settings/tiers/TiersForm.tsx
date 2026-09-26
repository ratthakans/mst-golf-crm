"use client";

import { useState } from "react";
import type { TierSettings } from "@mstgolf/shared";
import { SaveBar, useSave } from "../useSave";

export function TiersForm({ tiers }: { tiers: TierSettings[] }) {
  const [rows, setRows] = useState(tiers.map((t) => ({ ...t, isNew: false })));
  const { busy, error, ok, save } = useSave("tiers");
  const set = (i: number, patch: Partial<TierSettings>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setB = (i: number, patch: Partial<TierSettings["benefits"]>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, benefits: { ...x.benefits, ...patch } } : x)));
  const n = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save({ tiers: rows.map(({ isNew: _n, ...t }) => t) });
      }}
    >
      {rows.map((t, i) => (
        <div className="tier-edit" key={i}>
          <h4>
            <span>ระดับที่ {i + 1}{i === 0 ? " (เริ่มต้น)" : ""}</span>
            {i > 0 && rows.length > 1 && (
              <button type="button" className="link-btn danger-text" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>ลบระดับนี้</button>
            )}
          </h4>
          <div className="form-grid">
            <label className="field"><span>ชื่อที่ลูกค้าเห็น</span><input value={t.name} onChange={(e) => set(i, { name: e.target.value })} required /></label>
            <label className="field">
              <span>รหัส <span className="hint">— เปลี่ยนไม่ได้หลังสร้าง</span></span>
              <input value={t.key} onChange={(e) => set(i, { key: e.target.value.toLowerCase() })} disabled={!t.isNew} required />
            </label>
            <label className="field"><span>ยอดซื้อ 12 เดือนขั้นต่ำ (บาท)</span><input inputMode="numeric" value={t.minSpend12m} disabled={i === 0} onChange={(e) => set(i, { minSpend12m: n(e.target.value.replace(/\D/g, "")) })} /></label>
            <label className="field"><span>อัตราแต้ม (×)</span><input inputMode="decimal" value={t.pointRate} onChange={(e) => set(i, { pointRate: e.target.value as unknown as number })} /></label>
            <label className="field"><span>ส่วนลดร้าน (%)</span><input inputMode="numeric" value={t.benefits.discountPct} onChange={(e) => setB(i, { discountPct: n(e.target.value) })} /></label>
            <label className="field"><span>ส่วนลดซิม (%)</span><input inputMode="numeric" value={t.benefits.simDiscountPct} onChange={(e) => setB(i, { simDiscountPct: n(e.target.value) })} /></label>
            <label className="field"><span>แต้มเดือนเกิด (×)</span><input inputMode="decimal" value={t.benefits.birthdayPointMultiplier} onChange={(e) => setB(i, { birthdayPointMultiplier: e.target.value as unknown as number })} /></label>
            <label className="field"><span>จองซิมล่วงหน้า (วัน)</span><input inputMode="numeric" value={t.benefits.simBookingDaysAhead} onChange={(e) => setB(i, { simBookingDaysAhead: n(e.target.value) })} /></label>
          </div>
        </div>
      ))}
      {rows.length < 5 && (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() =>
            setRows((r) => [
              ...r,
              {
                key: "",
                name: "",
                minSpend12m: (r[r.length - 1]?.minSpend12m ?? 0) * 2 || 100_000,
                pointRate: 1,
                benefits: { discountPct: 0, birthdayPointMultiplier: 2, simDiscountPct: 0, simBookingDaysAhead: 14, exclusiveCampaigns: false },
                isNew: true,
              },
            ])
          }
        >
          + เพิ่มระดับ
        </button>
      )}
      <SaveBar busy={busy} error={error} ok={ok} />
    </form>
  );
}
