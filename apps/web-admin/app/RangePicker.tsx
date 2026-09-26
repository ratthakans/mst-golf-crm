"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface RangePreset {
  label: string;
  from: string;
  to: string;
}

// Dashboard period: presets or a custom range, kept in the URL (?from=&to=).
export function RangePicker({ from, to, presets }: { from: string; to: string; presets: RangePreset[] }) {
  const router = useRouter();
  const [custom, setCustom] = useState({ from, to });
  const go = (f: string, t: string) => router.push(`/?from=${f}&to=${t}`);
  return (
    <div className="range-picker">
      {presets.map((p) => (
        <button key={p.label} type="button" className={`chip${p.from === from && p.to === to ? " chip-on" : ""}`} onClick={() => go(p.from, p.to)}>
          {p.label}
        </button>
      ))}
      <span className="row" style={{ gap: 6 }}>
        <input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} aria-label="ตั้งแต่" className="date-input" />
        <span className="muted">–</span>
        <input type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value })} aria-label="ถึง" className="date-input" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => custom.from && custom.to && go(custom.from, custom.to)}>
          ดู
        </button>
      </span>
    </div>
  );
}
