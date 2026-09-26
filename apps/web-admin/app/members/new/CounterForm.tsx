"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { resizeToSquareJpeg } from "../../../lib/resize-image";
import { api, ApiError, errorText } from "../../ui/api";

export function CounterForm({ termsTitle, termsBody, marketingBody }: { termsTitle: string; termsBody: string; marketingBody: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", phone: "", birthday: "", email: "", consentConfirmed: false, marketing: false });
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      const blob = await resizeToSquareJpeg(file, 512);
      setPhoto(blob);
      setPreview(URL.createObjectURL(blob));
    } catch {
      setError("อ่านรูปไม่ได้ ลองไฟล์อื่น");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setExisting(null);
    try {
      const r = await api<{ member: { id: string } }>("/api/members", { body: form });
      if (photo) {
        const fd = new FormData();
        fd.append("photo", photo, "photo.jpg");
        await api(`/api/members/${r.member.id}/photo`, { form: fd }).catch(() => undefined);
      }
      router.push(`/members/${r.member.id}?created=1`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "PHONE_TAKEN" && typeof err.detail?.memberId === "string") setExisting(err.detail.memberId);
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="photo-pick">
        <button type="button" className="photo-pick-btn" onClick={() => fileRef.current?.click()} aria-label="เลือกรูปโปรไฟล์">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="" /> : "+ รูป"}
        </button>
        <div className="photo-pick-text">
          <b>รูปโปรไฟล์ (ไม่บังคับ)</b>
          <span>ช่วยให้พนักงานจำลูกค้าได้ · เก็บแบบส่วนตัว</span>
          {preview && (
            <button type="button" className="link-btn photo-up-remove" onClick={() => { setPhoto(null); setPreview(null); }}>
              เอารูปออก
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>

      <div className="form-grid">
        <label className="field">
          <span>ชื่อ-นามสกุล <b>*</b></span>
          <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required autoComplete="off" />
        </label>
        <label className="field">
          <span>เบอร์มือถือ <b>*</b></span>
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} required inputMode="tel" placeholder="0891112233" autoComplete="off" />
        </label>
        <label className="field">
          <span>วันเกิด <span className="hint">— เดือนเกิดได้แต้ม ×2</span></span>
          <input type="date" value={form.birthday} onChange={(e) => set("birthday", e.target.value)} />
        </label>
        <label className="field">
          <span>อีเมล</span>
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="off" />
        </label>
      </div>

      <label className="checkline" style={{ marginTop: 4 }}>
        <input type="checkbox" checked={form.consentConfirmed} onChange={(e) => set("consentConfirmed", e.target.checked)} required />
        <span>
          ลูกค้ายินยอมตาม{" "}
          <button type="button" className="link-btn" onClick={() => setShowTerms((v) => !v)}>{termsTitle}</button> <b className="danger-text">*</b>
        </span>
      </label>
      {showTerms && <p className="secret-note" style={{ margin: "8px 0 0" }}>{termsBody}</p>}
      <label className="checkline" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={form.marketing} onChange={(e) => set("marketing", e.target.checked)} />
        <span>{marketingBody}</span>
      </label>

      {error && (
        <p className="form-error" style={{ marginTop: 14 }}>
          {error} {existing && <Link href={`/members/${existing}`}>เปิดข้อมูลสมาชิกเดิม →</Link>}
        </p>
      )}
      <div className="btn-row">
        <Link href="/members" className="btn btn-ghost">ยกเลิก</Link>
        <button className="btn" type="submit" disabled={busy}>{busy ? "กำลังบันทึก…" : "สร้างสมาชิก"}</button>
      </div>
    </form>
  );
}
