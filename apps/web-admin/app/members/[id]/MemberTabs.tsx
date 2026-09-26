"use client";

import { Fragment, useState } from "react";
import { BOOKING_STATUS, formatBaht, formatDateTime, formatPhone, num, SOURCE_LABEL } from "../../ui/format";

interface Sale {
  id: string;
  invoiceNo: string;
  type: "SALE" | "RETURN" | "VOID";
  occurredAt: string;
  netSatang: number;
  storeName: string;
  points: number;
  lines: Array<{ name: string; sku: string | null; qty: number; netSatang: number }>;
}
interface PointRow { id: string; at: string; delta: number; label: string; note: string | null; invoiceNo: string | null }
interface BookingRow { id: string; startAt: string; laneName: string; partySize: number; status: string; source: string; priceSatang: number; paidSatang: number | null }
interface Identity { type: "LINE" | "PHONE"; value: string; verifiedAt: string | null; source: string; createdAt: string }
interface ConsentRow { purpose: "TERMS" | "MARKETING"; version: string; granted: boolean; channel: string | null; createdAt: string }
interface EventRow { type: string; occurredAt: string; payload: Record<string, unknown> }
interface AuditRow { id: string; action: string; userName: string | null; reason: string | null; createdAt: string; after: unknown }

const EVENT_LABEL: Record<string, string> = {
  REGISTER: "สมัครสมาชิก",
  LINE_LINKED: "ผูกบัญชี LINE",
  PROFILE_UPDATE: "แก้ไขโปรไฟล์",
  PURCHASE: "ซื้อสินค้า",
  RETURN: "คืนสินค้า",
  TIER_UP: "เลื่อนระดับ",
  TIER_DOWN: "ปรับระดับลง",
  BOOKING_CREATED: "จองซิม",
  BOOKING_CANCELLED: "ยกเลิกการจอง",
  BOOKING_CHECKED_IN: "เช็กอินซิม",
  BOOKING_NO_SHOW: "ไม่มาตามนัด",
  MERGED: "รวมบัญชี",
};
const EVENT_ICON: Record<string, string> = {
  REGISTER: "✨", LINE_LINKED: "🔗", PROFILE_UPDATE: "✏️", PURCHASE: "🛒", RETURN: "↩️", TIER_UP: "⬆️", TIER_DOWN: "⬇️",
  BOOKING_CREATED: "⛳", BOOKING_CANCELLED: "✕", BOOKING_CHECKED_IN: "✅", BOOKING_NO_SHOW: "⚠️", MERGED: "🧩",
};
const ACTION_LABEL: Record<string, string> = {
  "member.create": "สร้างสมาชิก",
  "member.update": "แก้ไขข้อมูล",
  "member.photo_set": "เปลี่ยนรูป",
  "member.photo_remove": "ลบรูป",
  "member.merge": "รวมบัญชี",
  "member.erase": "ลบข้อมูล PDPA",
  "points.adjust": "ปรับแต้ม",
  "review.merge_request": "ขอรวมบัญชี",
  "review.erase_request": "ขอลบข้อมูล",
};

function eventDetail(e: EventRow, tierNames: Record<string, string>): string {
  const p = e.payload;
  if (e.type === "PURCHASE" || e.type === "RETURN") return `${p.invoiceNo ?? p.refInvoiceNo ?? ""} ${typeof p.amount === "number" ? formatBaht(Math.round(p.amount * 100)) : ""}`.trim();
  if (e.type === "REGISTER" || e.type === "LINE_LINKED") return p.channel ? `ทาง ${SOURCE_LABEL[String(p.channel)] ?? p.channel}` : "";
  if (e.type === "TIER_UP" || e.type === "TIER_DOWN") return tierNames[String(p.tier)] ?? String(p.tier ?? "");
  if (e.type === "BOOKING_CREATED" && typeof p.startAt === "string") return formatDateTime(p.startAt);
  return "";
}

