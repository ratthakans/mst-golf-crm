"use client";

import { useState } from "react";
import type { SiteSettings } from "@mstgolf/shared";
import { SaveBar, useSave } from "../useSave";

export function SiteForm({ values }: { values: SiteSettings }) {
  const [f, setF] = useState({ siteUrl: values.siteUrl ?? "", shopUrl: values.shopUrl ?? "", lineOaUrl: values.lineOaUrl ?? "", mapsUrl: values.mapsUrl ?? "", facebookUrl: values.facebookUrl ?? "", instagramUrl: values.instagramUrl ?? "", phone: values.phone ?? "", address: values.address ?? "" });
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
        {field("shopUrl", "ร้านออนไลน์ (ลิงก์ \"ช้อปออนไลน์\" บนเว็บ)", "https://mstgolf.co.th")}
        {field("lineOaUrl", "ลิงก์เพิ่มเพื่อน LINE OA (แสดงเมื่อเปิดใช้ LINE)", "https://lin.ee/…")}
        {field("mapsUrl", "ลิงก์ Google Maps", "https://maps.app.goo.gl/…")}
        {field("phone", "เบอร์ร้าน", "02-xxx-xxxx")}
        {field("facebookUrl", "Facebook ของร้าน", "https://www.facebook.com/…")}
        {field("instagramUrl", "Instagram ของร้าน", "https://www.instagram.com/…")}
      </div>
      <label className="field"><span>ที่อยู่</span><textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} style={{ minHeight: 70 }} /></label>
      <SaveBar {...s} />
    </form>
  );
}

/** Website sign-in: with or without the SMS code. Off is for testing the flow only. */
export function LoginForm({ otp }: { otp: boolean }) {
  const [on, setOn] = useState(otp);
  const s = useSave("login");
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void s.save({ otp: on }); }}>
      <h3>การเข้าสู่ระบบของสมาชิกบนเว็บ</h3>
      <label className="toggle-row">
        <span>
          <b>ยืนยันเบอร์ด้วยรหัส SMS</b>
          <span>
            {on
              ? "ลูกค้าใส่เบอร์แล้วได้รหัส 6 หลักทาง SMS — ต้องมีบัญชีผู้ให้บริการ SMS"
              : "ปิดอยู่: ใส่เบอร์อย่างเดียวก็เข้าบัญชีได้ ใช้ทดสอบ flow เท่านั้น — ใครรู้เบอร์ก็เห็นบัตรและใช้แต้มได้ ต้องเปิดก่อนเปิดใช้จริง"}
          </span>
        </span>
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
      </label>
      <SaveBar {...s} />
    </form>
  );
}
