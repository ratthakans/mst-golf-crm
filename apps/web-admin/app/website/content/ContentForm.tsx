"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorText } from "../../ui/api";

interface Copy {
  heroTitle?: string;
  heroHighlight?: string;
  heroLede?: string;
  servicesTitle?: string;
  servicesLede?: string;
  services?: Record<string, { short?: string; body?: string; points?: string } | undefined>;
}
interface Props {
  initial: { photos: Record<string, string | undefined>; copy: Copy };
  slots: Array<{ key: string; label: string; where: string; mock: string }>;
  services: Array<{ slug: string; name: string; thai: string; short: string; body: string; points: string }>;
  defaults: { heroTitle: string; heroHighlight: string; heroLede: string; servicesTitle: string; servicesLede: string };
  origin: string | null;
  uploadsEnabled: boolean;
}

const asset = (src: string, origin: string | null) => (src.startsWith("/") && origin ? `${origin}${src}` : src);

export function ContentForm({ initial, slots, services, defaults, origin, uploadsEnabled }: Props) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Record<string, string>>(() => Object.fromEntries(slots.map((s) => [s.key, initial.photos[s.key] ?? ""])));
  const [copy, setCopy] = useState<Copy>(initial.copy);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const set = (k: keyof Copy, v: string) => setCopy((c) => ({ ...c, [k]: v }));
  const setSvc = (slug: string, k: "short" | "body" | "points", v: string) =>
    setCopy((c) => ({ ...c, services: { ...(c.services ?? {}), [slug]: { ...(c.services?.[slug] ?? {}), [k]: v } } }));

  async function upload(key: string, file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(key);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await api<{ url: string }>("/api/site/upload", { form: fd });
      setPhotos((p) => ({ ...p, [key]: r.url }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setUploading(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      await api("/api/site/content", { method: "PUT", body: { photos, copy } });
      setOk(true);
      router.refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const text = (k: keyof typeof defaults, label: string, long = false) => (
    <label className="field" style={long ? { gridColumn: "1 / -1" } : undefined}>
      <span>{label}</span>
      {long ? (
        <textarea rows={2} value={(copy[k] as string | undefined) ?? ""} placeholder={defaults[k]} onChange={(e) => set(k, e.target.value)} />
      ) : (
        <input value={(copy[k] as string | undefined) ?? ""} placeholder={defaults[k]} onChange={(e) => set(k, e.target.value)} />
      )}
    </label>
  );

  return (
    <form className="stack" onSubmit={save}>
      <div className="card">
        <h3>รูปบนหน้าเว็บ</h3>
        <p className="muted small">
          {uploadsEnabled ? "อัปโหลด JPG/PNG/WebP ไม่เกิน 5 MB แนวนอน กว้างอย่างน้อย 1,600 px" : "ยังไม่ได้เปิดที่เก็บรูป — วางลิงก์รูป (https://…) แทนได้"} · เว้นว่าง = ใช้รูปตัวอย่างเดิม
        </p>
        <div className="photo-slots">
          {slots.map((s) => {
            const src = photos[s.key] || s.mock;
            const mock = !photos[s.key];
            return (
              <div key={s.key} className="photo-slot">
                <div className="photo-slot-img">
                  {/* eslint-disable-next-line @next/next/no-img-element -- preview of a website asset */}
                  <img src={asset(src, origin)} alt="" />
                  {mock && <span className="badge-mock">รูปตัวอย่าง</span>}
                </div>
                <b>{s.label}</b>
                <span className="muted small">{s.where}</span>
                <input value={photos[s.key] ?? ""} onChange={(e) => setPhotos((p) => ({ ...p, [s.key]: e.target.value.trim() }))} placeholder="https://…" />
                <div className="btn-row" style={{ justifyContent: "flex-start", marginTop: 6 }}>
                  {uploadsEnabled && (
                    <label className="btn btn-ghost btn-sm">
                      {uploading === s.key ? "กำลังอัปโหลด…" : "อัปโหลด"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(s.key, e.target.files?.[0])} />
                    </label>
                  )}
                  {!mock && (
                    <button type="button" className="link-btn" onClick={() => setPhotos((p) => ({ ...p, [s.key]: "" }))}>
                      กลับไปใช้รูปตัวอย่าง
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3>หน้าแรก</h3>
        <div className="form-grid two-col">
          {text("heroTitle", "หัวข้อหลัก บรรทัดแรก")}
          {text("heroHighlight", "หัวข้อหลัก บรรทัดที่สอง (สีเขียว) — เว้นว่างถ้าเปลี่ยนบรรทัดแรกแล้วต้องการบรรทัดเดียว")}
          {text("heroLede", "คำโปรยใต้หัวข้อ", true)}
          {text("servicesTitle", "หัวข้อส่วนบริการ")}
          {text("servicesLede", "คำโปรยส่วนบริการ", true)}
        </div>
      </div>

      {services.map((svc) => {
        const c = copy.services?.[svc.slug] ?? {};
        return (
          <div key={svc.slug} className="card">
            <h3>
              {svc.name} <span className="muted small">{svc.thai}</span>
            </h3>
            <div className="form-grid two-col">
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <span>คำอธิบายสั้น (หน้าแรก)</span>
                <input value={c.short ?? ""} placeholder={svc.short} onChange={(e) => setSvc(svc.slug, "short", e.target.value)} />
              </label>
              <label className="field">
                <span>รายละเอียด <span className="hint">— เว้นบรรทัดว่างเพื่อขึ้นย่อหน้าใหม่</span></span>
                <textarea rows={6} value={c.body ?? ""} placeholder={svc.body} onChange={(e) => setSvc(svc.slug, "body", e.target.value)} />
              </label>
              <label className="field">
                <span>จุดเด่น <span className="hint">— บรรทัดละข้อ</span></span>
                <textarea rows={6} value={c.points ?? ""} placeholder={svc.points} onChange={(e) => setSvc(svc.slug, "points", e.target.value)} />
              </label>
            </div>
          </div>
        );
      })}

      <div className="card save-sticky">
        {error && <p className="form-error">{error}</p>}
        {ok && <div className="form-ok">บันทึกแล้ว — ขึ้นเว็บภายใน 5 นาที</div>}
        <div className="btn-row">
          <button className="btn" type="submit" disabled={busy || !!uploading}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
        </div>
      </div>
    </form>
  );
}
