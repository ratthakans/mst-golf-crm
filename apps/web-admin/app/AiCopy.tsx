"use client";

import { useState } from "react";

const TONES: Array<{ id: string; label: string }> = [
  { id: "formal", label: "ทางการ" },
  { id: "friendly", label: "เป็นกันเอง" },
  { id: "playful", label: "สนุก" },
];

interface Props {
  audience: string;
  signal: string;
  offer: string;
  kind: "bulk" | "personal";
}

export function AiCopy({ audience, signal, offer, kind }: Props) {
  const [tone, setTone] = useState("friendly");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    setNotConfigured(false);
    try {
      const res = await fetch("/api/ai/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, signal, offer, tone, kind }),
      });
      const data = await res.json();
      if (data.configured === false) {
        setNotConfigured(true);
      } else if (data.error) {
        setError(data.error);
      } else {
        setText(data.text);
      }
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ai-box">
      <div className="ai-head">
        <span className="ai-tag">✨ ปรับข้อความด้วย AI</span>
        <div className="ai-tones">
          {TONES.map((t) => (
            <button
              key={t.id}
              className={`ai-tone${tone === t.id ? " on" : ""}`}
              onClick={() => setTone(t.id)}
            >
              {t.label}
            </button>
          ))}
          <button className="btn ai-gen" onClick={generate} disabled={busy}>
            {busy ? "กำลังสร้าง…" : text ? "สร้างใหม่" : "สร้างข้อความ"}
          </button>
        </div>
      </div>
      {notConfigured && (
        <div className="ai-note">
          ยังไม่ได้เปิดใช้ AI — ตั้งค่า <code>ANTHROPIC_API_KEY</code> ใน .env แล้วรีสตาร์ท เพื่อให้ Claude เขียนข้อความให้อัตโนมัติ
        </div>
      )}
      {error && <div className="ai-note ai-err">{error}</div>}
      {text && <div className="msg-bubble ai-result">{text}</div>}
    </div>
  );
}
