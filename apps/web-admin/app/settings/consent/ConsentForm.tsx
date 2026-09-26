"use client";

import { useState } from "react";
import { SaveBar, useSave } from "../useSave";

export function ConsentForm({ purpose, title, body }: { purpose: "TERMS" | "MARKETING"; title: string; body: string }) {
  const [f, setF] = useState({ title, body });
  const s = useSave("consent");
  const changed = f.title !== title || f.body !== body;
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (changed) void s.save({ purpose, ...f }); }}>
      <label className="field"><span>หัวข้อ</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label className="field"><span>ข้อความ</span><textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} style={{ minHeight: 140 }} /></label>
      <SaveBar {...s} label={changed ? "ออกเวอร์ชันใหม่" : "ไม่มีการเปลี่ยนแปลง"} />
    </form>
  );
}
