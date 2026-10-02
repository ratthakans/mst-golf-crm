import Link from "next/link";
import { readiness, type ReadyItem, type ReadyState } from "@mstgolf/core";
import { allowPage } from "../../../lib/auth";
import { currentOrg } from "../../../lib/org";
import { Forbidden } from "../../Forbidden";
import { formatDateTime } from "../../ui/format";
import { ConfirmButton } from "./ConfirmButton";

export const dynamic = "force-dynamic";

const GROUPS: Array<{ key: ReadyItem["group"]; title: string }> = [
  { key: "website", title: "เว็บไซต์" },
  { key: "store", title: "ร้านและการจองซิม" },
  { key: "members", title: "สมาชิก แต้ม และ PDPA" },
  { key: "rewards", title: "รางวัลและคูปอง" },
  { key: "pos", title: "ยอดขาย POS" },
  { key: "team", title: "ทีมงาน" },
  { key: "line", title: "LINE (ทีม LINE)" },
  { key: "system", title: "ระบบ" },
];

const STATE: Record<ReadyState, { text: string; cls: string }> = {
  ok: { text: "พร้อม", cls: "ready-ok" },
  confirm: { text: "รอ MST ยืนยัน", cls: "ready-confirm" },
  waiting: { text: "รอข้อมูล", cls: "ready-wait" },
  todo: { text: "ต้องทำ", cls: "ready-todo" },
};

// Go-live checklist computed from the live system (MST-DEV-PLAN.md §4 and §6).
export default async function ReadinessPage() {
  if (!(await allowPage("settings.manage"))) return <Forbidden />;
  const org = await currentOrg();
  const items = await readiness(org.id);
  const done = items.filter((i) => i.state === "ok").length;
  const open = items.filter((i) => i.state !== "ok");
  const byOwner = (o: ReadyItem["owner"]) => open.filter((i) => i.owner === o).length;
  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <Link href="/settings" className="back-link">← ตั้งค่า</Link>
        <h1 style={{ marginTop: 6 }}>ความพร้อมเปิดใช้</h1>
        <p>ตรวจจากระบบจริงทุกครั้งที่เปิดหน้านี้ · รายการ “รอ MST ยืนยัน” มีค่าอยู่แล้ว กดยืนยันเมื่อ MST ตรวจแล้วว่าถูกต้อง</p>
      </div>

      <div className="card ready-summary">
        <div className="ready-meter" aria-label={`พร้อม ${done} จาก ${items.length}`}>
          <div style={{ width: `${Math.round((done / items.length) * 100)}%` }} />
        </div>
        <p>
          <b>พร้อม {done} จาก {items.length} รายการ</b>
          {open.length > 0 && (
            <span className="muted"> · ค้าง MST {byOwner("MST")} · ทีม LINE {byOwner("ทีม LINE")} · ORIONS {byOwner("ORIONS")}</span>
          )}
        </p>
      </div>

      {GROUPS.map((g) => {
        const rows = items.filter((i) => i.group === g.key);
        if (!rows.length) return null;
        return (
          <div key={g.key} className="card table-card">
            <h3 style={{ padding: "14px 16px 0" }}>{g.title}</h3>
            <table className="tbl ready-tbl">
              <tbody>
                {rows.map((i) => (
                  <tr key={i.key}>
                    <td style={{ width: 128 }}>
                      <span className={`ready-pill ${STATE[i.state].cls}`}>{STATE[i.state].text}</span>
                    </td>
                    <td>
                      <b>{i.href ? <Link href={i.href}>{i.label}</Link> : i.label}</b>
                      <div className="muted small">{i.detail}</div>
                      {i.confirmed && <div className="muted small">ยืนยันโดย {i.confirmed.by} · {formatDateTime(i.confirmed.at)}</div>}
                    </td>
                    <td className="muted small" style={{ width: 90 }}>{i.owner}</td>
                    <td style={{ width: 170, textAlign: "right" }}>
                      {(i.state === "confirm" || i.confirmed) && <ConfirmButton itemKey={i.key} confirmed={!!i.confirmed} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
