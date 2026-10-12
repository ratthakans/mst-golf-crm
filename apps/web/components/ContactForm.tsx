"use client";

import { useState } from "react";
import { api } from "@/lib/client";

// Leave a message for the store. It goes to Marketing's email; we say "sent"
// only after the server has queued it.
export function ContactForm({ topics }: { topics: string[] }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", topic: topics[0] ?? "อื่น ๆ", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (f.name.trim().length < 2) return setError("กรุณากรอกชื่อ");
    if (!f.phone.trim() && !f.email.trim()) return setError("ใส่เบอร์โทรหรืออีเมลอย่างน้อยหนึ่งอย่าง เพื่อให้เราติดต่อกลับได้");
    if (f.message.trim().length < 5) return setError("กรุณาพิมพ์ข้อความ");
    setBusy(true);
    const res = await api("/api/contact", { method: "POST", body: f });
    setBusy(false);
    if (res.ok) setSent(true);
    else setError(res.error);
  };

  if (sent) {
    return (
      <div className="contact-form contact-sent" role="status">
        <h2>ได้รับข้อความแล้ว</h2>
        <p>ทีม MST Golf จะติดต่อกลับทาง{f.phone ? "โทรศัพท์" : "อีเมล"}ที่ให้ไว้</p>
      </div>
    );
  }

  return (
    <form className="contact-form form" onSubmit={submit} noValidate>
      <h2>ฝากข้อความ</h2>
      <div className="field">
        <label htmlFor="ct-name">ชื่อ</label>
        <input id="ct-name" className="input" value={f.name} onChange={set("name")} autoComplete="name" maxLength={80} />
      </div>
      <div className="contact-two">
        <div className="field">
          <label htmlFor="ct-phone">เบอร์โทร</label>
          <input id="ct-phone" className="input num" type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" maxLength={16} />
        </div>
        <div className="field">
          <label htmlFor="ct-email">อีเมล</label>
          <input id="ct-email" className="input" type="email" inputMode="email" value={f.email} onChange={set("email")} autoComplete="email" maxLength={160} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="ct-topic">เรื่อง</label>
        <select id="ct-topic" className="input" value={f.topic} onChange={set("topic")}>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="ct-msg">ข้อความ</label>
        <textarea id="ct-msg" className="input" rows={5} value={f.message} onChange={set("message")} maxLength={2000} />
      </div>
      {/* Hidden from people; bots fill it in. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor="ct-web">เว็บไซต์</label>
        <input id="ct-web" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} />
      </div>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy && <span className="spinner" aria-hidden="true" />}
        <span>{busy ? "กำลังส่ง…" : "ส่งข้อความ"}</span>
      </button>
      <p className="hint">ข้อมูลนี้ใช้ติดต่อกลับเรื่องที่สอบถามเท่านั้น ตาม<a href="/privacy">นโยบายความเป็นส่วนตัว</a></p>
    </form>
  );
}
