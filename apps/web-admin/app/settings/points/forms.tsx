"use client";

import { useState } from "react";
import { SaveBar, useSave } from "../useSave";

export function PointsForm({ welcomeBonus, perBaht }: { welcomeBonus: number; perBaht: number }) {
  const [f, setF] = useState({ welcomeBonus: String(welcomeBonus), perBaht: String(perBaht) });
  const s = useSave("points");
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void s.save(f); }}>
      <h3>แต้ม</h3>
      <div className="form-grid">
        <label className="field"><span>แต้มต้อนรับสมาชิกใหม่</span><input inputMode="numeric" value={f.welcomeBonus} onChange={(e) => setF({ ...f, welcomeBonus: e.target.value })} /></label>
        <label className="field"><span>แต้มฐานต่อ 1 บาท <span className="hint">— คูณอัตราของระดับอีกครั้ง</span></span><input inputMode="decimal" value={f.perBaht} onChange={(e) => setF({ ...f, perBaht: e.target.value })} /></label>
      </div>
      <p className="muted small">เปลี่ยนแล้วมีผลกับบิลที่นำเข้าหลังจากนี้ ไม่ย้อนคิดบิลเก่า</p>
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
