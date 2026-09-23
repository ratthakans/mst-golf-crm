"use client";

import { useState } from "react";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }
      // Full navigation so the server layout picks up the new session.
      window.location.assign(data.next ?? "/");
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="join-card" onSubmit={submit}>
      {error && <div className="form-error" role="alert">{error}</div>}
      <label className="field">
        <span>อีเมล</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
      </label>
      <label className="field">
        <span>รหัสผ่าน</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      <button className="btn btn-full" type="submit" disabled={busy}>
        {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
      <p className="login-foot">ลืมรหัสผ่าน? ให้ผู้ดูแลระบบตั้งรหัสชั่วคราวให้ในหน้า "ผู้ใช้และสิทธิ์"</p>
    </form>
  );
}
