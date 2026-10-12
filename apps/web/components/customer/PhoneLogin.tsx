"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";

// Sign in (or start signing up) with a mobile number: number → SMS code →
// signed in. While the tenant runs without SMS codes (testing the flow), the
// number alone signs in. New numbers continue to the sign-up form.

type Sent = { phone: string; resendAt: number; devCode: string | null };

const pretty = (p: string) => (p.length === 10 ? `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}` : p);

export function PhoneLogin({ otp }: { otp: boolean }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<Sent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sent) return;
    codeRef.current?.focus();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sent]);

  const send = async (to: string) => {
    setBusy(true);
    setError(null);
    if (!otp) {
      const res = await api<{ next: "member" | "signup" }>("/api/me/phone", { method: "POST", body: { phone: to } });
      if (!res.ok) {
        setBusy(false);
        setError(res.error);
        return;
      }
      router.refresh();
      return;
    }
    const res = await api<{ phone: string; resendInSec: number; devCode: string | null }>("/api/me/otp", { method: "POST", body: { phone: to } });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCode("");
    setNow(Date.now());
    setSent({ phone: res.data.phone, resendAt: Date.now() + res.data.resendInSec * 1000, devCode: res.data.devCode });
  };

  const verify = async (value: string) => {
    if (!sent || value.length !== 6) return;
    setBusy(true);
    setError(null);
    const res = await api<{ next: "member" | "signup" }>("/api/me/otp/verify", { method: "POST", body: { phone: sent.phone, code: value } });
    if (!res.ok) {
      setBusy(false);
      setError(res.error);
      setCode("");
      codeRef.current?.focus();
      return;
    }
    router.refresh(); // the page re-renders on the server: member card, or the sign-up form
  };

  if (!sent) {
    return (
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void send(phone);
        }}
        noValidate
      >
        <div className="field">
          <label htmlFor="pl-phone">เบอร์มือถือ</label>
          <input
            id="pl-phone"
            className="input num"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="08X-XXX-XXXX"
            maxLength={16}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-describedby={error ? "pl-err" : "pl-hint"}
            aria-invalid={!!error}
          />
          {error ? (
            <p id="pl-err" className="field-error" role="alert">
              {error}
            </p>
          ) : (
            <p id="pl-hint" className="hint">
              ใช้เบอร์เดียวกับที่แจ้งที่เคาน์เตอร์ แต้มเดิมจะอยู่ในบัตรของคุณ
            </p>
          )}
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || phone.replace(/\D/g, "").length < 9}>
          {busy && <span className="spinner" aria-hidden="true" />}
          <span>{otp ? (busy ? "กำลังส่งรหัส…" : "รับรหัสทาง SMS") : busy ? "กำลังเข้าสู่ระบบ…" : "ต่อไป"}</span>
        </button>
      </form>
    );
  }

  const wait = Math.max(0, Math.ceil((sent.resendAt - now) / 1000));
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        void verify(code);
      }}
      noValidate
    >
      <p className="muted">
        ส่งรหัส 6 หลักไปที่ <b className="num">{pretty(sent.phone)}</b> แล้ว ·{" "}
        <button
          type="button"
          className="text-link"
          onClick={() => {
            setSent(null);
            setError(null);
          }}
        >
          เปลี่ยนเบอร์
        </button>
      </p>
      {sent.devCode && (
        <p className="notice notice-warn">
          <span>
            โหมดทดสอบ (ยังไม่ส่ง SMS จริง) · รหัสคือ <b className="num">{sent.devCode}</b>
          </span>
        </p>
      )}
      <div className="field">
        <label htmlFor="pl-code">รหัสจาก SMS</label>
        <input
          ref={codeRef}
          id="pl-code"
          className="input num otp-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(v);
            if (v.length === 6) void verify(v);
          }}
          aria-describedby={error ? "pl-code-err" : undefined}
          aria-invalid={!!error}
        />
        {error && (
          <p id="pl-code-err" className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>
        {busy && <span className="spinner" aria-hidden="true" />}
        <span>{busy ? "กำลังตรวจรหัส…" : "ยืนยัน"}</span>
      </button>
      <p className="hint center">
        {wait > 0 ? (
          <>ไม่ได้รับรหัส? ขอใหม่ได้ในอีก <span className="num">{wait}</span> วินาที</>
        ) : (
          <button type="button" className="text-link" disabled={busy} onClick={() => void send(sent.phone)}>
            ส่งรหัสอีกครั้ง
          </button>
        )}
      </p>
    </form>
  );
}
