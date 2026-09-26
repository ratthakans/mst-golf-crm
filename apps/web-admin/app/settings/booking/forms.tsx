"use client";

import { useState } from "react";
import type { BookingSettings } from "@mstgolf/shared";
import { SaveBar, useSave } from "../useSave";

export function BookingRulesForm({ values }: { values: BookingSettings }) {
  const [f, setF] = useState(values);
  const s = useSave("booking");
  const field = (k: keyof BookingSettings, label: string, hint?: string) => (
    <label className="field">
      <span>{label}{hint && <span className="hint"> — {hint}</span>}</span>
      <input inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value as unknown as number })} />
    </label>
  );
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void s.save(f); }}>
      <h3>กติกาการจอง</h3>
      <div className="form-grid">
        {field("holdMinutes", "ถือช่องระหว่างยืนยัน (นาที)")}
        {field("maxSlotsPerDay", "จองได้ต่อคนต่อวัน (ช่อง)")}
        {field("maxUpcoming", "การจองที่ยังไม่ถึงเวลาต่อคน")}
        {field("cancelHoursBefore", "ลูกค้ายกเลิกเองได้ก่อน (ชม.)")}
        {field("noShowGraceMinutes", "ไม่มาตามนัดหลังเริ่ม (นาที)")}
        {field("reminderHoursBefore", "เตือนใน LINE ก่อนเวลา (ชม.)")}
      </div>
      <SaveBar {...s} />
    </form>
  );
}

const DAYS: Array<[string, string]> = [["mon", "จันทร์"], ["tue", "อังคาร"], ["wed", "พุธ"], ["thu", "พฤหัสบดี"], ["fri", "ศุกร์"], ["sat", "เสาร์"], ["sun", "อาทิตย์"]];

export function StoreForm({ store }: { store: { id: string; code: string; name: string; address: string; openHours: Record<string, [string, string] | null> } | null }) {
  const [f, setF] = useState(store ?? { id: "", code: "CIT1", name: "", address: "", openHours: {} as Record<string, [string, string] | null> });
  const s = useSave("store");
  const setDay = (d: string, v: [string, string] | null) => setF({ ...f, openHours: { ...f.openHours, [d]: v } });
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void s.save({ ...f, id: f.id || null }); }}>
      <h3>สาขาและเวลาเปิด</h3>
      <div className="form-grid">
        <label className="field"><span>ชื่อสาขา</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
        <label className="field"><span>รหัสสาขา <span className="hint">— ใช้จับคู่กับไฟล์ POS</span></span><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} required /></label>
        <label className="field" style={{ gridColumn: "1 / -1" }}><span>ที่อยู่</span><input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
      </div>
      <table className="hours-table">
        <tbody>
          {DAYS.map(([d, label]) => {
            const v = f.openHours[d] ?? null;
            return (
              <tr key={d}>
                <td style={{ width: 110 }}>{label}</td>
                <td>
                  <label className="checkline"><input type="checkbox" checked={!!v} onChange={(e) => setDay(d, e.target.checked ? ["10:00", "22:00"] : null)} /> เปิด</label>
                </td>
                <td>
                  {v && (
                    <span className="row" style={{ gap: 6 }}>
                      <input type="time" step={3600} value={v[0]} onChange={(e) => setDay(d, [e.target.value, v[1]])} />
                      <span className="muted">–</span>
                      <input type="time" step={3600} value={v[1]} onChange={(e) => setDay(d, [v[0], e.target.value])} />
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <SaveBar {...s} />
    </form>
  );
}

interface LaneRow { id: string; name: string; capacity: number; hourlyPrice: string; sortOrder: number; isActive: boolean }

export function LanesForm({ storeId, lanes }: { storeId: string; lanes: LaneRow[] }) {
  const [rows, setRows] = useState<LaneRow[]>(lanes);
  const s = useSave("lane");
  const set = (i: number, patch: Partial<LaneRow>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="card">
      <h3>Lane ซิม</h3>
      <table className="tbl">
        <thead>
          <tr>
            <th>ชื่อ</th>
            <th>คนต่อ lane</th>
            <th>ราคา/ชม. (บาท)</th>
            <th>ลำดับ</th>
            <th>เปิดจอง</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((l, i) => (
            <tr key={l.id || i}>
              <td><input className="link-input" value={l.name} onChange={(e) => set(i, { name: e.target.value })} /></td>
              <td><input className="link-input" style={{ width: 70 }} inputMode="numeric" value={l.capacity} onChange={(e) => set(i, { capacity: Number(e.target.value) || 1 })} /></td>
              <td><input className="link-input" style={{ width: 110 }} inputMode="decimal" value={l.hourlyPrice} onChange={(e) => set(i, { hourlyPrice: e.target.value })} /></td>
              <td><input className="link-input" style={{ width: 60 }} inputMode="numeric" value={l.sortOrder} onChange={(e) => set(i, { sortOrder: Number(e.target.value) || 0 })} /></td>
              <td><input type="checkbox" checked={l.isActive} onChange={(e) => set(i, { isActive: e.target.checked })} /></td>
              <td>
                <button className="btn btn-ghost btn-sm" disabled={s.busy} onClick={() => s.save({ ...l, id: l.id || null, storeId })}>บันทึก</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {s.error && <p className="form-error">{s.error}</p>}
      {s.ok && <div className="form-ok" style={{ marginTop: 10 }}>บันทึกแล้ว</div>}
      <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => setRows((r) => [...r, { id: "", name: `Lane ${r.length + 1}`, capacity: 3, hourlyPrice: "1000", sortOrder: r.length + 1, isActive: true }])}>
        + เพิ่ม lane
      </button>
      <p className="muted small">ราคาเปลี่ยนแล้วมีผลกับการจองใหม่ · ปิดจองแล้วการจองเดิมยังอยู่</p>
    </div>
  );
}