export function MemberTabs(props: {
  showMoney: boolean;
  sales: Sale[];
  points: PointRow[];
  bookings: BookingRow[];
  identities: Identity[];
  consents: ConsentRow[];
  events: EventRow[];
  audit: AuditRow[];
  showAudit: boolean;
  tierNames: Record<string, string>;
}) {
  const tabs = [
    { key: "timeline", label: "ไทม์ไลน์", count: props.events.length },
    { key: "sales", label: "บิล", count: props.sales.length },
    { key: "points", label: "แต้ม", count: props.points.length },
    { key: "bookings", label: "การจองซิม", count: props.bookings.length },
    { key: "identity", label: "ตัวตนและ PDPA", count: null },
    ...(props.showAudit ? [{ key: "audit", label: "บันทึกการแก้ไข", count: props.audit.length }] : []),
  ];
  const [tab, setTab] = useState("timeline");
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="card">
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`tab${tab === t.key ? " on" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.count !== null && <span className="count">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "timeline" &&
        (props.events.length === 0 ? (
          <div className="empty">ยังไม่มีกิจกรรม</div>
        ) : (
          <div className="timeline">
            {props.events.map((e, i) => (
              <div className="tl-row" key={i}>
                <span className="tl-icon">{EVENT_ICON[e.type] ?? "•"}</span>
                <div className="tl-body">
                  <div className="tl-head">
                    <span className="tl-label">{EVENT_LABEL[e.type] ?? e.type}</span>
                    <span className="tl-date">{formatDateTime(e.occurredAt)}</span>
                  </div>
                  {eventDetail(e, props.tierNames) && <div className="tl-detail">{eventDetail(e, props.tierNames)}</div>}
                </div>
              </div>
            ))}
          </div>
        ))}

      {tab === "sales" &&
        (props.sales.length === 0 ? (
          <div className="empty">ยังไม่มีบิลที่ผูกกับสมาชิกนี้ — บิลเข้ามาจากการนำเข้า POS</div>
        ) : (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>เลขที่บิล</th>
                  <th>ประเภท</th>
                  {props.showMoney && <th className="num">ยอด</th>}
                  <th className="num">แต้ม</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {props.sales.map((s) => (
                  <Fragment key={s.id}>
                    <tr className="click" onClick={() => setOpen(open === s.id ? null : s.id)}>
                      <td className="nowrap">{formatDateTime(s.occurredAt)}</td>
                      <td className="mono">{s.invoiceNo}</td>
                      <td>{s.type === "SALE" ? "ขาย" : s.type === "RETURN" ? <span className="pill amber">คืน</span> : <span className="pill red">ยกเลิก</span>}</td>
                      {props.showMoney && <td className="num">{formatBaht(s.netSatang)}</td>}
                      <td className={`num ${s.points > 0 ? "pos" : s.points < 0 ? "neg" : "dim"}`}>{s.points > 0 ? "+" : ""}{num(s.points)}</td>
                      <td className="dim small">{s.lines.length} รายการ {open === s.id ? "▴" : "▾"}</td>
                    </tr>
                    {open === s.id && (
                      <tr>
                        <td colSpan={6} style={{ background: "var(--bg)" }}>
                          {s.lines.map((l, i) => (
                            <div key={i} className="row between small" style={{ padding: "3px 0" }}>
                              <span>{l.name} {l.sku && <span className="muted mono">({l.sku})</span>} × {l.qty}</span>
                              {props.showMoney && <span className="mono">{formatBaht(l.netSatang)}</span>}
                            </div>
                          ))}
                          <div className="muted small" style={{ marginTop: 4 }}>{s.storeName}</div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "points" &&
        (props.points.length === 0 ? (
          <div className="empty">ยังไม่มีรายการแต้ม</div>
        ) : (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>รายการ</th>
                  <th className="num">แต้ม</th>
                </tr>
              </thead>
              <tbody>
                {props.points.map((p) => (
                  <tr key={p.id}>
                    <td className="nowrap">{formatDateTime(p.at)}</td>
                    <td>
                      {p.label}
                      {(p.invoiceNo || p.note) && <span className="sub">{[p.invoiceNo, p.note].filter(Boolean).join(" · ")}</span>}
                    </td>
                    <td className={`num ${p.delta >= 0 ? "pos" : "neg"}`}>{p.delta > 0 ? "+" : ""}{num(p.delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "bookings" &&
        (props.bookings.length === 0 ? (
          <div className="empty">ยังไม่เคยจองซิม</div>
        ) : (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>วันเวลา</th>
                  <th>Lane</th>
                  <th className="num">คน</th>
                  <th>ช่องทาง</th>
                  <th>สถานะ</th>
                  {props.showMoney && <th className="num">ชำระ</th>}
                </tr>
              </thead>
              <tbody>
                {props.bookings.map((b) => (
                  <tr key={b.id}>
                    <td className="nowrap">{formatDateTime(b.startAt)}</td>
                    <td>{b.laneName}</td>
                    <td className="num">{b.partySize}</td>
                    <td className="dim">{SOURCE_LABEL[b.source] ?? b.source}</td>
                    <td><span className={`pill ${BOOKING_STATUS[b.status]?.tone ?? "gray"}`}>{BOOKING_STATUS[b.status]?.label ?? b.status}</span></td>
                    {props.showMoney && <td className="num">{b.paidSatang !== null ? formatBaht(b.paidSatang) : <span className="dim">{formatBaht(b.priceSatang)}</span>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "identity" && (
        <div className="grid grid-2">
          <div>
            <h3 className="section-title">ตัวตนที่ผูกไว้</h3>
            {props.identities.length === 0 && <p className="muted small">ไม่มี</p>}
            <dl className="kv">
              {props.identities.map((i) => (
                <Fragment key={i.type}>
                  <dt>{i.type === "LINE" ? "LINE UID" : "เบอร์มือถือ"}</dt>
                  <dd className="mono">
                    {i.type === "PHONE" ? formatPhone(i.value) : `${i.value.slice(0, 10)}…${i.value.slice(-4)}`}
                    <span className="sub">
                      {i.verifiedAt ? `ยืนยันแล้ว ${formatDateTime(i.verifiedAt)}` : "ยังไม่ยืนยัน — ยืนยันเมื่อมีบิลแรกที่ใส่เบอร์นี้"} · มาจาก {SOURCE_LABEL[i.source] ?? i.source}
                    </span>
                  </dd>
                </Fragment>
              ))}
            </dl>
          </div>
          <div>
            <h3 className="section-title">ประวัติความยินยอม (PDPA)</h3>
            {props.consents.length === 0 ? (
              <p className="muted small">ไม่มีบันทึก (สมาชิกที่สร้างจากบิล POS)</p>
            ) : (
              <table className="tbl">
                <tbody>
                  {props.consents.map((c, i) => (
                    <tr key={i}>
                      <td>{c.purpose === "TERMS" ? "ข้อกำหนด/นโยบาย" : "รับข่าวสาร"} <span className="dim">{c.version}</span></td>
                      <td>{c.granted ? <span className="pill green">ยินยอม</span> : <span className="pill gray">ไม่ยินยอม</span>}</td>
                      <td className="dim nowrap">{formatDateTime(c.createdAt)}{c.channel ? ` · ${SOURCE_LABEL[c.channel] ?? c.channel}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "audit" &&
        (props.audit.length === 0 ? (
          <div className="empty">ยังไม่มีการแก้ไขโดยพนักงาน</div>
        ) : (
          <table className="tbl">
            <tbody>
              {props.audit.map((a) => (
                <tr key={a.id}>
                  <td className="nowrap">{formatDateTime(a.createdAt)}</td>
                  <td>{ACTION_LABEL[a.action] ?? a.action}{a.reason && <span className="sub">{a.reason}</span>}</td>
                  <td className="dim">{a.userName ?? "ระบบ"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </div>
  );
}
