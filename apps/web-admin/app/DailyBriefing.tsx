"use client";

import { useState } from "react";

export function DailyBriefing() {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    setNotConfigured(false);
    try {
      const res = await fetch("/api/ai/briefing", { method: "POST" });
      const data = await res.json();
      if (data.configured === false) setNotConfigured(true);
      else if (data.error) setError(data.error);
      else setText(data.text);
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card briefing">
      <div className="briefing-head">
        <div>
          <h3 style={{ margin: 0 }}>✨ บรีฟประจำวัน (AI)</h3>
          <p className="muted-sub" style={{ margin: "4px 0 0" }}>
            ให้ Claude สรุปว่าวันนี้ต้องโฟกัสอะไร จากข้อมูล CRM ล่าสุด
          </p>
        </div>
        <button className="btn" onClick={generate} disabled={busy}>
          {busy ? "กำลังสรุป…" : text ? "สรุปใหม่" : "สร้างบรีฟ"}
        </button>
      </div>
      {notConfigured && (
        <div className="ai-note">
          ยังไม่ได้เปิดใช้ AI — ตั้งค่า <code>ANTHROPIC_API_KEY</code> ใน .env แล้วรีสตาร์ท เพื่อให้ Claude สรุปให้อัตโนมัติ
        </div>
      )}
      {error && <div className="ai-note ai-err">{error}</div>}
      {text && <div className="briefing-text">{text}</div>}
    </div>
  );
}
