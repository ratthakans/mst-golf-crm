"use client";

import { useState } from "react";
import { SaveBar, useSave } from "../useSave";

// The earn rate is entered the way MST says it — "every ฿500 = 1 point" — and
// stored as points per baht (1 ÷ 500 = 0.002).
function toPair(perBaht: number): { baht: string; pts: string } {
  if (perBaht >= 1) return { baht: "1", pts: String(Number(perBaht.toFixed(4))) };
  return { baht: String(Number((1 / perBaht).toFixed(2))), pts: "1" };
}

export function PointsForm({ welcomeBonus, perBaht }: { welcomeBonus: number; perBaht: number }) {
  const [f, setF] = useState({ welcomeBonus: String(welcomeBonus), ...toPair(perBaht) });
  const s = useSave("points");
  const rate = Number(f.pts) / Number(f.baht);
  const ok = Number.isFinite(rate) && rate > 0;
  const example = ok ? Math.floor(2500 * rate + 1e-9) : 0;
  const welcomeBaht = ok ? Math.round(Number(f.welcomeBonus) / rate) : 0;
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void s.save({ welcomeBonus: f.welcomeBonus, perBaht: rate }); }}>
      <h3>แต้ม</h3>
      <div className="form-grid">
        <label className="field"><span>ยอดซื้อทุก (บาท)</span><input inputMode="decimal" value={f.baht} onChange={(e) => setF({ ...f, baht: e.target.value })} /></label>
        <label className="field"><span>ได้แต้มฐาน <span className="hint">— คูณอัตราของระดับอีกครั้ง</span></span><input inputMode="decimal" value={f.pts} onChange={(e) => setF({ ...f, pts: e.target.value })} /></label>
        <label className="field"><span>แต้มต้อนรับสมาชิกใหม่</span><input inputMode="numeric" value={f.welcomeBonus} onChange={(e) => setF({ ...f, welcomeBonus: e.target.value })} /></label>
      </div>
      {ok && (
        <p className="muted small">
          ตัวอย่าง: ซื้อ ฿2,500 ได้ {example.toLocaleString("en-US")} แต้ม (ระดับแรก) · คิดต่อบิล ปัดเศษลง · แต้มต้อนรับ {Number(f.welcomeBonus).toLocaleString("en-US")} แต้ม เท่ากับยอดซื้อ ฿{welcomeBaht.toLocaleString("en-US")}
          {welcomeBaht > 100_000 && <b className="danger-text"> — สูงมากเมื่อเทียบกับอัตราแต้ม ลองทบทวนแต้มต้อนรับ</b>}
        </p>
      )}
      <p className="muted small">เปลี่ยนแล้วมีผลกับบิลที่นำเข้าหลังจากนี้ ไม่ย้อนคิดบิลเก่า · ราคารางวัลในแคตตาล็อกควรปรับตามอัตราใหม่</p>
      <SaveBar {...s} />
    </form>
  );
}

export function PosForm({ memberTag, skus, categories }: { memberTag: string; skus: string[]; categories: string[] }) {
  const [f, setF] = useState({ memberTag, skus: skus.join("\n"), categories: categories.join("\n") });
  const s = useSave("pos");
  const lines = (v: string) => v.split(/\n|,/).map((x) => x.trim()).filter(Boolean);
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void s.save({ memberTag: f.memberTag, pointExcludedSkus: lines(f.skus), pointExcludedCategories: lines(f.categories) }); }}>
      <h3>การนำเข้า POS</h3>
      <label className="field">
        <span>คำนำหน้าในหมายเหตุบิล <span className="hint">— พนักงานพิมพ์ {f.memberTag || "MSTMEMBER"}:0891112233</span></span>
        <input value={f.memberTag} onChange={(e) => setF({ ...f, memberTag: e.target.value.toUpperCase() })} />
      </label>
      <div className="form-grid">
        <label className="field"><span>รหัสสินค้าที่ไม่ได้แต้ม <span className="hint">— บรรทัดละ 1 รหัส ลงท้าย * = ทุกรหัสที่ขึ้นต้นแบบนี้</span></span><textarea value={f.skus} onChange={(e) => setF({ ...f, skus: e.target.value })} placeholder={"GIFTCARD*\nSIM-HOUR"} /></label>
        <label className="field"><span>หมวดสินค้าที่ไม่ได้แต้ม <span className="hint">— ตามชื่อหมวดใน POS</span></span><textarea value={f.categories} onChange={(e) => setF({ ...f, categories: e.target.value })} placeholder={"บัตรของขวัญ\nค่าเรียน"} /></label>
      </div>
      <SaveBar {...s} />
    </form>
  );
}

const NOTIFICATIONS: Array<{ key: string; label: string; desc: string }> = [
  { key: "WELCOME", label: "ต้อนรับสมาชิกใหม่", desc: "หลังสมัครใน LINE หรือบนเว็บ" },
  { key: "POINTS", label: "ได้รับแต้ม", desc: "หลังนำเข้า POS — รวม 1 ข้อความต่อคนต่อรอบ ปิดได้ถ้าโควตาข้อความใกล้เต็ม" },
  { key: "TIER_UP", label: "เลื่อนระดับ", desc: "เมื่อยอด 12 เดือนถึงเกณฑ์" },
  { key: "BOOKING_CONFIRMED", label: "ยืนยันการจองซิม", desc: "ทันทีที่จองสำเร็จ" },
  { key: "BOOKING_REMINDER", label: "เตือนก่อนเวลาจอง", desc: "ตามชั่วโมงที่ตั้งในกติกาการจอง" },
  { key: "BOOKING_CANCELLED", label: "ยกเลิกการจอง", desc: "เมื่อลูกค้าหรือพนักงานยกเลิก" },
  { key: "BOOKING_MOVED", label: "ย้ายเวลาการจอง", desc: "เมื่อพนักงานย้ายเวลาหรือ lane" },
  { key: "REDEMPTION_RECEIVED", label: "ได้รับคูปอง / รับคำขอแลกรางวัล", desc: "ทันทีที่สมาชิกแลก — คูปองพร้อมรหัส หรือ Redemption ID ของคำขอ" },
  { key: "REDEMPTION_STATUS", label: "อัปเดตสถานะการแลกรางวัล", desc: "อนุมัติ จัดส่ง เสร็จสิ้น ไม่อนุมัติ (พร้อมคืนแต้ม) และเมื่อคูปองถูกใช้" },
];

export function NotificationsForm({ values }: { values: Record<string, boolean> }) {
  const [f, setF] = useState(values);
  const s = useSave("notifications");
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void s.save(f); }}>
      <h3>ข้อความ LINE ถึงลูกค้า</h3>
      <p className="muted small" style={{ marginTop: 0 }}>ทุกข้อความนับรวมในโควตาข้อความของ LINE OA</p>
      {NOTIFICATIONS.map((n) => (
        <label key={n.key} className="toggle-row">
          <span>
            <b>{n.label}</b>
            <span>{n.desc}</span>
          </span>
          <input type="checkbox" checked={!!f[n.key]} onChange={(e) => setF({ ...f, [n.key]: e.target.checked })} />
        </label>
      ))}
      <SaveBar {...s} />
    </form>
  );
}
