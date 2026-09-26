"use client";

import { useState } from "react";
import type { SiteSettings } from "@mstgolf/shared";
import { SaveBar, useSave } from "../useSave";

export function SiteForm({ values }: { values: SiteSettings }) {
  const [f, setF] = useState({ siteUrl: values.siteUrl ?? "", lineOaUrl: values.lineOaUrl ?? "", mapsUrl: values.mapsUrl ?? "", phone: values.phone ?? "", address: values.address ?? "" });
  const s = useSave("site");
  const field = (k: keyof typeof f, label: string, placeholder?: string) => (
    <label className="field">
      <span>{label}</span>
      <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={placeholder} />
    </label>
  );
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void s.save(f); }}>
      <div className="form-grid">
        {field("siteUrl", "โดเมนเว็บไซต์", "https://www.mstgolf.co.th")}
        {field("lineOaUrl", "ลิงก์เพิ่มเพื่อน LINE OA", "https://lin.ee/…")}
        {field("mapsUrl", "ลิงก์ Google Maps", "https://maps.app.goo.gl/…")}
        {field("phone", "เบอร์ร้าน", "02-xxx-xxxx")}
      </div>
      <label className="field"><span>ที่อยู่</span><textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} style={{ minHeight: 70 }} /></label>
      <SaveBar {...s} />
    </form>
  );
}
