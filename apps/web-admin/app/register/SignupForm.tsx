"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FieldDefinitionLike } from "@mstgolf/analytics";
import { resizeToSquareJpeg } from "../../lib/resize-image";

// One form, two doors: customers open it from the public sign-up link
// (mode "public"), staff open it from Members → เพิ่มสมาชิก (mode "admin").
// Both write the same member + REGISTER event + welcome points + consent.

interface Props {
  mode: "public" | "admin";
  orgName: string;
  fields: FieldDefinitionLike[];
  consentText: string;
  signupBonus: number;
}

interface SuccessResult {
  memberId: string;
  displayName: string;
  tier: string;
  pointsAwarded: number;
}

export function SignupForm({ mode, orgName, fields, consentText, signupBonus }: Props) {
  const admin = mode === "admin";
  const router = useRouter();
  const photoInput = useRef<HTMLInputElement>(null);
  const [attributes, setAttributes] = useState<Record<string, unknown>>({});
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
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

  async function pickPhoto(file: File) {
    setError(null);
    try {
      const blob = await resizeToSquareJpeg(file);
      if (photo) URL.revokeObjectURL(photo.preview);
      setPhoto({ blob, preview: URL.createObjectURL(blob) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "เปิดไฟล์รูปไม่ได้");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExistingId(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, phone, email, attributes, consent, source: admin ? "admin" : "signup" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เกิดข้อผิดพลาด ลองอีกครั้ง");
        if (admin && typeof data.memberId === "string") setExistingId(data.memberId);
        return;
      }

      if (admin) {
        if (photo) {
          const body = new FormData();
          body.append("photo", photo.blob, "photo.jpg");
          const up = await fetch(`/api/members/${data.memberId}/photo`, { method: "POST", body });
          if (!up.ok) {
            // The member exists; open their page so staff can retry the photo there.
            const msg = (await up.json().catch(() => ({}))).error ?? "อัปโหลดรูปไม่สำเร็จ";
            alert(`สร้างสมาชิกแล้ว แต่${msg} — อัปโหลดใหม่ได้ในหน้าสมาชิก`);
          }
        }
        router.push(`/members/${data.memberId}`);
        router.refresh();
        return;
      }
      setSuccess(data);
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="join-card">
        <div className="join-success">
          <div className="check">✓</div>
          <h2>ยินดีต้อนรับสู่ {orgName} คุณ{success.displayName}</h2>
          <p>
            สมัครสมาชิกสำเร็จ ได้รับ <strong>+{success.pointsAwarded.toLocaleString("en-TH")} แต้ม</strong>{" "}
            เริ่มต้นที่ระดับ <strong>{success.tier}</strong>
          </p>
          <p className="join-success-hint">แจ้งเบอร์ {phone} ที่เคาน์เตอร์ทุกครั้งที่ซื้อ เพื่อสะสมแต้ม</p>
        </div>
      </div>
    );
  }

  return (
    <form className="join-card" onSubmit={handleSubmit}>
      {error && (
        <div className="form-error" role="alert">
          {error}
          {existingId && (
            <>
              {" "}
              <Link href={`/members/${existingId}`} className="member-link">เปิดข้อมูลสมาชิกเดิม →</Link>
            </>
          )}
        </div>
      )}

      {admin && (
        <div className="photo-pick">
          <button type="button" className="photo-pick-btn" onClick={() => photoInput.current?.click()}>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.preview} alt="รูปที่เลือก" />
            ) : (
              <span>+ รูป</span>
            )}
          </button>
          <div className="photo-pick-text">
            <strong>รูปโปรไฟล์</strong>
            <span>ไม่บังคับ · ครอบเป็นสี่เหลี่ยมจัตุรัสให้อัตโนมัติ</span>
            {photo && (
              <button
                type="button"
                className="photo-up-remove"
                onClick={() => {
                  URL.revokeObjectURL(photo.preview);
                  setPhoto(null);
                }}
              >
                เอารูปออก
              </button>
            )}
          </div>
          <input
            ref={photoInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickPhoto(f);
              e.target.value = "";
            }}
          />
        </div>
      )}

      <div className="field-group-label">ข้อมูลติดต่อ</div>
      <label className="field">
        <span>ชื่อ-นามสกุล <b>*</b></span>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="เช่น สมชาย ใจดี" autoComplete="name" />
      </label>
      <div className="field-row">
        <label className="field">
          <span>เบอร์มือถือ {!admin && <b>*</b>}</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08x-xxx-xxxx"
            inputMode="tel"
            autoComplete="tel"
            required={!admin}
          />
        </label>
        <label className="field">
          <span>อีเมล</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" type="email" autoComplete="email" />
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
        <span>
          {admin && <strong>ลูกค้าอ่านและยินยอมตามข้อความนี้แล้ว — </strong>}
          {consentText}
        </span>
      </label>

      <button className="btn btn-full" type="submit" disabled={submitting}>
        {submitting
          ? admin ? "กำลังสร้าง…" : "กำลังสมัคร…"
          : admin
            ? `สร้างสมาชิก (+${signupBonus.toLocaleString("en-TH")} แต้มต้อนรับ)`
            : `สมัครเลย รับ ${signupBonus.toLocaleString("en-TH")} แต้ม`}
      </button>
    </form>
  );
}
