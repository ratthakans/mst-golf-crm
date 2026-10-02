"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconArrow, IconCalendar, IconClose, IconGift, IconSun } from "@/components/icons";
import { api } from "@/lib/client";
import { formatBahtWhole, formatPoints, formatThaiDate } from "@/lib/format";
import type { CardData, PointRow } from "@/lib/types";

type Tab = "card" | "points" | "profile";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "card", label: "บัตรสมาชิก" },
  { key: "points", label: "แต้ม" },
  { key: "profile", label: "โปรไฟล์" },
];

interface Props {
  card: CardData;
  points: PointRow[];
  qrSrc: string;
  topTierName: string | null;
}

export function MemberView({ card: initialCard, points: initialPoints, qrSrc, topTierName }: Props) {
  const [card, setCard] = useState(initialCard);
  const [points, setPoints] = useState(initialPoints);
  const [tab, setTab] = useState<Tab>("card");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "points" || t === "profile") setTab(t);
  }, []);

  const choose = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "card") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url);
    if (t === "points") void refreshPoints();
  };

  const refreshPoints = async () => {
    const res = await api<{ balance: number; items: PointRow[] }>("/api/me/points");
    if (res.ok) {
      setPoints(res.data.items);
      setCard((c) => ({ ...c, points: res.data.balance }));
    }
  };

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const n = (i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
    choose(TABS[n]!.key);
    tabRefs.current[n]?.focus();
  };

  return (
    <div className="member">
      <div className="tabs" role="tablist" aria-label="ข้อมูลสมาชิก">
        {TABS.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            className="tab"
            onClick={() => choose(t.key)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tab-panel">
        {tab === "card" && <CardPanel card={card} qrSrc={qrSrc} topTierName={topTierName} />}
        {tab === "points" && <PointsPanel card={card} points={points} />}
        {tab === "profile" && <ProfilePanel card={card} onSaved={setCard} />}
      </div>

      <div className="member-foot">
        <Link href="/app/rewards" className="row-link">
          <IconGift />
          <span>แลกรางวัลด้วยแต้ม · คูปองของฉัน</span>
          <IconArrow size={18} />
        </Link>
        <Link href="/app/booking" className="row-link">
          <IconCalendar />
          <span>การจองของฉัน · จองซิมกอล์ฟ</span>
          <IconArrow size={18} />
        </Link>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------- card

function tierClass(key: string) {
  return key === "gold" ? "gold" : key === "silver" ? "silver" : "member";
}

function CardPanel({ card, qrSrc, topTierName }: { card: CardData; qrSrc: string; topTierName: string | null }) {
  const [bright, setBright] = useState(false);
  const t = card.tier;
  const perks = [
    t.pointRate !== 1 ? `แต้ม ×${t.pointRate}` : null,
    t.discountPct ? `ส่วนลดสินค้า ${t.discountPct}%` : null,
    t.simDiscountPct ? `ส่วนลดซิม ${t.simDiscountPct}%` : null,
    `จองซิมล่วงหน้า ${t.bookingDaysAhead} วัน`,
  ].filter((p): p is string => !!p);

  return (
    <>
      <article className={`mcard mcard-${tierClass(card.tierKey)}`} aria-label={`บัตรสมาชิก ระดับ ${card.tierName}`}>
        <div className="mcard-top">
          <span className="mcard-mark">MST GOLF</span>
          <span className="mcard-tier">{card.tierName}</span>
        </div>
        <div className="mcard-mid">
          <div className="mcard-who">
            <p className="mcard-name">{card.name}</p>
            <p className="mcard-code num">{card.code}</p>
          </div>
          <button type="button" className="mcard-qr" onClick={() => setBright(true)} aria-label="แสดง QR เต็มจอ">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc} alt={`QR รหัสสมาชิก ${card.code}`} width={112} height={112} />
          </button>
        </div>
        <div className="mcard-points">
          <span>แต้มคงเหลือ</span>
          <b className="num">{formatPoints(card.points)}</b>
        </div>
      </article>

      <button type="button" className="btn btn-secondary btn-block bright-btn" onClick={() => setBright(true)}>
        <IconSun />
        <span>เพิ่มความสว่าง · แสดง QR ที่เคาน์เตอร์</span>
      </button>

      <section className="progress-block" aria-label="ความคืบหน้าระดับสมาชิก">
        {card.next ? (
          <>
            <div className="progress-head">
              <span>
                อีก <b className="num">{formatBahtWhole(card.next.remainingBaht)}</b> ถึง {card.next.name}
              </span>
              <span className="num muted">{Math.round(card.next.pct * 100)}%</span>
            </div>
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(card.next.pct * 100)}>
              <i style={{ transform: `scaleX(${Math.max(0.02, card.next.pct)})` }} />
            </div>
            <p className="hint">ยอดซื้อสะสม 12 เดือนล่าสุด {formatBahtWhole(card.spend12mBaht)} · ระดับคิดจากยอดซื้อ ไม่ใช่แต้ม</p>
          </>
        ) : (
          <p className="progress-top">
            คุณอยู่ระดับสูงสุด{topTierName ? ` (${topTierName})` : ""} · ยอดซื้อสะสม 12 เดือน {formatBahtWhole(card.spend12mBaht)}
          </p>
        )}
      </section>

      <section className="perks" aria-label="สิทธิ์ของระดับนี้">
        <h2>สิทธิ์ระดับ {card.tierName}</h2>
        <ul>
          {perks.map((p) => (
            <li key={p}>{p}</li>
          ))}
          {t.birthdayMultiplier > 1 && (
            <li>{card.birthday ? `แต้ม ×${t.birthdayMultiplier} ทุกการซื้อในเดือนเกิด` : `ใส่วันเกิดในโปรไฟล์ เพื่อรับแต้ม ×${t.birthdayMultiplier} ในเดือนเกิด`}</li>
          )}
        </ul>
        <p className="hint">ส่วนลดสินค้าใช้ที่หน้าร้าน แสดงบัตรนี้กับพนักงานตอนชำระเงิน</p>
      </section>

      {bright && <BrightQr qrSrc={qrSrc} card={card} onClose={() => setBright(false)} />}
    </>
  );
}

function BrightQr({ qrSrc, card, onClose }: { qrSrc: string; card: CardData; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Keep the screen awake while the cashier scans (where the browser allows it).
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock
      ?.request("screen")
      .then((l) => {
        lock = l;
      })
      .catch(() => undefined);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      void lock?.release().catch(() => undefined);
    };
  }, [onClose]);

  return (
    <div className="bright" role="dialog" aria-modal="true" aria-label="QR รหัสสมาชิก">
      <button ref={closeRef} type="button" className="icon-btn bright-close" onClick={onClose} aria-label="ปิด">
        <IconClose size={24} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrSrc} alt={`QR รหัสสมาชิก ${card.code}`} className="bright-qr" width={320} height={320} />
      <p className="bright-code num">{card.code}</p>
      <p className="bright-name">
        {card.name} · {card.tierName}
      </p>
      <p className="hint">เพิ่มความสว่างหน้าจอให้สูงสุด แล้วยื่นให้พนักงานสแกน</p>
    </div>
  );
}

