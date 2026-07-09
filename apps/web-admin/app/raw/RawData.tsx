"use client";

import { useMemo, useState } from "react";

export interface RawRow {
  type: string;
  memberId: string;
  memberName: string;
  time: string;
  payload: string;
}
export interface TypeCount { type: string; count: number; }

const EVENT_LABEL: Record<string, string> = {
  REGISTER: "สมัครสมาชิก", PURCHASE: "ซื้อสินค้า", EARN_POINTS: "ได้แต้ม", REDEEM_POINTS: "แลกรางวัล",
  VISIT: "เข้าร้าน", SCAN_QR: "สแกน QR", OPEN_MENU: "เปิดเมนู", FITTING_BOOKING: "จองฟิตติ้ง",
  CLICK_PROMO: "กดโปรโมชัน", TIER_UP: "เลื่อนระดับ", PROFILE_UPDATE: "แก้โปรไฟล์", MESSAGE_RECEIVED: "รับข้อความ",
};
const num = (n: number) => n.toLocaleString("en-TH");

export function RawData({ rows, typeCounts, totalEvents }: { rows: RawRow[]; typeCounts: TypeCount[]; totalEvents: number }) {
  const [filter, setFilter] = useState<string | "all">("all");
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const term = q.trim();
    return rows.filter(
      (r) => (filter === "all" || r.type === filter) && (term === "" || r.memberName.includes(term) || r.memberId.includes(term)),
    ).slice(0, 200);
  }, [rows, filter, q]);

  return (
    <>
      <div className="page-head">
        <h1>ข้อมูลดิบ (Event Log)</h1>
        <p>
          ทุกพฤติกรรมลูกค้าถูกบันทึกเป็น Event ดิบที่นี่ — ยังไม่ปรุงแต่ง ทุกกราฟและ insight
          ในระบบคำนวณจากตารางนี้ (event-driven) รวมทั้งหมด {num(totalEvents)} events
        </p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        {typeCounts.slice(0, 4).map((t) => (
          <div className="card stat" key={t.type}>
            <div className="label">{EVENT_LABEL[t.type] ?? t.type}</div>
            <div className="value">{num(t.count)}</div>
            <div className="sub">{t.type}</div>
          </div>
        ))}
      </div>

      <div className="mt-controls">
        <input className="mt-search" placeholder="ค้นหาสมาชิก (ชื่อ/id)…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-segs">
          <button className={`mt-seg${filter === "all" ? " on" : ""}`} onClick={() => setFilter("all")}>ทั้งหมด</button>
          {typeCounts.map((t) => (
            <button key={t.type} className={`mt-seg${filter === t.type ? " on" : ""}`} onClick={() => setFilter(t.type)}>
              {EVENT_LABEL[t.type] ?? t.type} <span style={{ opacity: 0.6 }}>{num(t.count)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="raw-table">
            <thead>
              <tr>
                <th>ประเภท</th>
                <th>สมาชิก</th>
                <th>เวลา</th>
                <th>payload (ดิบ)</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i}>
                  <td><span className="raw-type">{r.type}</span></td>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{r.memberName}</td>
                  <td className="mono" style={{ whiteSpace: "nowrap", color: "var(--muted)" }}>{r.time}</td>
                  <td><code className="raw-json">{r.payload}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="muted-sub" style={{ marginTop: 12 }}>แสดง {num(shown.length)} event ล่าสุด (จากทั้งหมด {num(totalEvents)})</p>
    </>
  );
}
