"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorText } from "../../../ui/api";

export interface RewardFormValues {
  kind: "COUPON" | "PHYSICAL";
  name: string;
  description: string;
  terms: string;
  imageUrl: string;
  costPoints: string;
  valueBaht: string;
  minSpendBaht: string;
  validDays: string;
  fulfilment: string;
  stock: string;
  perMemberLimit: string;
  minTier: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  sortOrder: string;
}

export function RewardForm({ id, values, tiers, kindLocked }: { id: string | null; values: RewardFormValues; tiers: Array<{ key: string; name: string }>; kindLocked: boolean }) {
  const router = useRouter();
  const [f, setF] = useState(values);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const set = <K extends keyof RewardFormValues>(k: K, v: RewardFormValues[K]) => setF((x) => ({ ...x, [k]: v }));
  const coupon = f.kind === "COUPON";

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("image", file);
      const res = await api<{ url: string }>("/api/rewards/upload", { form });
      set("imageUrl", res.url);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(false);
    const body = {
      ...f,
      imageUrl: f.imageUrl || null,
      valueBaht: f.valueBaht || null,
      minSpendBaht: f.minSpendBaht || null,
      validDays: f.validDays || null,
      fulfilment: f.fulfilment || null,
      stock: f.stock === "" ? null : f.stock,
      perMemberLimit: f.perMemberLimit || null,
      minTier: f.minTier || null,
      startsAt: f.startsAt || null,
      endsAt: f.endsAt || null,
    };
    try {
      const res = await api<{ id: string }>(id ? `/api/rewards/${id}` : "/api/rewards", { method: id ? "PUT" : "POST", body });
      setOk(true);
      if (!id) router.replace(`/rewards/catalog/${res.id}`);
      router.refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card" onSubmit={save}>
      <div className="field">
        <span>ประเภท</span>
        <div className="chips" role="radiogroup" aria-label="ประเภทรางวัล">
          {(["COUPON", "PHYSICAL"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={f.kind === k} disabled={kindLocked && f.kind !== k} className={`chip${f.kind === k ? " chip-on" : ""}`} onClick={() => set("kind", k)}>
              {k === "COUPON" ? "คูปองส่วนลด — ออกให้ทันที ใช้ที่ร้าน" : "ของรางวัล — ทีมอนุมัติแล้วจัดส่ง/ให้มารับ"}
            </button>
          ))}
        </div>
        {kindLocked && <span className="hint">มีคนแลกแล้ว เปลี่ยนประเภทไม่ได้</span>}
      </div>

      <div className="form-grid">
        <label className="field"><span>ชื่อรางวัล</span><input value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={80} placeholder={coupon ? "คูปองส่วนลด ฿1,000" : "iPad 10.9 นิ้ว Wi-Fi 64GB"} required /></label>
        <label className="field"><span>แต้มที่ใช้แลก</span><input inputMode="numeric" value={f.costPoints} onChange={(e) => set("costPoints", e.target.value.replace(/\D/g, ""))} required /></label>
      </div>

      {coupon ? (
        <div className="form-grid">
          <label className="field"><span>มูลค่าส่วนลด (บาท)</span><input inputMode="numeric" value={f.valueBaht} onChange={(e) => set("valueBaht", e.target.value.replace(/\D/g, ""))} /></label>
          <label className="field"><span>ยอดซื้อขั้นต่ำ (บาท) <span className="hint">— ไม่บังคับ</span></span><input inputMode="numeric" value={f.minSpendBaht} onChange={(e) => set("minSpendBaht", e.target.value.replace(/\D/g, ""))} /></label>
          <label className="field"><span>ใช้ได้กี่วันหลังแลก</span><input inputMode="numeric" value={f.validDays} onChange={(e) => set("validDays", e.target.value.replace(/\D/g, ""))} /></label>
        </div>
      ) : (
        <label className="field"><span>ระยะเวลาที่แจ้งลูกค้า</span><input value={f.fulfilment} onChange={(e) => set("fulfilment", e.target.value)} maxLength={200} placeholder="7–14 วัน ขึ้นกับสต็อก" /></label>
      )}

      <div className="form-grid">
        <label className="field"><span>สต็อก <span className="hint">— เว้นว่าง = ไม่จำกัด</span></span><input inputMode="numeric" value={f.stock} onChange={(e) => set("stock", e.target.value.replace(/\D/g, ""))} disabled={!!id && values.stock !== ""} /></label>
        <label className="field"><span>แลกได้คนละกี่ครั้ง <span className="hint">— ว่าง = ไม่จำกัด</span></span><input inputMode="numeric" value={f.perMemberLimit} onChange={(e) => set("perMemberLimit", e.target.value.replace(/\D/g, ""))} /></label>
        <label className="field">
          <span>เฉพาะระดับ</span>
          <select value={f.minTier} onChange={(e) => set("minTier", e.target.value)}>
            <option value="">ทุกระดับ</option>
            {tiers.map((t) => (
              <option key={t.key} value={t.key}>{t.name} ขึ้นไป</option>
            ))}
          </select>
        </label>
      </div>
      {id && values.stock !== "" && <p className="muted small" style={{ marginTop: -6 }}>เพิ่ม/ลดสต็อกที่กล่องด้านล่าง เพื่อไม่ทับยอดที่สมาชิกเพิ่งแลก</p>}

      <div className="form-grid">
        <label className="field"><span>เริ่มให้แลก <span className="hint">— ว่าง = ทันที</span></span><input type="date" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></label>
        <label className="field"><span>วันสุดท้าย <span className="hint">— ว่าง = ไม่มีกำหนด</span></span><input type="date" value={f.endsAt} min={f.startsAt || undefined} onChange={(e) => set("endsAt", e.target.value)} /></label>
        <label className="field"><span>ลำดับที่แสดง <span className="hint">— น้อยขึ้นก่อน</span></span><input inputMode="numeric" value={f.sortOrder} onChange={(e) => set("sortOrder", e.target.value.replace(/\D/g, ""))} /></label>
      </div>

      <label className="field"><span>รายละเอียด</span><textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={2} maxLength={1000} /></label>
      <label className="field"><span>เงื่อนไข <span className="hint">— สมาชิกต้องกดยอมรับก่อนแลก</span></span><textarea value={f.terms} onChange={(e) => set("terms", e.target.value)} rows={3} maxLength={2000} /></label>

      <div className="field">
        <span>รูป</span>
        <div className="row">
          {f.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.imageUrl} alt="" width={72} height={72} style={{ objectFit: "cover", borderRadius: 8 }} />
          )}
          <input className="link-input" value={f.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://… หรืออัปโหลด" style={{ flex: 1, minWidth: 200 }} />
          <label className="btn btn-ghost btn-sm">
            {uploading ? "กำลังอัปโหลด…" : "อัปโหลดรูป"}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          </label>
        </div>
      </div>

      <label className="toggle-row">
        <span>
          <b>เปิดให้แลก</b>
          <span>ปิดแล้วสมาชิกไม่เห็นรางวัลนี้ · คำขอและคูปองที่ออกไปแล้วยังใช้ได้ตามปกติ</span>
        </span>
        <input type="checkbox" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} />
      </label>

      {error && <p className="form-error">{error}</p>}
      {ok && <div className="form-ok">บันทึกแล้ว</div>}
      <div className="btn-row">
        <button className="btn" disabled={busy || uploading}>{busy ? "กำลังบันทึก…" : id ? "บันทึก" : "สร้างรางวัล"}</button>
      </div>
    </form>
  );
}

export function StockForm({ id, stock }: { id: string; stock: number }) {
  const router = useRouter();
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (sign: 1 | -1) => {
    const n = Number(delta);
    if (!n) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/rewards/${id}/stock`, { body: { delta: sign * n, note } });
      setDelta("");
      setNote("");
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>สต็อก: {stock.toLocaleString("en-US")} ชิ้น</h3>
      <p className="muted small" style={{ marginTop: 0 }}>ลดอัตโนมัติเมื่อสมาชิกแลก และคืนเมื่อคำขอถูกปฏิเสธหรือยกเลิก</p>
      <div className="row">
        <input className="link-input" inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value.replace(/\D/g, ""))} placeholder="จำนวน" style={{ width: 100 }} aria-label="จำนวน" />
        <input className="link-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ เช่น รับของล็อตใหม่" style={{ flex: 1, minWidth: 180 }} aria-label="หมายเหตุ" />
        <button type="button" className="btn btn-sm" disabled={busy || !delta} onClick={() => void submit(1)}>+ รับเข้า</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy || !delta} onClick={() => void submit(-1)}>− ตัดออก</button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
