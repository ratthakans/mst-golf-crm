"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorText } from "../ui/api";
import { BOOKING_STATUS, formatBaht, formatHm, formatPhone, formatThaiDate, SOURCE_LABEL } from "../ui/format";
import { Modal } from "../ui/Modal";

interface Lane {
  id: string;
  name: string;
  capacity: number;
  hourlyPriceSatang: number;
}
interface Booking {
  id: string;
  laneId: string;
  laneName: string;
  startAt: string;
  endAt: string;
  partySize: number;
  status: "HELD" | "CONFIRMED" | "CHECKED_IN" | "COMPLETED" | "NO_SHOW" | "CANCELLED";
  source: "LINE" | "WEB" | "WALKIN" | "PHONE";
  heldUntil: string | null;
  priceSatang: number;
  discountPct: number;
  paidSatang: number | null;
  note: string | null;
  memberId: string | null;
  memberCode: string | null;
  name: string;
  phone: string | null;
  tier: string | null;
  checkedInAt: string | null;
}
interface Block {
  id: string;
  laneId: string;
  startAt: string;
  endAt: string;
  reason: "MAINTENANCE" | "PRIVATE" | "EVENT";
  note: string | null;
}
interface Day {
  date: string;
  lanes: Lane[];
  slots: string[];
  bookings: Booking[];
  blocks: Block[];
}
interface MemberHit {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  tier: string;
  points: number;
  hasLine: boolean;
}

const BLOCK_LABEL = { MAINTENANCE: "ปิดซ่อม", PRIVATE: "ปิดส่วนตัว", EVENT: "อีเวนต์" };
const HOUR = 3_600_000;

function shiftDate(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return new Date(d.getTime() + 7 * HOUR).toISOString().slice(0, 10);
}
const dayLabel = (key: string) => formatThaiDate(new Date(`${key}T12:00:00+07:00`), { weekday: true });

