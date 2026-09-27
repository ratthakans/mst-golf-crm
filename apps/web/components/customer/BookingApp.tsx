"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconClock, IconMinus, IconPlus, IconUsers } from "@/components/icons";
import { api, looksLikeLineApp } from "@/lib/client";
import { addDaysToKey, formatBaht, formatHm, formatThaiDate, keyLongLabel, keyParts } from "@/lib/format";
import type { AvailabilityData, BookingRow, SlotState } from "@/lib/types";
import { Sheet } from "./Sheet";

interface Rules {
  holdMinutes: number;
  cancelHoursBefore: number;
  reminderHoursBefore: number;
  maxSlotsPerDay: number;
}

interface Props {
  todayKey: string;
  initialDate: string;
  daysAhead: number;
  tierName: string;
  simDiscountPct: number;
  initial: AvailabilityData | null;
  unavailable: string | null;
  bookings: { upcoming: BookingRow[]; past: BookingRow[] };
  rules: Rules;
  storeName: string;
}

type View = "grid" | "confirm" | "done";
type Msg = { kind: "info" | "warn" | "error"; text: string } | null;
interface Pick {
  laneId: string;
  laneName: string;
  capacity: number;
  hourlyPriceSatang: number;
  startAt: string;
  label: string;
}

const STATE_TEXT: Record<SlotState, string> = { free: "ว่าง", taken: "เต็ม", blocked: "ปิด", past: "ผ่านไปแล้ว", closed: "ปิด" };
const STATUS_TEXT: Record<BookingRow["status"], string> = {
  HELD: "รอยืนยัน",
  CONFIRMED: "ยืนยันแล้ว",
  CHECKED_IN: "เช็กอินแล้ว",
  COMPLETED: "เล่นแล้ว",
  NO_SHOW: "ไม่มาตามนัด",
  CANCELLED: "ยกเลิกแล้ว",
};

const hoursText = (h: number) => (Number.isInteger(h) ? `${h} ชม.` : `${Math.round(h * 60)} นาที`);
const priceAfter = (hourly: number, pct: number) => Math.round((hourly * (100 - pct)) / 100);
const when = (b: { startAt: string; endAt: string }) =>
  `${formatThaiDate(new Date(b.startAt), { weekday: true, year: false })} · ${formatHm(new Date(b.startAt))}–${formatHm(new Date(b.endAt))}`;

