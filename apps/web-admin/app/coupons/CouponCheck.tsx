"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, errorText } from "../ui/api";
import { formatBaht, formatDateTime } from "../ui/format";

interface Check {
  redemptionId: string;
  code: string;
  couponCode: string;
  rewardName: string;
  valueSatang: number | null;
  minSpendSatang: number | null;
  terms: string;
  status: string;
  statusLabel: string;
  usable: boolean;
  problem: string | null;
  expiresAt: string | null;
  usedAt: string | null;
  usedStoreName: string | null;
  usedInvoiceNo: string | null;
  member: { id: string; code: string; displayName: string } | null;
}

type Detector = { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };

export function CouponCheck({ stores }: { stores: Array<{ id: string; name: string }> }) {
  const [code, setCode] = useState("");
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [justUsed, setJustUsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [canScan, setCanScan] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setCanScan(typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia);
    inputRef.current?.focus();
  }, []);

  const lookup = async (raw: string) => {
    if (!raw.trim()) return;
    setBusy(true);
    setError(null);
    setJustUsed(false);
    try {
      setCheck(await api<Check>("/api/coupons/check", { body: { code: raw } }));
    } catch (e) {
      setCheck(null);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const use = async () => {
    if (!check) return;
    setBusy(true);
    setError(null);
    try {
      setCheck(await api<Check>("/api/coupons/use", { body: { code: check.couponCode, storeId, invoiceNo } }));
      setJustUsed(true);
      setInvoiceNo("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    setCheck(null);
    setCode("");
    setJustUsed(false);
    setError(null);
    inputRef.current?.focus();
  };

  // Camera scanning where the browser has a barcode detector (Chrome on Android, macOS); USB scanners type into the box instead.
  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | null = null;
    let stop = false;
    const Ctor = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const detector = new Ctor({ formats: ["qr_code"] });
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        while (!stop) {
          const found = await detector.detect(v).catch(() => []);
          if (found[0]?.rawValue) {
            setCode(found[0].rawValue);
            setCamera(false);
            void lookup(found[0].rawValue);
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setError("เปิดกล้องไม่ได้ — พิมพ์รหัสแทน");
        setCamera(false);
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <form className="card" onSubmit={(e) => { e.preventDefault(); void lookup(code); }}>
        <label className="field">
          <span>รหัสคูปอง</span>
          <div className="row">
            <input ref={inputRef} className="mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MST-XXXX-XXXX" autoComplete="off" style={{ flex: 1, fontSize: 18, letterSpacing: 1 }} />
            <button className="btn" disabled={busy || !code.trim()}>ตรวจ</button>
            {canScan && (
              <button type="button" className="btn btn-ghost" onClick={() => setCamera((v) => !v)}>
                {camera ? "ปิดกล้อง" : "สแกนด้วยกล้อง"}
              </button>
            )}
          </div>
        </label>
        {camera && <video ref={videoRef} muted playsInline style={{ width: "100%", maxHeight: 320, borderRadius: 8, background: "#000", marginTop: 8 }} />}
      </form>

      {error && <p className="form-error">{error}</p>}

      {check && (
        <div className="card" aria-live="polite">
          <div className="row between">
            <div>
              <div className="label mono">{check.couponCode}</div>
              <h2 style={{ margin: "4px 0 0" }}>{check.rewardName}</h2>
            </div>
            <span className={`pill ${justUsed ? "green" : check.usable ? "green" : "red"}`}>{justUsed ? "ใช้คูปองแล้ว" : check.usable ? "ใช้ได้" : check.statusLabel}</span>
          </div>
          {justUsed ? (
            <div className="form-ok" style={{ marginTop: 12 }}>
              บันทึกการใช้แล้ว — ลดราคาใน POS <b>{check.valueSatang ? formatBaht(check.valueSatang) : ""}</b> แล้วพิมพ์ <span className="mono">{check.couponCode}</span> ในหมายเหตุบิล
            </div>
          ) : check.problem ? (
            <p className="form-error" style={{ marginTop: 12 }}>
              {check.problem}
              {check.usedAt && ` · ${formatDateTime(check.usedAt)}${check.usedStoreName ? ` ที่ ${check.usedStoreName}` : ""}${check.usedInvoiceNo ? ` บิล ${check.usedInvoiceNo}` : ""}`}
            </p>
          ) : null}
          <dl className="kv" style={{ marginTop: 12 }}>
            <dt>มูลค่า</dt>
            <dd><b>{check.valueSatang ? formatBaht(check.valueSatang) : "–"}</b>{check.minSpendSatang ? ` · เมื่อซื้อครบ ${formatBaht(check.minSpendSatang)}` : ""}</dd>
            <dt>ใช้ได้ถึง</dt>
            <dd>{formatDateTime(check.expiresAt)}</dd>
            <dt>สมาชิก</dt>
            <dd>{check.member ? <Link href={`/members/${check.member.id}`}>{check.member.displayName} · <span className="mono">{check.member.code}</span></Link> : "–"}</dd>
            {check.terms && (
              <>
                <dt>เงื่อนไข</dt>
                <dd style={{ whiteSpace: "pre-line" }}>{check.terms}</dd>
              </>
            )}
            <dt>Redemption ID</dt>
            <dd><Link href={`/rewards/redemptions/${check.redemptionId}`} className="mono">{check.code}</Link></dd>
          </dl>
          {check.usable && !justUsed && (
            <div style={{ marginTop: 16 }}>
              <div className="form-grid">
                {stores.length > 1 && (
                  <label className="field">
                    <span>สาขา</span>
                    <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                      {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </label>
                )}
                <label className="field"><span>เลขที่บิล POS <span className="hint">— ไม่บังคับ ใช้ตรวจย้อนหลัง</span></span><input className="mono" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} /></label>
              </div>
              <div className="btn-row">
                <button type="button" className="btn" disabled={busy} onClick={() => void use()}>{busy ? "กำลังบันทึก…" : "ใช้คูปอง"}</button>
              </div>
              <p className="muted small">กดแล้วคูปองใช้ซ้ำไม่ได้อีก ทุกสาขา</p>
            </div>
          )}
          {(justUsed || !check.usable) && (
            <div className="btn-row"><button type="button" className="btn btn-ghost" onClick={next}>ตรวจคูปองถัดไป</button></div>
          )}
        </div>
      )}
    </div>
  );
}
