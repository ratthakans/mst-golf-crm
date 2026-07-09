"use client";

import { useState } from "react";
import Link from "next/link";

interface Row { phone: string; name: string; amount: number; category: string; brand: string; branch: string; channel: string; }
interface Result { imported: number; matched: number; created: number; revenue: number; pointsAwarded: number; skipped: number; }

const HEADERS: Record<keyof Row, string[]> = {
  phone: ["phone", "เบอร์", "เบอร์โทร", "tel", "mobile"],
  name: ["name", "ชื่อ", "ลูกค้า"],
  amount: ["amount", "ยอด", "ยอดขาย", "จำนวนเงิน", "total", "price"],
  category: ["category", "หมวด", "ประเภท"],
  brand: ["brand", "แบรนด์", "ยี่ห้อ"],
  branch: ["branch", "สาขา"],
  channel: ["channel", "ช่องทาง"],
};

const SAMPLE = `phone,name,amount,category,brand,branch,channel
0812345678,สมชาย ทองดี,15900,clubs,TaylorMade,MST สยามพารากอน,store
0898765432,วิภา ศรีสุข,1800,balls,Titleist,MST เมกาบางนา,store
0855550001,,4800,footwear,FootJoy,MST ทองหล่อ,online
0866660002,ธนา รุ่งเรือง,1290,apparel,Callaway,MST สยามพารากอน,store
0877770003,กมล ภักดี,18000,clubs,Titleist,MST เซ็นทรัลลาดพร้าว,store
0844440004,อารยา สุวรรณ,590,accessories,FootJoy,MST เมกาบางนา,store
0833330005,พงศ์ ตันติกุล,3800,apparel,TaylorMade,MST ทองหล่อ,online
0822220006,,14500,clubs,Mizuno,MST อารีนา รัชโยธิน,arena
0811110007,ณัฐ วัฒนา,1600,balls,Callaway,MST สยามพารากอน,store
0800000008,สุดา แสงทอง,8900,accessories,Titleist,MST เมกาบางนา,store`;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "", record: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { record.push(field); field = ""; }
    else if (c === "\n") { record.push(field); rows.push(record); record = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || record.length) { record.push(field); rows.push(record); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function toRows(text: string): { rows: Row[]; error?: string } {
  const raw = parseCsv(text);
  if (raw.length < 2) return { rows: [], error: "ไฟล์ต้องมีหัวตารางและอย่างน้อย 1 แถว" };
  const header = raw[0]!.map((h) => h.trim().toLowerCase());
  const idx = (keys: string[]) => header.findIndex((h) => keys.includes(h));
  const cols = {
    phone: idx(HEADERS.phone), name: idx(HEADERS.name), amount: idx(HEADERS.amount),
    category: idx(HEADERS.category), brand: idx(HEADERS.brand), branch: idx(HEADERS.branch), channel: idx(HEADERS.channel),
  };
  if (cols.amount < 0) return { rows: [], error: "ไม่พบคอลัมน์ยอดเงิน (amount / ยอดขาย)" };
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const rows: Row[] = raw.slice(1).map((r) => ({
    phone: get(r, cols.phone), name: get(r, cols.name), amount: Number(get(r, cols.amount).replace(/[^0-9.]/g, "")),
    category: get(r, cols.category), brand: get(r, cols.brand), branch: get(r, cols.branch), channel: get(r, cols.channel),
  }));
  return { rows };
}

const num = (n: number) => n.toLocaleString("en-TH");

export default function ImportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setResult(null);
    const text = await f.text();
    const { rows, error } = toRows(text);
    setError(error ?? null);
    setRows(rows);
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "mst-pos-sample.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "นำเข้าไม่สำเร็จ");
      else { setResult(data); setRows([]); setFileName(""); }
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const valid = rows.filter((r) => Number.isFinite(r.amount) && r.amount > 0 && (r.phone || r.name)).length;

  return (
    <>
      <div className="page-head">
        <h1>นำเข้ายอดขายจาก POS</h1>
        <p>
          อัปโหลดไฟล์ยอดขาย (CSV) จากระบบ POS ท้ายวันครั้งเดียว — ระบบจับคู่สมาชิกเดิมจากเบอร์โทร
          (ถ้าไม่เจอก็สร้างใหม่) แล้วบันทึกยอด + แต้ม + tier ให้อัตโนมัติ พนักงานไม่ต้องคีย์ทีละบิล
        </p>
      </div>

      {result ? (
        <div className="card import-done">
          <div className="check">✓</div>
          <h2>นำเข้าสำเร็จ {num(result.imported)} รายการ</h2>
          <div className="import-stats">
            <div className="pp-chip"><span>จับคู่สมาชิกเดิม</span>{num(result.matched)}</div>
            <div className="pp-chip"><span>สร้างสมาชิกใหม่</span>{num(result.created)}</div>
            <div className="pp-chip"><span>ยอดขายรวม</span>฿{num(result.revenue)}</div>
            <div className="pp-chip"><span>แต้มที่แจก</span>{num(result.pointsAwarded)}</div>
            {result.skipped > 0 && <div className="pp-chip"><span>ข้าม (ข้อมูลไม่ครบ)</span>{num(result.skipped)}</div>}
          </div>
          <p className="muted-sub" style={{ marginTop: 14 }}>ทุกหน้าอัปเดตแล้ว — ยอดขาย/สมาชิก/แต้ม/กราฟ คำนวณจากข้อมูลใหม่ทันที</p>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <Link className="btn" href="/">ดูภาพรวม →</Link>
            <Link className="btn btn-ghost" href="/members">ดูสมาชิก</Link>
            <button className="btn btn-ghost" onClick={() => setResult(null)}>นำเข้าอีกไฟล์</button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="import-drop">
            <input id="csv" type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} />
            <label htmlFor="csv" className="btn">เลือกไฟล์ CSV</label>
            <span className="import-file">{fileName || "ยังไม่ได้เลือกไฟล์"}</span>
            <button className="btn btn-ghost" onClick={downloadSample}>ดาวน์โหลดไฟล์ตัวอย่าง</button>
          </div>
          <p className="muted-sub" style={{ marginTop: 10 }}>
            คอลัมน์ที่รองรับ: <code>phone, name, amount, category, brand, branch, channel</code> (ต้องมี amount เป็นอย่างน้อย)
          </p>

          {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}

          {rows.length > 0 && (
            <>
              <div className="import-summary">
                พบ {num(rows.length)} แถว · พร้อมนำเข้า <strong>{num(valid)}</strong> รายการ
                {rows.length - valid > 0 && <span className="muted-sub"> (ข้าม {num(rows.length - valid)} แถวที่ข้อมูลไม่ครบ)</span>}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr><th>เบอร์</th><th>ชื่อ</th><th className="mono">ยอด</th><th>หมวด</th><th>แบรนด์</th><th>สาขา</th><th>ช่องทาง</th></tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 12).map((r, i) => (
                      <tr key={i}>
                        <td className="mono">{r.phone || "—"}</td>
                        <td>{r.name || "—"}</td>
                        <td className="mono">฿{num(r.amount || 0)}</td>
                        <td>{r.category || "—"}</td>
                        <td>{r.brand || "—"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{r.branch || "—"}</td>
                        <td>{r.channel || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 12 && <p className="muted-sub" style={{ marginTop: 8 }}>แสดง 12 จาก {num(rows.length)} แถว</p>}
              <button className="btn btn-full" style={{ marginTop: 14 }} onClick={runImport} disabled={busy || valid === 0}>
                {busy ? "กำลังนำเข้า…" : `นำเข้า ${num(valid)} รายการ`}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