// ------------------------------------------------------------------- points

function PointsPanel({ card, points }: { card: CardData; points: PointRow[] }) {
  return (
    <section>
      <div className="balance">
        <span>แต้มคงเหลือ</span>
        <b className="num">{formatPoints(card.points)}</b>
      </div>
      {points.length === 0 ? (
        <p className="empty">ยังไม่มีรายการแต้ม แจ้งเบอร์มือถือหรือแสดง QR ตอนชำระเงินที่ร้านเพื่อสะสมแต้ม</p>
      ) : (
        <ol className="ledger">
          {points.map((p) => {
            const where = [p.storeName, p.invoiceNo ? `บิล ${p.invoiceNo}` : null].filter(Boolean).join(" · ");
            return (
              <li key={p.id} className="ledger-row">
                <div className="ledger-what">
                  <span className="ledger-label">{p.label}</span>
                  <span className="ledger-sub">
                    <time dateTime={p.at}>{formatThaiDate(new Date(p.at))}</time>
                    {where ? ` · ${where}` : ""}
                  </span>
                  {p.note && <span className="ledger-sub">{p.note}</span>}
                </div>
                <span className={`ledger-delta num ${p.delta >= 0 ? "plus" : "minus"}`}>
                  {p.delta >= 0 ? "+" : "−"}
                  {formatPoints(Math.abs(p.delta))}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ profile

function ProfilePanel({ card, onSaved }: { card: CardData; onSaved: (c: CardData) => void }) {
  const [fullName, setFullName] = useState(card.name);
  const [email, setEmail] = useState(card.email ?? "");
  const [birthday, setBirthday] = useState(card.birthday ?? "");
  const [marketing, setMarketing] = useState(card.marketing);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const birthdayLocked = !!card.birthday;

  const dirty =
    fullName.trim() !== card.name || email.trim() !== (card.email ?? "") || marketing !== card.marketing || (!birthdayLocked && birthday !== "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (fullName.trim().length < 2) {
      setStatus({ kind: "error", text: "กรุณากรอกชื่อ-นามสกุล" });
      return;
    }
    setBusy(true);
    const body: Record<string, unknown> = { fullName, email: email.trim() || null, marketing };
    if (!birthdayLocked && birthday) body.birthday = birthday;
    const res = await api<{ member: CardData }>("/api/me/profile", { method: "PATCH", body });
    setBusy(false);
    if (res.ok) {
      onSaved(res.data.member);
      setBirthday(res.data.member.birthday ?? "");
      setStatus({ kind: "ok", text: "บันทึกแล้ว" });
    } else {
      setStatus({ kind: "error", text: res.error });
    }
  };

  return (
    <form className="form" onSubmit={save} noValidate>
      <div className="field">
        <label htmlFor="pf-name">ชื่อ-นามสกุล</label>
        <input id="pf-name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" maxLength={80} />
      </div>
      <div className="field">
        <label htmlFor="pf-phone">เบอร์มือถือ</label>
        <input id="pf-phone" className="input num" value={card.phone ?? "—"} readOnly aria-describedby="pf-phone-hint" />
        <p id="pf-phone-hint" className="hint">
          ติดต่อร้านเพื่อเปลี่ยนเบอร์
        </p>
      </div>
      <div className="field">
        <label htmlFor="pf-email">
          อีเมล <span className="optional">(ไม่บังคับ)</span>
        </label>
        <input id="pf-email" className="input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={120} />
      </div>
      <div className="field">
        <label htmlFor="pf-bday">วันเกิด</label>
        <input
          id="pf-bday"
          className="input"
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          readOnly={birthdayLocked}
          disabled={birthdayLocked}
          aria-describedby="pf-bday-hint"
        />
        <p id="pf-bday-hint" className="hint">
          {birthdayLocked ? "ตั้งวันเกิดแล้ว หากต้องการแก้ไขกรุณาติดต่อร้าน" : "ใส่ได้ครั้งเดียว เพื่อรับแต้ม ×2 ทุกการซื้อในเดือนเกิด"}
        </p>
      </div>
      <label className="switch">
        <span>
          <span className="switch-label">รับข่าวสารและโปรโมชั่น</span>
          <span className="hint">ทาง LINE และช่องทางอื่น เปลี่ยนใจได้ทุกเมื่อ</span>
        </span>
        <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
        <span className="track" aria-hidden="true" />
      </label>

      <div aria-live="polite">
        {status && <p className={status.kind === "ok" ? "notice" : "notice notice-error"}>{status.text}</p>}
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={busy || !dirty}>
        {busy && <span className="spinner" aria-hidden="true" />}
        <span>{busy ? "กำลังบันทึก…" : "บันทึก"}</span>
      </button>
      <p className="hint center">
        รหัสสมาชิก <span className="num">{card.code}</span> ·{" "}
        <Link href="/privacy">นโยบายความเป็นส่วนตัว</Link>
      </p>
    </form>
  );
}
