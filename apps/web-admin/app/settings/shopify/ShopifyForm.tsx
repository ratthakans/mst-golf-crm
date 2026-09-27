"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorText } from "../../ui/api";
import { SaveBar, useSave } from "../useSave";

export function ShopifyForm({ status }: { status: { shopDomain: string; windowDays: number; isActive: boolean } | null }) {
  const [f, setF] = useState({ shopDomain: status?.shopDomain ?? "", accessToken: "", windowDays: String(status?.windowDays ?? 14), isActive: status?.isActive ?? false });
  const s = useSave("shopify");
  return (
    <form
      className="card"
      autoComplete="off"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await s.save({ ...f, windowDays: Number(f.windowDays) })) setF({ ...f, accessToken: "" });
      }}
    >
      <h3>{status ? "แก้ไขการเชื่อมร้านออนไลน์" : "เชื่อมร้านออนไลน์"}</h3>
      <div className="form-grid">
        <label className="field"><span>โดเมนร้าน (.myshopify.com)</span><input value={f.shopDomain} onChange={(e) => setF({ ...f, shopDomain: e.target.value.trim() })} placeholder="mst-golf-thailand.myshopify.com" required /></label>
        <label className="field"><span>ระยะคืนสินค้า (วัน)</span><input value={f.windowDays} onChange={(e) => setF({ ...f, windowDays: e.target.value })} inputMode="numeric" required /></label>
        <label className="field" style={{ gridColumn: "1 / -1" }}><span>Admin API access token {status && <span className="hint">— เว้นว่าง = ใช้ค่าเดิม</span>}</span><input type="password" value={f.accessToken} onChange={(e) => setF({ ...f, accessToken: e.target.value })} autoComplete="new-password" placeholder="shpat_…" /></label>
        <label className="checkline" style={{ alignSelf: "end" }}><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> ดึงคำสั่งซื้อทุกคืน</label>
      </div>
      <p className="muted small">token เก็บแบบเข้ารหัส และไม่แสดงกลับมาที่หน้านี้อีก · เปลี่ยนระยะคืนสินค้าให้ตรงกับนโยบายคืนสินค้าบนเว็บ</p>
      <SaveBar {...s} />
    </form>
  );
}

export function SyncNow() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="card">
      <h3>ดึงตอนนี้</h3>
      <p className="muted small">ปกติระบบดึงเองทุกคืน กดเมื่อต้องการเห็นผลทันที — คำสั่งซื้อที่เข้าแล้วจะไม่ถูกนับซ้ำ</p>
      {msg && <p className={msg.ok ? "form-ok" : "form-error"}>{msg.text}</p>}
      <div className="btn-row">
        <button
          className="btn"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            try {
              const r = await api<{ booked: number; returns: number } | null>("/api/shopify/sync", { method: "POST" });
              setMsg({ ok: true, text: r ? `บันทึก ${r.booked} คำสั่งซื้อ · คืนสินค้า ${r.returns} รายการ` : "ยังไม่ได้เปิดการดึงข้อมูล" });
              router.refresh();
            } catch (e) {
              setMsg({ ok: false, text: errorText(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "กำลังดึง…" : "ดึงคำสั่งซื้อ"}
        </button>
      </div>
    </div>
  );
}
