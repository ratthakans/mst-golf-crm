"use client";

import { useState } from "react";
import type { FieldDefinitionLike } from "@mstgolf/analytics";

interface Props {
  fields: FieldDefinitionLike[];
  consentText: string;
  signupBonus: number;
}

interface SuccessResult {
  displayName: string;
  tier: string;
  pointsAwarded: number;
  source: string;
}

export function SignupForm({ fields, consentText, signupBonus }: Props) {
  const [attributes, setAttributes] = useState<Record<string, unknown>>({});
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessResult | null>(null);

  function setAttr(key: string, value: unknown) {
    setAttributes((a) => ({ ...a, [key]: value }));
  }

  function toggleMulti(key: string, value: string) {
    setAttributes((a) => {
      const cur = Array.isArray(a[key]) ? (a[key] as string[]) : [];
      return {
        ...a,
        [key]: cur.includes(value)
          ? cur.filter((v) => v !== value)
          : [...cur, value],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, phone, email, attributes, consent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        setSuccess(data);
      }
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="join-card">
        <div className="join-success">
          <div className="check">✓</div>
          <h2>ยินดีต้อนรับสู่ MST Golf คุณ{success.displayName}!</h2>
          <p>
            สมัครสมาชิกสำเร็จ ได้รับ{" "}
            <strong>+{success.pointsAwarded} แต้ม</strong> เริ่มต้นที่ระดับ{" "}
            <strong>{success.tier}</strong>
          </p>
          <div className="src-note">บันทึกที่: {success.source === "database" ? "ฐานข้อมูล Postgres" : "ข้อมูลตัวอย่าง"}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "center" }}>
            <a className="btn" href="/members">ดูใน CRM →</a>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setSuccess(null);
                setAttributes({});
                setDisplayName(""); setPhone(""); setEmail(""); setConsent(false);
              }}
            >
              เพิ่มอีกคน
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="join-card" onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}

      <div className="field-group-label">ข้อมูลติดต่อ</div>
      <label className="field">
        <span>ชื่อ-นามสกุล <b>*</b></span>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="เช่น สมชาย ใจดี" />
      </label>
      <div className="field-row">
        <label className="field">
          <span>เบอร์โทร</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+66..." inputMode="tel" />
        </label>
        <label className="field">
          <span>อีเมล</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" type="email" />
        </label>
      </div>

      <div className="field-group-label">โปรไฟล์กอล์ฟ</div>
      {fields.map((f) => (
        <div className="field" key={f.key}>
          <span>
            {f.label} {f.required && <b>*</b>}
          </span>
          {f.type === "TEXT" && (
            <input
              value={(attributes[f.key] as string) ?? ""}
              onChange={(e) => setAttr(f.key, e.target.value)}
            />
          )}
          {f.type === "NUMBER" && (
            <input
              type="number"
              value={(attributes[f.key] as number | string) ?? ""}
              onChange={(e) => setAttr(f.key, e.target.value === "" ? "" : Number(e.target.value))}
            />
          )}
          {f.type === "DATE" && (
            <input type="date" value={(attributes[f.key] as string) ?? ""} onChange={(e) => setAttr(f.key, e.target.value)} />
          )}
          {f.type === "SELECT" && (
            <select
              value={(attributes[f.key] as string) ?? ""}
              onChange={(e) => setAttr(f.key, e.target.value)}
            >
              <option value="">เลือก…</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          {f.type === "BOOLEAN" && (
            <label className="checkline">
              <input
                type="checkbox"
                checked={Boolean(attributes[f.key])}
                onChange={(e) => setAttr(f.key, e.target.checked)}
              />
              ใช่
            </label>
          )}
          {f.type === "MULTISELECT" && (
            <div className="chips">
              {f.options.map((o) => {
                const arr = Array.isArray(attributes[f.key]) ? (attributes[f.key] as string[]) : [];
                const on = arr.includes(o.value);
                return (
                  <button
                    type="button"
                    key={o.value}
                    className={`chip${on ? " chip-on" : ""}`}
                    onClick={() => toggleMulti(f.key, o.value)}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <label className="consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>{consentText}</span>
      </label>

      <button className="btn btn-full" type="submit" disabled={submitting}>
        {submitting ? "กำลังสมัคร…" : `สมัครเลย รับ ${signupBonus.toLocaleString("en-TH")} แต้ม`}
      </button>
    </form>
  );
}