export function BookingApp(props: Props) {
  const { todayKey, daysAhead, tierName, simDiscountPct, rules, storeName } = props;
  const days = useMemo(() => Array.from({ length: daysAhead + 1 }, (_, i) => addDaysToKey(todayKey, i)), [todayKey, daysAhead]);

  const [view, setView] = useState<View>("grid");
  const [date, setDate] = useState(props.initialDate);
  const [avail, setAvail] = useState<AvailabilityData | null>(props.initial);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(props.unavailable);
  const [msg, setMsg] = useState<Msg>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [party, setParty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [hold, setHold] = useState<BookingRow | null>(null);
  const [skew, setSkew] = useState(0);
  const [done, setDone] = useState<BookingRow | null>(null);
  const [mine, setMine] = useState(props.bookings);
  // The customer's own upcoming bookings, so their slots read "ของคุณ" rather than "เต็ม".
  const mineKeys = useMemo(
    () => new Set(mine.upcoming.filter((b) => b.status !== "CANCELLED").map((b) => `${b.laneId}|${new Date(b.startAt).getTime()}`)),
    [mine],
  );
  const [cancelTarget, setCancelTarget] = useState<BookingRow | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const reqId = useRef(0);
  const topRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (key: string, quiet = false) => {
    const id = ++reqId.current;
    if (!quiet) setLoading(true);
    const res = await api<AvailabilityData>(`/api/me/availability?date=${key}`);
    if (id !== reqId.current) return;
    setLoading(false);
    if (res.ok) {
      setAvail(res.data);
      setLoadError(null);
    } else if (!quiet) {
      setLoadError(res.error);
    }
  }, []);

  const loadMine = useCallback(async () => {
    const res = await api<{ upcoming: BookingRow[]; past: BookingRow[] }>("/api/me/bookings");
    if (res.ok) setMine(res.data);
  }, []);

  const chooseDate = (key: string) => {
    setDate(key);
    setMsg(null);
    void load(key);
  };

  // Keep the grid fresh: on focus and once a minute while looking at it.
  useEffect(() => {
    if (view !== "grid") return;
    const refresh = () => document.visibilityState === "visible" && void load(date, true);
    const t = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", refresh);
    };
  }, [view, date, load]);

  // Leaving the page mid-confirmation frees the slot straight away.
  useEffect(() => {
    if (view !== "confirm" || !hold) return;
    const release = () => navigator.sendBeacon?.(`/api/me/bookings/${hold.id}/release`);
    window.addEventListener("pagehide", release);
    return () => window.removeEventListener("pagehide", release);
  }, [view, hold]);

  const openPick = (p: Pick) => {
    setPick(p);
    setParty((n) => Math.min(Math.max(1, n), p.capacity));
    setSheetError(null);
  };

  const backToGrid = (m: Msg) => {
    setView("grid");
    setHold(null);
    setMsg(m);
    void load(date, true);
    topRef.current?.scrollIntoView({ block: "start" });
  };

  const doHold = async () => {
    if (!pick) return;
    setBusy(true);
    setSheetError(null);
    const res = await api<{ booking: BookingRow }>("/api/me/bookings/hold", {
      method: "POST",
      body: { laneId: pick.laneId, startAt: pick.startAt, partySize: party, inLine: looksLikeLineApp() },
    });
    setBusy(false);
    if (res.ok) {
      setSkew(res.serverDate ? res.serverDate - Date.now() : 0);
      setHold(res.data.booking);
      setPick(null);
      setView("confirm");
      window.scrollTo({ top: 0 });
      return;
    }
    if (res.code === "SLOT_TAKEN" || res.code === "SLOT_UNAVAILABLE") {
      setPick(null);
      setMsg({ kind: "warn", text: res.error });
      void load(date, true);
      return;
    }
    setSheetError(res.error);
  };

  const doConfirm = async () => {
    if (!hold) return;
    setBusy(true);
    const res = await api<{ booking: BookingRow }>(`/api/me/bookings/${hold.id}/confirm`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      setDone(res.data.booking);
      setHold(null);
      setView("done");
      window.scrollTo({ top: 0 });
      void loadMine();
      void load(date, true);
      return;
    }
    if (res.code === "HOLD_EXPIRED" || res.code === "NOT_FOUND") {
      backToGrid({ kind: "warn", text: res.error });
      return;
    }
    setMsg({ kind: "error", text: res.error });
  };

  const doRelease = async () => {
    if (!hold) return;
    const id = hold.id;
    backToGrid(null);
    await api(`/api/me/bookings/${id}/release`, { method: "POST" });
    void load(date, true);
  };

  const onExpire = useCallback(() => {
    backToGrid({ kind: "warn", text: "หมดเวลายืนยัน ช่องนี้หลุดแล้ว กรุณาเลือกใหม่" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const doCancel = async () => {
    if (!cancelTarget) return;
    setBusy(true);
    setCancelError(null);
    const res = await api<{ booking: BookingRow }>(`/api/me/bookings/${cancelTarget.id}/cancel`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      setCancelTarget(null);
      setMsg({ kind: "info", text: "ยกเลิกการจองแล้ว ช่องเวลานี้ว่างให้คนอื่นจองได้ทันที" });
      void loadMine();
      void load(date, true);
    } else {
      setCancelError(res.error);
    }
  };

  // ------------------------------------------------------------------ views

  if (view === "confirm" && hold) {
    const full = hold.discountPct ? Math.round((hold.priceSatang * 100) / (100 - hold.discountPct)) : hold.priceSatang;
    return (
      <section className="panel confirm" aria-labelledby="confirm-h">
        <h1 id="confirm-h" className="panel-title">
          ยืนยันการจอง
        </h1>
        <Countdown until={hold.heldUntil} skew={skew} onExpire={onExpire} />
        <dl className="summary">
          <div>
            <dt>วัน</dt>
            <dd>{formatThaiDate(new Date(hold.startAt), { weekday: true })}</dd>
          </div>
          <div>
            <dt>เวลา</dt>
            <dd className="num">
              {formatHm(new Date(hold.startAt))}–{formatHm(new Date(hold.endAt))}
            </dd>
          </div>
          <div>
            <dt>Lane</dt>
            <dd>{hold.laneName}</dd>
          </div>
          <div>
            <dt>จำนวนคน</dt>
            <dd className="num">{hold.partySize} คน</dd>
          </div>
          <div className="summary-price">
            <dt>ราคา</dt>
            <dd className="num">
              {hold.discountPct > 0 && <s>{formatBaht(full)}</s>} <b>{formatBaht(hold.priceSatang)}</b>
              {hold.discountPct > 0 && (
                <small>
                  ส่วนลดระดับ {tierName} {hold.discountPct}%
                </small>
              )}
            </dd>
          </div>
        </dl>
        <p className="notice">
          <span>
            <b>ชำระเงินที่ร้านตอนเช็กอิน</b> ไม่ต้องจ่ายออนไลน์ · {storeName}
          </span>
        </p>
        {msg && msg.kind === "error" && (
          <p className="notice notice-error" role="alert">
            {msg.text}
          </p>
        )}
        <div className="stack">
          <button type="button" className="btn btn-primary btn-block" onClick={() => void doConfirm()} disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            <span>{busy ? "กำลังยืนยัน…" : "ยืนยันการจอง"}</span>
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => void doRelease()} disabled={busy}>
            ยกเลิก เลือกเวลาอื่น
          </button>
        </div>
      </section>
    );
  }

  if (view === "done" && done) {
    return (
      <section className="panel welcome" aria-live="polite">
        <span className="welcome-mark" aria-hidden="true">
          <IconCheck size={28} />
        </span>
        <h1>จองสำเร็จ</h1>
        <p className="done-when num">{when(done)}</p>
        <p className="muted">
          {done.laneName} · {done.partySize} คน · {formatBaht(done.priceSatang)} ชำระที่ร้าน
        </p>
        <p className="notice">
          <span>ได้ข้อความยืนยันใน LINE และเตือนก่อนเวลา {hoursText(rules.reminderHoursBefore)}</span>
        </p>
        <div className="stack">
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => {
              setView("grid");
              setMsg(null);
              window.setTimeout(() => document.getElementById("mine")?.scrollIntoView({ block: "start" }), 0);
            }}
          >
            ดูการจองของฉัน
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => {
              setView("grid");
              setMsg(null);
            }}
          >
            จองเพิ่ม
          </button>
        </div>
      </section>
    );
  }

  const allPast = !!avail && avail.open && avail.slots.length > 0 && avail.slots.every((s) => s.lanes.every((l) => l.state === "past"));

  return (
    <div className="booking" ref={topRef}>
      <div className="booking-head">
        <h1 className="panel-title">จองซิมกอล์ฟ</h1>
        <p className="muted">
          เลือกวันและช่องที่ว่าง · ระดับ {tierName} จองล่วงหน้าได้ {daysAhead} วัน
          {simDiscountPct > 0 ? ` · ส่วนลด ${simDiscountPct}%` : ""}
        </p>
      </div>

      <div className="days" role="group" aria-label="เลือกวัน">
        {days.map((k, i) => {
          const p = keyParts(k);
          const showMonth = i === 0 || p.day === 1;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={date === k}
              aria-label={`${keyLongLabel(k)}${i === 0 ? " (วันนี้)" : ""}`}
              className="day"
              onClick={() => chooseDate(k)}
            >
              <span className="day-wd">{i === 0 ? "วันนี้" : p.weekday}</span>
              <span className="day-num num">{p.day}</span>
              <span className="day-mo">{showMonth ? p.month : " "}</span>
            </button>
          );
        })}
      </div>

      {msg && (
        <p className={`notice ${msg.kind === "warn" ? "notice-warn" : msg.kind === "error" ? "notice-error" : ""}`} role="status">
          <span>{msg.text}</span>
        </p>
      )}

      <section className="grid-wrap" aria-labelledby="grid-h" aria-busy={loading}>
        <h2 id="grid-h" className="visually-hidden">
          ช่องเวลา{keyLongLabel(date)}
        </h2>
        {loadError ? (
          <div className="notice notice-error" role="alert">
            <span>{loadError}</span>
            <button type="button" className="text-link" onClick={() => void load(date)}>
              ลองอีกครั้ง
            </button>
          </div>
        ) : !avail ? (
          <div className="skeleton" style={{ height: 320 }} />
        ) : !avail.open ? (
          <p className="empty">ร้านปิด{keyLongLabel(date)} เลือกวันอื่นได้เลย</p>
        ) : (
          <>
            <div className={`slots${loading ? " is-loading" : ""}`} style={{ gridTemplateColumns: `56px repeat(${avail.lanes.length}, minmax(0, 1fr))` }}>
              <span className="slots-corner" aria-hidden="true" />
              {avail.lanes.map((l) => (
                <span key={l.id} className="slots-lane">
                  {l.name}
                </span>
              ))}
              {avail.slots.map((s) => (
                <SlotRow key={s.startAt} slot={s} avail={avail} mine={mineKeys} onPick={openPick} />
              ))}
            </div>
            {allPast && <p className="hint center">ช่วงเวลาของวันนี้ผ่านไปหมดแล้ว เลือกวันถัดไปได้เลย</p>}
            <ul className="legend" aria-label="คำอธิบายสี">
              <li>
                <i className="lg-free" /> ว่าง
              </li>
              <li>
                <i className="lg-taken" /> เต็ม
              </li>
              {mineKeys.size > 0 && (
                <li>
                  <i className="lg-mine" /> ของคุณ
                </li>
              )}
              <li>
                <i className="lg-blocked" /> ปิด
              </li>
            </ul>
          </>
        )}
        <p className="pay-note">
          <b>ชำระเงินที่ร้านตอนเช็กอิน</b> · ครั้งละ 1 ชั่วโมง จองได้ไม่เกิน {rules.maxSlotsPerDay} ช่องต่อวัน · ยกเลิกเองได้ก่อนเวลา{" "}
          {hoursText(rules.cancelHoursBefore)}
        </p>
      </section>

      <section id="mine" className="mine-list" aria-labelledby="mine-h">
        <h2 id="mine-h">การจองของฉัน</h2>
        {mine.upcoming.length === 0 ? (
          <p className="empty">ยังไม่มีการจองที่จะถึง</p>
        ) : (
          <ul className="bk-list">
            {mine.upcoming.map((b) => (
              <li key={b.id} className="bk">
                <div className="bk-main">
                  <p className="bk-when num">{when(b)}</p>
                  <p className="bk-sub">
                    {b.laneName} · {b.partySize} คน · {formatBaht(b.priceSatang)} · <span className="badge">{STATUS_TEXT[b.status]}</span>
                  </p>
                  {!b.canCancel && b.status === "CONFIRMED" && (
                    <p className="hint">ยกเลิกได้ก่อนเวลา {hoursText(rules.cancelHoursBefore)} — ติดต่อร้าน</p>
                  )}
                </div>
                {b.canCancel && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setCancelError(null);
                      setCancelTarget(b);
                    }}
                  >
                    ยกเลิก
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {mine.past.length > 0 && (
          <details className="past">
            <summary>ประวัติการจอง ({mine.past.length})</summary>
            <ul className="bk-list">
              {mine.past.map((b) => (
                <li key={b.id} className="bk past-row">
                  <div className="bk-main">
                    <p className="bk-when num">{when(b)}</p>
                    <p className="bk-sub">
                      {b.laneName} · {b.partySize} คน · <span className={`badge badge-${b.status.toLowerCase()}`}>{STATUS_TEXT[b.status]}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {pick && (
        <Sheet
          title={`${pick.laneName} · ${pick.label}`}
          onClose={() => setPick(null)}
          footer={
            <>
              {sheetError && (
                <p className="field-error" role="alert">
                  {sheetError}
                </p>
              )}
              <button type="button" className="btn btn-primary btn-block" onClick={() => void doHold()} disabled={busy}>
                {busy && <span className="spinner" aria-hidden="true" />}
                <span>{busy ? "กำลังกันช่อง…" : "ต่อไป · ยืนยันการจอง"}</span>
              </button>
            </>
          }
        >
          <p className="sheet-when">{keyLongLabel(date)}</p>
          <div className="party">
            <span className="party-label">
              <IconUsers />
              จำนวนคน
            </span>
            <div className="stepper">
              <button type="button" className="step-btn" onClick={() => setParty((n) => Math.max(1, n - 1))} disabled={party <= 1} aria-label="ลดจำนวนคน">
                <IconMinus />
              </button>
              <output className="step-val num" aria-live="polite">
                {party}
              </output>
              <button
                type="button"
                className="step-btn"
                onClick={() => setParty((n) => Math.min(pick.capacity, n + 1))}
                disabled={party >= pick.capacity}
                aria-label="เพิ่มจำนวนคน"
              >
                <IconPlus />
              </button>
            </div>
          </div>
          <p className="hint">สูงสุด {pick.capacity} คนต่อ lane ราคาเท่ากันไม่ว่ามากี่คน</p>
          <div className="price-row">
            <span>ราคา 1 ชั่วโมง</span>
            <span className="num">
              {simDiscountPct > 0 && <s>{formatBaht(pick.hourlyPriceSatang)}</s>} <b>{formatBaht(priceAfter(pick.hourlyPriceSatang, simDiscountPct))}</b>
            </span>
          </div>
          {simDiscountPct > 0 && <p className="hint">ส่วนลดระดับ {tierName} {simDiscountPct}% คิดให้แล้ว</p>}
          <p className="hint">
            <IconClock size={14} /> ระบบกันช่องไว้ให้ {rules.holdMinutes} นาทีระหว่างยืนยัน · ชำระเงินที่ร้าน
          </p>
        </Sheet>
      )}

      {cancelTarget && (
        <Sheet
          title="ยกเลิกการจองนี้?"
          onClose={() => setCancelTarget(null)}
          footer={
            <>
              {cancelError && (
                <p className="field-error" role="alert">
                  {cancelError}
                </p>
              )}
              <button type="button" className="btn btn-danger btn-block" onClick={() => void doCancel()} disabled={busy}>
                {busy && <span className="spinner" aria-hidden="true" />}
                <span>ยกเลิกการจอง</span>
              </button>
              <button type="button" className="btn btn-secondary btn-block" onClick={() => setCancelTarget(null)} disabled={busy}>
                ไม่ยกเลิก
              </button>
            </>
          }
        >
          <p className="bk-when num">{when(cancelTarget)}</p>
          <p className="muted">
            {cancelTarget.laneName} · {cancelTarget.partySize} คน
          </p>
          <p className="hint" style={{ marginTop: 12 }}>
            ช่องเวลานี้จะว่างให้คนอื่นจองทันที และคุณจะได้ข้อความแจ้งการยกเลิกใน LINE
          </p>
        </Sheet>
      )}
    </div>
  );
}

function SlotRow({ slot, avail, mine, onPick }: { slot: AvailabilityData["slots"][number]; avail: AvailabilityData; mine: Set<string>; onPick: (p: Pick) => void }) {
  return (
    <>
      <span className="slots-time num">{slot.label}</span>
      {slot.lanes.map((cell) => {
        const lane = avail.lanes.find((l) => l.id === cell.laneId);
        if (!lane) return <span key={cell.laneId} />;
        const free = cell.state === "free";
        const own = cell.state === "taken" && mine.has(`${cell.laneId}|${new Date(slot.startAt).getTime()}`);
        const text = own ? "ของคุณ" : STATE_TEXT[cell.state];
        return (
          <button
            key={cell.laneId}
            type="button"
            className={`slot slot-${own ? "mine" : cell.state}`}
            disabled={!free}
            aria-label={`${lane.name} ${slot.label} น. ${text}`}
            onClick={() =>
              onPick({
                laneId: lane.id,
                laneName: lane.name,
                capacity: lane.capacity,
                hourlyPriceSatang: lane.hourlyPriceSatang,
                startAt: slot.startAt,
                label: `${slot.label}–${formatHm(new Date(new Date(slot.startAt).getTime() + 60 * 60_000))}`,
              })
            }
          >
            {cell.state === "past" ? "—" : text}
          </button>
        );
      })}
    </>
  );
}

function Countdown({ until, skew, onExpire }: { until: string | null; skew: number; onExpire: () => void }) {
  const end = until ? new Date(until).getTime() : 0;
  const left = () => Math.max(0, end - (Date.now() + skew));
  const [ms, setMs] = useState(left);
  const fired = useRef(false);

  useEffect(() => {
    const t = window.setInterval(() => {
      const v = left();
      setMs(v);
      if (v <= 0 && !fired.current) {
        fired.current = true;
        onExpire();
      }
    }, 250);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end, skew]);

  const s = Math.ceil(ms / 1000);
  const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return (
    <div className={`countdown${s <= 60 ? " low" : ""}`} role="timer" aria-live="off">
      <IconClock size={18} />
      <span>
        กันช่องไว้ให้อีก <b className="num">{text}</b> นาที
      </span>
    </div>
  );
}
