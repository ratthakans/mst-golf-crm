"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RfmSegment } from "@mstgolf/analytics";
import { SEGMENT_COLOR, SEGMENT_LABEL, SEGMENT_ORDER } from "../../lib/segments";

export interface MemberRow {
  id: string;
  name: string;
  tier: string;
  seg: RfmSegment;
  points: number;
  spend: number;
  clv: number;
  churnPct: number;
  churnStatus: string;
  recency: number;
}

const cur = (n: number) => `฿${Math.round(n).toLocaleString("en-TH")}`;
const num = (n: number) => n.toLocaleString("en-TH");
const LIMIT = 80;

export function MembersTable({ rows }: { rows: MemberRow[] }) {
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState<RfmSegment | "all">("all");

  const filtered = useMemo(() => {
    const term = q.trim();
    return rows.filter(
      (r) =>
        (seg === "all" || r.seg === seg) &&
        (term === "" || r.name.includes(term)),
    );
  }, [rows, q, seg]);

  const shown = filtered.slice(0, LIMIT);

  return (
    <>
      <div className="mt-controls">
        <input
          className="mt-search"
          placeholder="ค้นหาชื่อสมาชิก…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="mt-segs">
          <button className={`mt-seg${seg === "all" ? " on" : ""}`} onClick={() => setSeg("all")}>
            ทั้งหมด
          </button>
          {SEGMENT_ORDER.map((s) => (
            <button
              key={s}
              className={`mt-seg${seg === s ? " on" : ""}`}
              onClick={() => setSeg(s)}
              style={seg === s ? { background: SEGMENT_COLOR[s], color: "#fff", borderColor: SEGMENT_COLOR[s] } : undefined}
            >
              {SEGMENT_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>สมาชิก</th>
                <th>ระดับ</th>
                <th>กลุ่ม</th>
                <th className="mono">แต้ม</th>
                <th className="mono">ยอดซื้อ</th>
                <th className="mono">CLV</th>
                <th className="mono">เสี่ยงหลุด</th>
                <th className="mono">เข้าล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td className="member-name">
                    <Link href={`/members/${r.id}`} className="member-link">{r.name}</Link>
                  </td>
                  <td><span className={`badge tier-${r.tier}`}>{r.tier}</span></td>
                  <td>
                    <span className="badge seg-badge" style={{ background: SEGMENT_COLOR[r.seg] }}>
                      {SEGMENT_LABEL[r.seg]}
                    </span>
                  </td>
                  <td className="mono">{num(r.points)}</td>
                  <td className="mono">{cur(r.spend)}</td>
                  <td className="mono">{cur(r.clv)}</td>
                  <td className="mono">
                    <span className={`churn-pill churn-${r.churnStatus}`}>{r.churnPct}%</span>
                  </td>
                  <td className="mono">{r.recency} วัน</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="muted-sub" style={{ marginTop: 12 }}>
        แสดง {num(shown.length)} จาก {num(filtered.length)} คน (เรียงตาม CLV สูงสุด)
      </p>
    </>
  );
}
