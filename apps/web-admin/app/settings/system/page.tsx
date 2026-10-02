import Link from "next/link";
import { systemStatus, type JobHealth } from "@mstgolf/core";
import { allowPage } from "../../../lib/auth";
import { currentOrg } from "../../../lib/org";
import { Forbidden } from "../../Forbidden";
import { formatDateTime, num } from "../../ui/format";

export const dynamic = "force-dynamic";

const JOB_STATE: Record<JobHealth["state"], { text: string; cls: string }> = {
  ok: { text: "ปกติ", cls: "ready-ok" },
  late: { text: "ไม่รันตามรอบ", cls: "ready-todo" },
  failed: { text: "ล้มเหลว", cls: "ready-todo" },
  never: { text: "ยังไม่เคยรัน", cls: "ready-wait" },
};

function jobSummary(j: JobHealth): string | null {
  const d = j.last?.detail as Record<string, unknown> | null | undefined;
  if (!d || !j.last?.ok) return j.last?.error ?? null;
  if (j.kind === "frequent") {
    const o = (d.outbox ?? {}) as Record<string, number>;
    return `เตือนก่อนจอง ${num(Number(d.reminders ?? 0))} · ส่ง ${num(o.sent ?? 0)} · ข้าม ${num(o.skipped ?? 0)} · ล้ม ${num(o.failed ?? 0)}`;
  }
  if (j.kind === "nightly" && Array.isArray(d)) {
    const r = (d[0] ?? {}) as Record<string, unknown>;
    return `สมาชิกที่คำนวณยอด ${num(Number(r.spendRefreshed ?? 0))} · ลดระดับ ${num(Number(r.tierDowns ?? 0))} · ปิดการจอง ${num(Number(r.bookingsCompleted ?? 0))} · แต้มไม่ตรง ${num(Number(r.ledgerDrift ?? 0))}`;
  }
  if (j.kind === "backup") return d.file ? `${d.file}${d.bytes ? ` · ${(Number(d.bytes) / 1024 / 1024).toFixed(1)} MB` : ""}` : null;
  return null;
}

// Ops view for the Super Admin (and us): scheduled jobs, the LINE outbox,
// imports and whether the production secrets are in place.
export default async function SystemPage() {
  if (!(await allowPage("settings.manage"))) return <Forbidden />;
  const org = await currentOrg();
  const s = await systemStatus(org.id);
  const envRows: Array<[string, boolean, string]> = [
    ["AUTH_SECRET", s.env.AUTH_SECRET, "ลายเซ็นการเข้าสู่ระบบหลังบ้าน"],
    ["CRON_SECRET", s.env.CRON_SECRET, "ป้องกันงานตั้งเวลาไม่ให้คนนอกเรียก"],
    ["ENCRYPTION_KEY", s.env.ENCRYPTION_KEY, "เข้ารหัส credentials LINE — ต้องตรงกันทั้งสองโปรเจกต์ และเก็บสำรองไว้"],
    ["PUBLIC_BLOB_READ_WRITE_TOKEN", s.env.PUBLIC_BLOB_READ_WRITE_TOKEN, "อัปโหลดรูปเว็บไซต์และรูปปกบทความ"],
    ["RESEND_API_KEY · EMAIL_FROM", s.env.EMAIL, "อีเมลแจ้ง Marketing เมื่อมีคำขอแลกรางวัล"],
  ];
  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <Link href="/settings" className="back-link">← ตั้งค่า</Link>
        <h1 style={{ marginTop: 6 }}>สถานะระบบ</h1>
        <p>งานตั้งเวลา ข้อความ LINE การนำเข้า และค่าระบบ · ฐานข้อมูล schema <span className="mono">{s.env.DATABASE_SCHEMA}</span></p>
      </div>

      <div className="card table-card">
        <h3 style={{ padding: "14px 16px 0" }}>งานตั้งเวลา</h3>
        <table className="tbl ready-tbl">
          <tbody>
            {s.jobs.map((j) => (
              <tr key={j.kind}>
                <td style={{ width: 128 }}><span className={`ready-pill ${JOB_STATE[j.state].cls}`}>{JOB_STATE[j.state].text}</span></td>
                <td>
                  <b>{j.label}</b>
                  <div className="muted small">
                    {j.last ? `ล่าสุด ${formatDateTime(j.last.at)}` : "ยังไม่มีบันทึก"}
                    {j.last && !j.last.ok && j.lastOkAt ? ` · สำเร็จครั้งล่าสุด ${formatDateTime(j.lastOkAt)}` : ""}
                  </div>
                  {jobSummary(j) && <div className={`small ${j.last?.ok ? "muted" : "danger-text"}`}>{jobSummary(j)}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small" style={{ padding: "0 16px 14px" }}>
          งานกลางคืนรันจาก Vercel Cron · งานทุก 15 นาทีและการสำรองข้อมูลรันจาก GitHub Actions (ต้องตั้ง secrets ใน repository)
        </p>
      </div>

      <div className="card">
        <h3>ข้อความ LINE (7 วันล่าสุด)</h3>
        <dl className="kv">
          <dt>รอส่ง</dt>
          <dd>{num(s.outbox.pending)}{s.outbox.oldestPendingAt ? ` · เก่าสุด ${formatDateTime(s.outbox.oldestPendingAt)}` : ""}</dd>
          <dt>ส่งแล้ว</dt>
          <dd>{num(s.outbox.sent)}</dd>
          <dt>ข้าม</dt>
          <dd>{num(s.outbox.skipped)} <span className="muted small">— ยังไม่เชื่อม LINE, ลูกค้าไม่มี LINE หรือปิดข้อความประเภทนั้น</span></dd>
          <dt>ส่งไม่สำเร็จ</dt>
          <dd className={s.outbox.failed ? "danger-text" : undefined}>{num(s.outbox.failed)}</dd>
        </dl>
      </div>

      <div className="card">
        <h3>นำเข้ายอดขาย</h3>
        <dl className="kv">
          <dt>ล่าสุด</dt>
          <dd>{s.lastImport ? `${formatDateTime(s.lastImport.at)} · ${s.lastImport.fileName} · ${s.lastImport.store}` : "ยังไม่เคยนำเข้า"}</dd>
          <dt>ตรวจค้างไว้</dt>
          <dd>{s.abandonedPreviews ? `${num(s.abandonedPreviews)} รอบ ที่อัปโหลดแล้วไม่ได้กดยืนยัน (ล้างเองหลัง 24 ชม.)` : "ไม่มี"}</dd>
        </dl>
      </div>

      <div className="card table-card">
        <h3 style={{ padding: "14px 16px 0" }}>ค่าระบบ</h3>
        <table className="tbl ready-tbl">
          <tbody>
            {envRows.map(([k, ok, why]) => (
              <tr key={k}>
                <td style={{ width: 128 }}><span className={`ready-pill ${ok ? "ready-ok" : "ready-todo"}`}>{ok ? "มีแล้ว" : "ยังไม่มี"}</span></td>
                <td><span className="mono">{k}</span><div className="muted small">{why}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small" style={{ padding: "0 16px 14px" }}>แสดงแค่ว่ามีหรือไม่มี ไม่แสดงค่าจริง</p>
      </div>
    </div>
  );
}
