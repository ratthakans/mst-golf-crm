"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, errorText } from "../ui/api";
import { formatBaht, formatDate, num } from "../ui/format";

type Field = string;
type Mapping = Record<Field, string | undefined>;

interface Counts {
  lines: number;
  bills: number;
  ok: number;
  unmatched: number;
  invalid: number;
  duplicate: number;
  membersMatched: number;
  membersToCreate: number;
  returns: number;
  salesSatang: number;
  identifiedSatang: number;
  pointsEstimate: number;
  from: string | null;
  to: string | null;
  pointsAwarded?: number;
  pointsReversed?: number;
  membersCreated?: number;
  tierUps?: number;
}

interface Preview {
  batchId: string;
  counts: Counts;
  headers: string[];
  mapping: Mapping;
  mappingProblems: string[];
  encoding: string;
  problems: Array<{ rowNumber: number; invoiceNo: string | null; status: string; message: string }>;
}

const STATUS_TEXT: Record<string, string> = { UNMATCHED: "ไม่มีเจ้าของ", INVALID: "ผิดรูปแบบ", DUPLICATE: "ซ้ำ" };
const STATUS_TONE: Record<string, string> = { UNMATCHED: "amber", INVALID: "red", DUPLICATE: "gray" };

export function ImportView({
  stores,
  fieldLabels,
  savedMapping,
}: {
  stores: Array<{ id: string; name: string }>;
  fieldLabels: Record<string, string>;
  savedMapping: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [mode, setMode] = useState<"DAILY" | "HISTORY">("DAILY");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Counts | null>(null);
  const [over, setOver] = useState(false);

  async function runPreview(f: File, m?: Mapping) {
    setBusy("preview");
    setError(null);
    setDone(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("storeId", storeId);
      fd.append("mode", mode);
      if (m) fd.append("mapping", JSON.stringify(Object.fromEntries(Object.entries(m).filter(([, v]) => v))));
      const p = await api<Preview>("/api/import", { form: fd });
      setPreview(p);
      setMapping(p.mapping);
      setShowMapping(p.mappingProblems.length > 0);
    } catch (e) {
      setPreview(null);
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  function choose(f: File | undefined) {
    if (!f) return;
    setFile(f);
    void runPreview(f);
  }

  async function commit() {
    if (!preview) return;
    setBusy("commit");
    setError(null);
    try {
      const r = await api<{ counts: Counts }>(`/api/import/${preview.batchId}/commit`, { method: "POST" });
      setDone(r.counts);
      setPreview(null);
      setFile(null);
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const c = preview?.counts;
  const canCommit = !!preview && preview.mappingProblems.length === 0 && (c?.ok ?? 0) + (c?.unmatched ?? 0) > 0;

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 14 }}>
        {stores.length > 1 && (
          <label className="field" style={{ margin: 0 }}>
            <span>สาขา</span>
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        )}
        <div className="row" role="radiogroup" aria-label="ประเภทไฟล์">
          <button type="button" className={`chip${mode === "DAILY" ? " chip-on" : ""}`} onClick={() => setMode("DAILY")}>ยอดขายประจำวัน</button>
          <button type="button" className={`chip${mode === "HISTORY" ? " chip-on" : ""}`} onClick={() => setMode("HISTORY")}>ยอดย้อนหลัง (ย้ายข้อมูลเก่า)</button>
        </div>
      </div>
      {mode === "HISTORY" && (
        <p className="secret-note" style={{ marginBottom: 12 }}>
          ยอดย้อนหลังใช้ตอนย้ายข้อมูลเก่าเท่านั้น: นับเป็นยอดซื้อ 12 เดือนเพื่อจัดระดับ แต่ <b>ไม่ให้แต้มและไม่ส่งข้อความ</b> หาลูกค้า
        </p>
      )}

      {!preview && !done && (
        <div
          className={`drop${over ? " over" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            choose(e.dataTransfer.files[0]);
          }}
        >
          <strong>{busy === "preview" ? "กำลังตรวจไฟล์…" : "วางไฟล์ CSV จาก POS ที่นี่ หรือคลิกเพื่อเลือก"}</strong>
          <span className="muted small">รองรับภาษาไทยทั้ง UTF-8 และ TIS-620 · ตรวจก่อนนำเข้าทุกครั้ง ยังไม่มีอะไรเปลี่ยนจนกว่าจะกดยืนยัน</span>
          <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => choose(e.target.files?.[0] ?? undefined)} />
        </div>
      )}

      {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

      {done && (
        <div>
          <div className="form-ok">
            นำเข้าเรียบร้อย — ให้แต้ม {num(done.pointsAwarded ?? 0)} แต้ม
            {done.pointsReversed ? ` · หักคืนจากการคืนสินค้า ${num(done.pointsReversed)} แต้ม` : ""}
            {done.membersCreated ? ` · สมาชิกใหม่จากบิล ${num(done.membersCreated)} คน` : ""}
            {done.tierUps ? ` · เลื่อนระดับ ${num(done.tierUps)} คน` : ""} · ข้อความแจ้งแต้มกำลังส่งทาง LINE
          </div>
          <button className="btn btn-ghost" onClick={() => setDone(null)}>นำเข้าไฟล์ถัดไป</button>
        </div>
      )}

      {preview && c && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="row between">
            <div>
              <b>{file?.name}</b>
              <span className="muted small">
                {" "}· {num(c.lines)} แถว · {c.from ? `${formatDate(c.from)} – ${formatDate(c.to)}` : "ไม่มีวันที่"} · {preview.encoding === "windows-874" ? "TIS-620" : "UTF-8"}
              </span>
            </div>
            <button className="link-btn" onClick={() => setShowMapping((v) => !v)}>
              {showMapping ? "ซ่อนการจับคู่คอลัมน์" : "ตรวจการจับคู่คอลัมน์"}
            </button>
          </div>

          {preview.mappingProblems.length > 0 && (
            <p className="form-error">
              {preview.mappingProblems.join(" · ")} — เลือกคอลัมน์ให้ถูกด้านล่าง แล้วกด ตรวจอีกครั้ง
            </p>
          )}

          {showMapping && mapping && (
            <div className="card" style={{ background: "var(--bg)" }}>
              <p className="muted small" style={{ marginTop: 0 }}>
                ระบบเดาคอลัมน์จากหัวตาราง{savedMapping ? " (หรือใช้แบบที่บันทึกไว้จากครั้งก่อน)" : ""} · ครั้งแรกตรวจให้ถูก แล้วระบบจำไว้ใช้ครั้งต่อไป
              </p>
              <div className="mapping-grid">
                {Object.entries(fieldLabels).map(([field, label]) => (
                  <label key={field} className="field">
                    <span>{label}{["invoiceNo", "date"].includes(field) && <b> *</b>}</span>
                    <select value={mapping[field] ?? ""} onChange={(e) => setMapping({ ...mapping, [field]: e.target.value || undefined })}>
                      <option value="">— ไม่มี —</option>
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <button className="btn btn-ghost" disabled={busy !== null || !file} onClick={() => file && runPreview(file, mapping)}>
                {busy === "preview" ? "กำลังตรวจ…" : "ตรวจอีกครั้งด้วยคอลัมน์นี้"}
              </button>
            </div>
          )}

          <div className="preview-nums">
            <div><b>{num(c.bills)}</b><span>บิลในไฟล์</span></div>
            <div><b>{num(c.ok)}</b><span>จับคู่สมาชิกได้ / บิลคืน</span></div>
            <div className="warn"><b>{num(c.unmatched)}</b><span>ไม่มีเจ้าของ (นำเข้าได้ ไม่มีใครได้แต้ม)</span></div>
            <div className="bad"><b>{num(c.invalid)}</b><span>ผิดรูปแบบ (ข้าม)</span></div>
            <div><b>{num(c.duplicate)}</b><span>นำเข้าแล้ว (ข้าม)</span></div>
            <div><b>{num(c.membersToCreate)}</b><span>สมาชิกใหม่จากเบอร์ในบิล</span></div>
            <div><b>{formatBaht(c.salesSatang)}</b><span>ยอดขายสุทธิ</span></div>
            <div><b>{mode === "HISTORY" ? "0" : `~${num(c.pointsEstimate)}`}</b><span>แต้มที่จะให้{c.returns ? ` · บิลคืน ${num(c.returns)}` : ""}</span></div>
          </div>

          {preview.problems.length > 0 && (
            <details>
              <summary className="link-btn">ดูรายการที่มีปัญหา ({num(preview.problems.length)})</summary>
              <div className="table-scroll" style={{ maxHeight: 320, overflowY: "auto", marginTop: 8 }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>แถว</th>
                      <th>เลขที่บิล</th>
                      <th>สถานะ</th>
                      <th>เหตุผล</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.problems.map((p, i) => (
                      <tr key={i}>
                        <td className="mono">{p.rowNumber}</td>
                        <td className="mono">{p.invoiceNo ?? "–"}</td>
                        <td><span className={`pill ${STATUS_TONE[p.status] ?? "gray"}`}>{STATUS_TEXT[p.status] ?? p.status}</span></td>
                        <td>{p.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          <div className="btn-row">
            <button className="btn btn-ghost" disabled={busy !== null} onClick={() => { setPreview(null); setFile(null); }}>ยกเลิก</button>
            <button className="btn" disabled={!canCommit || busy !== null} onClick={commit}>
              {busy === "commit" ? "กำลังนำเข้า…" : `ยืนยันนำเข้า ${num(c.ok + c.unmatched)} บิล`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
