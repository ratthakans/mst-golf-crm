"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LineGlyph } from "@/components/icons";
import { api, cleanLoginParams, initLiff } from "@/lib/client";
import { PhoneLogin } from "./PhoneLogin";

export interface LoginSetupProps {
  lineReady: boolean;
  liffId: string | null;
  devLogin: boolean;
}

type Phase = "starting" | "redirecting" | "verifying" | "error" | "idle";

const RETRY_KEY = "mst_login_retry";

// Signs the visitor in with their mobile number and an SMS code. When the
// tenant has LINE on, LINE sign-in (LIFF / LINE Login) is offered first. On
// success the server sets the session cookie and the page re-renders.
export function LoginPanel({ setup, purpose }: { setup: LoginSetupProps; purpose: "member" | "booking" | "rewards" }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(setup.lineReady ? "starting" : "idle");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const signIn = useCallback(async () => {
    if (!setup.liffId) return;
    setError(null);
    setPhase("starting");
    try {
      const liff = await initLiff(setup.liffId);
      if (!liff.isLoggedIn()) {
        setPhase("redirecting");
        liff.login({ redirectUri: window.location.href });
        return;
      }
      const idToken = liff.getIDToken();
      if (!idToken) throw new Error("no id token");
      setPhase("verifying");
      const res = await api<{ ok: true; member: boolean }>("/api/me/session", { method: "POST", body: { idToken } });
      if (res.ok) {
        sessionStorage.removeItem(RETRY_KEY);
        cleanLoginParams();
        router.refresh();
        return;
      }
      // A cached ID token can expire: sign in again once, outside LINE.
      if (res.code === "TOKEN_INVALID" && !liff.isInClient() && !sessionStorage.getItem(RETRY_KEY)) {
        sessionStorage.setItem(RETRY_KEY, "1");
        liff.logout();
        setPhase("redirecting");
        liff.login({ redirectUri: window.location.href });
        return;
      }
      setError(res.error);
      setPhase("error");
    } catch {
      setError("เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setPhase("error");
    }
  }, [router, setup.liffId]);

  useEffect(() => {
    if (setup.lineReady && !started.current) {
      started.current = true;
      void signIn();
    }
  }, [setup.lineReady, signIn]);

  const title = purpose === "booking" ? "เข้าสู่ระบบเพื่อจองซิมกอล์ฟ" : purpose === "rewards" ? "เข้าสู่ระบบเพื่อแลกรางวัล" : "สมาชิก MST Golf";
  const lead =
    purpose === "member"
      ? "สมัครหรือเข้าสู่ระบบด้วยเบอร์มือถือ ไม่ต้องตั้งรหัสผ่าน เราส่งรหัส 6 หลักทาง SMS ให้ทุกครั้ง"
      : "ใช้เบอร์มือถือ ไม่ต้องตั้งรหัสผ่าน ยังไม่เป็นสมาชิกก็สมัครต่อได้ในหน้านี้";

  return (
    <section className="panel login-panel" aria-live="polite">
      <h1>{title}</h1>
      <p className="muted">{lead}</p>

      {setup.lineReady && (
        <div className="login-state">
          {phase === "error" ? (
            <>
              <p className="notice notice-error" role="alert">
                {error}
              </p>
              <button type="button" className="btn btn-line btn-block" onClick={() => void signIn()}>
                <LineGlyph />
                <span>ลองเข้าสู่ระบบด้วย LINE อีกครั้ง</span>
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-line btn-block" disabled data-loading="true">
              <span className="spinner" aria-hidden="true" />
              <span>{phase === "redirecting" ? "กำลังไปที่ LINE…" : phase === "verifying" ? "กำลังยืนยันตัวตน…" : "กำลังเชื่อมต่อ LINE…"}</span>
            </button>
          )}
          <p className="hint center">หรือใช้เบอร์มือถือ</p>
        </div>
      )}

      <PhoneLogin />

      {setup.devLogin && <DevLogin />}
    </section>
  );
}

function DevLogin() {
  const router = useRouter();
  const [lineUserId, setId] = useState("Udev");
  const [name, setName] = useState("ทดสอบ ระบบ");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api("/api/me/dev-session", { method: "POST", body: { lineUserId, name } });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(res.error);
  };

  return (
    <form className="dev-login" onSubmit={submit}>
      <p className="dev-tag">Dev login · ใช้เฉพาะเครื่องนักพัฒนา (LINE_DEV_LOGIN=1)</p>
      <div className="field">
        <label htmlFor="dev-id">LINE user id (ปลอม)</label>
        <input id="dev-id" className="input" value={lineUserId} onChange={(e) => setId(e.target.value)} autoComplete="off" required />
      </div>
      <div className="field">
        <label htmlFor="dev-name">ชื่อที่แสดงใน LINE</label>
        <input id="dev-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-secondary btn-block" disabled={busy}>
        {busy && <span className="spinner" aria-hidden="true" />}
        <span>เข้าสู่ระบบแบบทดสอบ</span>
      </button>
    </form>
  );
}
