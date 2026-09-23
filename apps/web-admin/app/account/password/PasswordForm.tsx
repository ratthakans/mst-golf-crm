"use client";

import { useState } from "react";

export function PasswordForm({ forced }: { forced: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("รหัสผ่านใหม่สองช่องไม่ตรงกัน");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ");
        return;
      }
      setDone(true);
      if (forced) window.location.assign("/");
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  if (done && !forced) {
    return <div className="join-card"><div className="join-success"><div className="check">✓</div><h2>เปลี่ยนรหัสผ่านแล้ว</h2></div></div>;
  }

  return (
    <form className="join-card" onSubmit={submit}>
      {error && <div className="form-error" role="alert">{error}</div>}
      <label className="field">
        <span>{forced ? "รหัสผ่านชั่วคราว" : "รหัสผ่านปัจจุบัน"}</span>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </label>
      <label className="field">
        <span>รหัสผ่านใหม่ (อย่างน้อย 10 ตัวอักษร)</span>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={10} required />
      </label>
      <label className="field">
        <span>ยืนยันรหัสผ่านใหม่</span>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={10} required />
      </label>
      <button className="btn btn-full" type="submit" disabled={busy}>
        {busy ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
      </button>
    </form>
  );
}
