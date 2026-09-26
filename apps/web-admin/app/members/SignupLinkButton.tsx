"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";

// The customer sign-up link — the LIFF member page (same as Rich Menu button
// A+B) — with copy, open and a printable QR for the counter. Null until the
// LINE agency hands over the LIFF app.
export function SignupLinkButton({ orgName, signupBonus, signupUrl }: { orgName: string; signupBonus: number; signupUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(signupUrl ?? "");
  const [copied, setCopied] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setUrl(signupUrl ?? "");
  }, [signupUrl]);

  useEffect(() => {
    if (!open || !url || !canvas.current) return;
    void QRCode.toCanvas(canvas.current, url, { width: 220, margin: 1, color: { dark: "#0b3d29", light: "#ffffff" } });
  }, [open, url]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      trigger.current?.focus();
    };
  }, [open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function downloadQr() {
    // Larger render for print; the on-screen canvas is sized for the dialog.
    const dataUrl = await QRCode.toDataURL(url, { width: 1024, margin: 2, color: { dark: "#0b3d29", light: "#ffffff" } });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "signup-qr.png";
    a.click();
  }

  return (
    <>
      <button ref={trigger} type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        ลิงก์สมัครสมาชิก
      </button>

      {/* Portalled to <body>: page sections animate with a transform, which would
          otherwise trap a position:fixed overlay inside them. */}
      {open && createPortal(
        <div className="cmdk-overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="link-dialog" role="dialog" aria-modal="true" aria-labelledby="signup-link-title">
            <div className="link-dialog-head">
              <h2 id="signup-link-title">ลิงก์สมัครสมาชิก</h2>
              <button type="button" className="link-dialog-close" onClick={() => setOpen(false)} aria-label="ปิด" autoFocus>
                ✕
              </button>
            </div>
            <p className="link-dialog-sub">
              ลิงก์เดียวกับปุ่ม "สมัครสมาชิก" ใน LINE — ลูกค้าสแกนแล้วล็อกอินด้วย LINE สมัครเป็นสมาชิก {orgName} ได้เอง
              และได้แต้มต้อนรับ {signupBonus.toLocaleString("en-TH")} แต้มทันที
            </p>

            {!url ? (
              <p className="secret-note">ยังไม่มีลิงก์ — รอทีม LINE ส่งข้อมูล LIFF แล้วใส่ที่ ตั้งค่า › LINE ระหว่างนี้เพิ่มสมาชิกที่เคาน์เตอร์ได้ตามปกติ</p>
            ) : (
            <>
            <div className="link-row">
              <input className="link-input" value={url} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="ลิงก์สมัครสมาชิก" />
              <button type="button" className="btn" onClick={copy}>{copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}</button>
            </div>

            <div className="link-qr">
              <canvas ref={canvas} aria-label="QR code ของลิงก์สมัครสมาชิก" />
              <div className="link-qr-actions">
                <button type="button" className="btn btn-ghost" onClick={downloadQr}>ดาวน์โหลด QR</button>
                <a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">เปิดหน้าสมัคร ↗</a>
              </div>
            </div>
            </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