export function SimulatorView({
  today,
  initialDate,
  initial,
  can,
  presetMember,
  noShowGraceMinutes,
}: {
  today: string;
  initialDate: string;
  initial: Day[];
  can: { manage: boolean; block: boolean; money: boolean };
  presetMember: MemberHit | null;
  noShowGraceMinutes: number;
}) {
  const [date, setDate] = useState(initialDate);
  const [view, setView] = useState<"day" | "week">("day");
  const [days, setDays] = useState<Day[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [create, setCreate] = useState<{ laneId: string; startAt: string } | null>(null);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const start = view === "week" ? shiftDate(date, -((new Date(`${date}T12:00:00+07:00`).getUTCDay() + 6) % 7)) : date;
        const d = await api<{ days: Day[] }>(`/api/booking?date=${start}&days=${view === "week" ? 7 : 1}`);
        setDays(d.days);
        setError(null);
      } catch (e) {
        if (!quiet) setError(errorText(e));
      } finally {
        setLoading(false);
        setNow(Date.now());
      }
    },
    [date, view],
  );

  useEffect(() => {
    void load();
    const url = new URL(window.location.href);
    url.searchParams.set("date", date);
    window.history.replaceState(null, "", url);
  }, [load, date]);

  // Bookings made in LINE or on the website appear without a refresh.
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && void load(true), 15_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (presetMember) setToast(`เลือกช่องว่างเพื่อจองให้ ${presetMember.name}`);
  }, [presetMember]);

  const day = days[0];
  const lanes = day?.lanes ?? [];

  async function move(bookingId: string, laneId: string, startAt: string) {
    try {
      await api(`/api/booking/${bookingId}`, { method: "PATCH", body: { action: "move", laneId, startAt } });
      setToast("ย้ายการจองแล้ว · ลูกค้าได้ข้อความแจ้งใน LINE");
      await load(true);
    } catch (e) {
      setError(errorText(e));
    }
  }

  const todayList = useMemo(
    () =>
      date === today && day
        ? day.bookings.filter((b) => (b.status === "CONFIRMED" || b.status === "CHECKED_IN") && new Date(b.endAt).getTime() > now).sort((a, b) => a.startAt.localeCompare(b.startAt))
        : [],
    [date, today, day, now],
  );

  return (
    <div className="stack">
      <div className="page-head page-head-actions" style={{ marginBottom: 0 }}>
        <div>
          <h1>ซิมกอล์ฟ</h1>
          <p>การจองจาก LINE เว็บไซต์ walk-in และโทรจองอยู่ในตารางเดียว · ลากการ์ดเพื่อย้ายเวลา/lane · อัปเดตเองทุก 15 วินาที</p>
        </div>
        {can.block && (
          <div className="head-actions">
            <button className="btn btn-ghost" onClick={() => setBlockOpen(true)}>ปิด lane</button>
          </div>
        )}
      </div>

      <div className="cal-toolbar">
        <button className="btn btn-ghost btn-sm" onClick={() => setDate(shiftDate(date, view === "week" ? -7 : -1))} aria-label="ก่อนหน้า">←</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setDate(today)}>วันนี้</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setDate(shiftDate(date, view === "week" ? 7 : 1))} aria-label="ถัดไป">→</button>
        <span className="date-label">{dayLabel(date)}</span>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="เลือกวัน" className="date-input" />
        <span className="spacer-grow" />
        <button className={`chip${view === "day" ? " chip-on" : ""}`} onClick={() => setView("day")}>รายวัน</button>
        <button className={`chip${view === "week" ? " chip-on" : ""}`} onClick={() => setView("week")}>รายสัปดาห์</button>
        {loading && <span className="muted small">กำลังโหลด…</span>}
      </div>

      {error && <p className="form-error">{error}</p>}
      {toast && <div className="form-ok">{toast}</div>}

      {view === "day" && day && (
        <>
          {todayList.length > 0 && (
            <div className="card">
              <h3>รายการวันนี้</h3>
              <div className="today-list">
                {todayList.map((b) => (
                  <div className="today-item" key={b.id}>
                    <span className="t">{formatHm(new Date(b.startAt))}</span>
                    <span>
                      <b>{b.name}</b> <span className="muted small">{b.laneName} · {b.partySize} คน · {SOURCE_LABEL[b.source]}</span>
                    </span>
                    {b.status === "CHECKED_IN" ? (
                      <span className="pill blue">เช็กอินแล้ว</span>
                    ) : can.manage ? (
                      <button className="btn btn-sm" onClick={() => setSelected(b)}>เช็กอิน</button>
                    ) : (
                      <span className="pill green">ยืนยันแล้ว</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {day.slots.length === 0 ? (
            <div className="empty">ร้านปิดวันนี้ (ตั้งเวลาเปิดที่ ตั้งค่า › การจองซิม)</div>
          ) : (
            <div className="cal-wrap">
              <div className="cal" style={{ gridTemplateColumns: `64px repeat(${lanes.length}, minmax(170px, 1fr))` }}>
                <div className="hd" />
                {lanes.map((l) => (
                  <div className="hd" key={l.id}>
                    {l.name} <span className="muted small">· {l.capacity} คน</span>
                  </div>
                ))}
                {day.slots.map((slot) => {
                  const start = new Date(slot).getTime();
                  const past = start + HOUR <= now;
                  return (
                    <SlotRow
                      key={slot}
                      slot={slot}
                      past={past}
                      lanes={lanes}
                      day={day}
                      can={can}
                      dragId={dragId}
                      onFree={(laneId) => can.manage && setCreate({ laneId, startAt: slot })}
                      onOpen={setSelected}
                      onDragStart={setDragId}
                      onDrop={(laneId) => {
                        if (dragId) void move(dragId, laneId, slot);
                        setDragId(null);
                      }}
                      onBlockClick={async (b) => {
                        if (!can.block) return;
                        if (!window.confirm(`เปิด ${lanes.find((l) => l.id === b.laneId)?.name} ช่วงนี้ให้จองได้อีกครั้ง?`)) return;
                        try {
                          await api(`/api/booking/blocks/${b.id}`, { method: "DELETE" });
                          await load(true);
                        } catch (e) {
                          setError(errorText(e));
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
          <div className="legend">
            <span style={{ ["--c" as string]: "var(--brand)" }}>ยืนยันแล้ว</span>
            <span style={{ ["--c" as string]: "#f59e0b" }}>ลูกค้ากำลังยืนยัน (ถือช่อง 5 นาที)</span>
            <span style={{ ["--c" as string]: "#2563eb" }}>เช็กอินแล้ว</span>
            <span style={{ ["--c" as string]: "#ef4444" }}>ไม่มาตามนัด</span>
          </div>
        </>
      )}

      {view === "week" && (
        <div className="cal-wrap" style={{ padding: 10 }}>
          <div className="week">
            {days.map((d) => (
              <div className="week-day" key={d.date}>
                <h4>
                  <button className="link-btn" onClick={() => { setView("day"); setDate(d.date); }}>{dayLabel(d.date)}</button>
                  <span className="muted small"> · {d.bookings.filter((b) => b.status !== "NO_SHOW").length}</span>
                </h4>
                {d.bookings.length === 0 && <p className="muted small">ว่างทั้งวัน</p>}
                {d.bookings.map((b) => (
                  <div key={b.id} className={`bk ${b.status}`} onClick={() => setSelected(b)}>
                    <span className="n">{formatHm(new Date(b.startAt))} {b.name}</span>
                    <span className="m">{b.laneName} · {b.partySize} คน</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {create && day && (
        <CreateDialog
          lane={lanes.find((l) => l.id === create.laneId)!}
          startAt={create.startAt}
          presetMember={presetMember}
          now={now}
          onClose={() => setCreate(null)}
          onDone={async (msg) => {
            setCreate(null);
            setToast(msg);
            await load(true);
          }}
        />
      )}
      {selected && (
        <BookingDialog
          booking={selected}
          lanes={lanes}
          slots={day?.slots ?? []}
          can={can}
          now={now}
          noShowGraceMinutes={noShowGraceMinutes}
          onClose={() => setSelected(null)}
          onDone={async (msg) => {
            setSelected(null);
            if (msg) setToast(msg);
            await load(true);
          }}
        />
      )}
      {blockOpen && (
        <BlockDialog
          lanes={lanes}
          date={date}
          onClose={() => setBlockOpen(false)}
          onDone={async () => {
            setBlockOpen(false);
            setToast("ปิด lane แล้ว — ลูกค้าจองช่วงนี้ไม่ได้");
            await load(true);
          }}
        />
      )}
    </div>
  );
}

function SlotRow({
  slot,
  past,
  lanes,
  day,
  can,
  dragId,
  onFree,
  onOpen,
  onDragStart,
  onDrop,
  onBlockClick,
}: {
  slot: string;
  past: boolean;
  lanes: Lane[];
  day: Day;
  can: { manage: boolean; block: boolean; money: boolean };
  dragId: string | null;
  onFree: (laneId: string) => void;
  onOpen: (b: Booking) => void;
  onDragStart: (id: string | null) => void;
  onDrop: (laneId: string) => void;
  onBlockClick: (b: Block) => void;
}) {
  const [over, setOver] = useState<string | null>(null);
  const start = new Date(slot).getTime();
  return (
    <>
      <div className="tm">{formatHm(new Date(slot))}</div>
      {lanes.map((l) => {
        const booking = day.bookings.find((b) => b.laneId === l.id && new Date(b.startAt).getTime() === start && b.status !== "CANCELLED");
        const block = day.blocks.find((b) => b.laneId === l.id && new Date(b.startAt).getTime() < start + HOUR && new Date(b.endAt).getTime() > start);
        const free = !booking && !block && !past;
        return (
          <div
            key={l.id}
            className={`cell${free ? " free" : ""}${past && !booking ? " past" : ""}${over === l.id && free && dragId ? " drop-ok" : ""}`}
            onClick={() => free && onFree(l.id)}
            onDragOver={(e) => {
              if (free && dragId) {
                e.preventDefault();
                setOver(l.id);
              }
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              if (free) onDrop(l.id);
            }}
            role={free ? "button" : undefined}
            aria-label={free ? `จอง ${l.name} ${formatHm(new Date(slot))}` : undefined}
          >
            {booking && (
              <div
                className={`bk ${booking.status}`}
                draggable={can.manage && (booking.status === "CONFIRMED" || booking.status === "HELD")}
                onDragStart={() => onDragStart(booking.id)}
                onDragEnd={() => onDragStart(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(booking);
                }}
              >
                <span className="n">
                  {booking.status === "HELD" ? "กำลังจอง…" : booking.name}
                  <span className="src">{SOURCE_LABEL[booking.source]}</span>
                </span>
                <span className="m">
                  {booking.partySize} คน · {BOOKING_STATUS[booking.status]?.label}
                  {can.money && booking.paidSatang !== null ? ` · จ่าย ${formatBaht(booking.paidSatang)}` : ""}
                </span>
              </div>
            )}
            {!booking && block && (
              <div className="blk" onClick={(e) => { e.stopPropagation(); onBlockClick(block); }} title={can.block ? "คลิกเพื่อเปิดให้จองอีกครั้ง" : undefined}>
                {BLOCK_LABEL[block.reason]}{block.note ? ` · ${block.note}` : ""}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function MemberPicker({ value, onChange }: { value: MemberHit | null; onChange: (m: MemberHit | null) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<MemberHit[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) return setHits([]);
    const t = setTimeout(() => {
      api<{ rows: MemberHit[] }>(`/api/members/search?q=${encodeURIComponent(q.trim())}`).then((d) => setHits(d.rows)).catch(() => setHits([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);
  if (value) {
    return (
      <div className="picker-item on" style={{ cursor: "default" }}>
        <span><b>{value.name}</b> <span className="muted mono small">{value.code} · {formatPhone(value.phone)}</span></span>
        <button type="button" className="link-btn" onClick={() => onChange(null)}>เปลี่ยน</button>
      </div>
    );
  }
  return (
    <>
      <input className="link-input" style={{ width: "100%" }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาสมาชิก: ชื่อ เบอร์ หรือรหัส" />
      {hits.length > 0 && (
        <div className="picker-list">
          {hits.map((h) => (
            <button type="button" key={h.id} className="picker-item" onClick={() => onChange(h)}>
              <span><b>{h.name}</b> <span className="muted mono small">{h.code} · {formatPhone(h.phone)}</span></span>
              <span className="small muted">{h.tier}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function CreateDialog({
  lane,
  startAt,
  presetMember,
  now,
  onClose,
  onDone,
}: {
  lane: Lane;
  startAt: string;
  presetMember: MemberHit | null;
  now: number;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const current = new Date(startAt).getTime() <= now;
  const [who, setWho] = useState<"member" | "guest">(presetMember ? "member" : "guest");
  const [member, setMember] = useState<MemberHit | null>(presetMember);
  const [guest, setGuest] = useState({ name: "", phone: "" });
  const [source, setSource] = useState<"WALKIN" | "PHONE">(current ? "WALKIN" : "PHONE");
  const [party, setParty] = useState(1);
  const [note, setNote] = useState("");
  const [checkIn, setCheckIn] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/booking", {
        body: {
          laneId: lane.id,
          startAt,
          partySize: party,
          source,
          memberId: who === "member" ? member?.id : null,
          guestName: who === "guest" ? guest.name : null,
          guestPhone: who === "guest" ? guest.phone : null,
          note,
          checkInNow: checkIn,
        },
      });
      onDone(checkIn ? "จองและเช็กอินแล้ว" : who === "member" && member?.hasLine ? "จองแล้ว · ลูกค้าได้ข้อความยืนยันใน LINE" : "จองแล้ว");
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Modal title={`จอง ${lane.name}`} sub={`${formatThaiDate(new Date(startAt), { weekday: true })} · ${formatHm(new Date(startAt))} น. · ${formatBaht(lane.hourlyPriceSatang)}/ชม. ก่อนส่วนลดสมาชิก`} onClose={onClose}>
      <div className="row" style={{ marginBottom: 12 }}>
        <button type="button" className={`chip${source === "WALKIN" ? " chip-on" : ""}`} onClick={() => setSource("WALKIN")}>Walk-in</button>
        <button type="button" className={`chip${source === "PHONE" ? " chip-on" : ""}`} onClick={() => setSource("PHONE")}>โทรจอง</button>
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <button type="button" className={`chip${who === "member" ? " chip-on" : ""}`} onClick={() => setWho("member")}>สมาชิก</button>
        <button type="button" className={`chip${who === "guest" ? " chip-on" : ""}`} onClick={() => setWho("guest")}>ไม่ใช่สมาชิก</button>
      </div>
      {who === "member" ? (
        <div style={{ marginBottom: 14 }}>
          <MemberPicker value={member} onChange={setMember} />
        </div>
      ) : (
        <div className="form-grid">
          <label className="field"><span>ชื่อลูกค้า <b>*</b></span><input value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} /></label>
          <label className="field"><span>เบอร์โทร <span className="hint">— ถ้าเป็นเบอร์สมาชิก ระบบผูกให้เอง</span></span><input value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} inputMode="tel" /></label>
        </div>
      )}
      <label className="field">
        <span>จำนวนคน</span>
        <select value={party} onChange={(e) => setParty(Number(e.target.value))}>
          {Array.from({ length: lane.capacity }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n} คน</option>
          ))}
        </select>
      </label>
      <label className="field"><span>หมายเหตุ</span><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} /></label>
      <label className="checkline"><input type="checkbox" checked={checkIn} onChange={(e) => setCheckIn(e.target.checked)} /> เช็กอินเลย (ลูกค้าอยู่ที่ร้าน)</label>
      {error && <p className="form-error" style={{ marginTop: 10 }}>{error}</p>}
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
        <button className="btn" disabled={busy || (who === "member" ? !member : !guest.name.trim())} onClick={submit}>{busy ? "กำลังจอง…" : "ยืนยันการจอง"}</button>
      </div>
    </Modal>
  );
}

function BookingDialog({
  booking: b,
  lanes,
  slots,
  can,
  now,
  noShowGraceMinutes,
  onClose,
  onDone,
}: {
  booking: Booking;
  lanes: Lane[];
  slots: string[];
  can: { manage: boolean; block: boolean; money: boolean };
  now: number;
  noShowGraceMinutes: number;
  onClose: () => void;
  onDone: (msg?: string) => void;
}) {
  const [paid, setPaid] = useState(b.paidSatang !== null ? String(b.paidSatang / 100) : String(b.priceSatang / 100));
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"main" | "cancel" | "move">("main");
  const [to, setTo] = useState({ laneId: b.laneId, startAt: b.startAt });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = new Date(b.startAt).getTime();
  const canNoShow = b.status === "CONFIRMED" && now >= start + noShowGraceMinutes * 60_000;
  const active = b.status === "CONFIRMED" || b.status === "HELD" || b.status === "CHECKED_IN";

  const act = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/booking/${b.id}`, { method: "PATCH", body });
      onDone(msg);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Modal title={b.status === "HELD" ? "ลูกค้ากำลังยืนยันการจอง" : b.name} sub={`${b.laneName} · ${formatThaiDate(new Date(b.startAt), { weekday: true })} ${formatHm(new Date(b.startAt))}–${formatHm(new Date(b.endAt))} น.`} onClose={onClose}>
      <dl className="kv">
        <dt>สถานะ</dt>
        <dd><span className={`pill ${BOOKING_STATUS[b.status]?.tone}`}>{BOOKING_STATUS[b.status]?.label}</span></dd>
        {b.memberCode && (
          <>
            <dt>สมาชิก</dt>
            <dd><Link href={`/members/${b.memberId}`}>{b.memberCode}</Link>{b.tier ? ` · ${b.tier}` : ""}</dd>
          </>
        )}
        <dt>เบอร์</dt>
        <dd className="mono">{formatPhone(b.phone)}</dd>
        <dt>จำนวนคน</dt>
        <dd>{b.partySize} คน</dd>
        <dt>ช่องทาง</dt>
        <dd>{SOURCE_LABEL[b.source]}</dd>
        {can.money && (
          <>
            <dt>ค่าบริการ</dt>
            <dd>{formatBaht(b.priceSatang)}{b.discountPct ? ` (ส่วนลดสมาชิก ${b.discountPct}%)` : ""}{b.paidSatang !== null ? ` · รับแล้ว ${formatBaht(b.paidSatang)}` : ""}</dd>
          </>
        )}
        {b.note && (
          <>
            <dt>หมายเหตุ</dt>
            <dd>{b.note}</dd>
          </>
        )}
      </dl>

      {can.manage && mode === "main" && active && (
        <>
          {(b.status === "CONFIRMED" || b.status === "CHECKED_IN") && (
            <div className="row" style={{ marginTop: 16, alignItems: "flex-end" }}>
              <label className="field" style={{ margin: 0, flex: 1 }}>
                <span>ยอดที่รับ (บาท)</span>
                <input inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} />
              </label>
              {b.status === "CONFIRMED" ? (
                <button className="btn" disabled={busy} onClick={() => act({ action: "checkin", paid }, `เช็กอิน ${b.name} แล้ว`)}>เช็กอิน</button>
              ) : (
                <button className="btn btn-ghost" disabled={busy} onClick={() => act({ action: "payment", paid }, "บันทึกยอดแล้ว")}>บันทึกยอด</button>
              )}
            </div>
          )}
          <div className="btn-row" style={{ justifyContent: "flex-start" }}>
            {(b.status === "CONFIRMED" || b.status === "HELD") && <button className="btn btn-ghost btn-sm" onClick={() => setMode("move")}>ย้ายเวลา / lane</button>}
            {canNoShow && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act({ action: "noshow" }, "บันทึกไม่มาตามนัดแล้ว")}>ไม่มาตามนัด</button>}
            <button className="btn btn-ghost btn-sm danger-text" onClick={() => setMode("cancel")}>ยกเลิกการจอง</button>
          </div>
        </>
      )}

      {mode === "move" && (
        <div style={{ marginTop: 14 }}>
          <div className="form-grid">
            <label className="field">
              <span>Lane</span>
              <select value={to.laneId} onChange={(e) => setTo({ ...to, laneId: e.target.value })}>
                {lanes.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>เวลา (วันเดียวกัน)</span>
              <select value={to.startAt} onChange={(e) => setTo({ ...to, startAt: e.target.value })}>
                {slots.map((s) => (
                  <option key={s} value={s}>{formatHm(new Date(s))}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted small">ย้ายไปวันอื่น: ยกเลิกแล้วจองใหม่ · ลากการ์ดในตารางก็ย้ายได้</p>
          <div className="btn-row">
            <button className="btn btn-ghost" onClick={() => setMode("main")}>กลับ</button>
            <button className="btn" disabled={busy} onClick={() => act({ action: "move", ...to }, "ย้ายการจองแล้ว")}>ย้าย</button>
          </div>
        </div>
      )}

      {mode === "cancel" && (
        <div style={{ marginTop: 14 }}>
          <label className="field"><span>เหตุผล <b>*</b> <span className="hint">— ส่งให้ลูกค้าใน LINE</span></span><input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <div className="btn-row">
            <button className="btn btn-ghost" onClick={() => setMode("main")}>กลับ</button>
            <button className="btn btn-danger" disabled={busy || !reason.trim()} onClick={() => act({ action: "cancel", reason }, "ยกเลิกการจองแล้ว")}>ยืนยันยกเลิก</button>
          </div>
        </div>
      )}

      {error && <p className="form-error" style={{ marginTop: 10 }}>{error}</p>}
      {b.status === "HELD" && <p className="muted small" style={{ marginTop: 12 }}>ลูกค้ามีเวลา 5 นาทีในการยืนยัน ถ้าไม่ยืนยันช่องจะว่างเอง</p>}
    </Modal>
  );
}

function BlockDialog({ lanes, date, onClose, onDone }: { lanes: Lane[]; date: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ laneId: lanes[0]?.id ?? "", date, from: "10:00", to: "12:00", reason: "MAINTENANCE", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iso = (d: string, hm: string) => new Date(`${d}T${hm}:00+07:00`).toISOString();
  return (
    <Modal title="ปิด lane" sub="ช่วงที่ปิด ลูกค้าจองไม่ได้ · ถ้ามีการจองอยู่ ต้องย้ายหรือยกเลิกก่อน" onClose={onClose}>
      <div className="form-grid">
        <label className="field">
          <span>Lane</span>
          <select value={f.laneId} onChange={(e) => setF({ ...f, laneId: e.target.value })}>
            {lanes.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
        <label className="field"><span>วันที่</span><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label className="field"><span>ตั้งแต่</span><input type="time" step={3600} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="field"><span>ถึง</span><input type="time" step={3600} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        <label className="field">
          <span>เหตุผล</span>
          <select value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })}>
            {Object.entries(BLOCK_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="field"><span>หมายเหตุ</span><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
        <button
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await api("/api/booking/blocks", { body: { laneId: f.laneId, startAt: iso(f.date, f.from), endAt: iso(f.date, f.to), reason: f.reason, note: f.note } });
              onDone();
            } catch (e) {
              setError(errorText(e));
              setBusy(false);
            }
          }}
        >
          {busy ? "กำลังบันทึก…" : "ปิด lane"}
        </button>
      </div>
    </Modal>
  );
}

