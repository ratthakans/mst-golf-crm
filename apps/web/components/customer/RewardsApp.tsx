"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconClose, IconGift } from "@/components/icons";
import { api } from "@/lib/client";
import { formatBaht, formatPoints, formatThaiDate } from "@/lib/format";
import type { RedemptionRow, RedemptionStatus, RewardItem, RewardsData } from "@/lib/types";
import { Sheet } from "./Sheet";

type Tab = "rewards" | "coupons" | "requests";
type Store = { id: string; name: string; address: string | null };

const STEPS: Array<{ status: RedemptionStatus; label: string }> = [
  { status: "SUBMITTED", label: "ได้รับคำขอ" },
  { status: "APPROVED", label: "อนุมัติ" },
  { status: "PROCESSING", label: "เตรียมของ" },
  { status: "SHIPPED", label: "จัดส่ง" },
  { status: "COMPLETED", label: "ได้รับแล้ว" },
];

const liveCoupon = (r: RedemptionRow) => r.kind === "COUPON" && r.status === "ISSUED";

export function RewardsApp({ initial, contact, stores }: { initial: RewardsData; contact: { name: string; phone: string }; stores: Store[] }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>("rewards");
  const [picked, setPicked] = useState<RewardItem | null>(null);
  const [coupon, setCoupon] = useState<RedemptionRow | null>(null);
  const [request, setRequest] = useState<RedemptionRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "coupons" || t === "requests") setTab(t);
  }, []);

  const choose = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "rewards") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url);
  };

  const coupons = data.redemptions.filter((r) => r.kind === "COUPON");
  const requests = data.redemptions.filter((r) => r.kind === "PHYSICAL");
  const usable = coupons.filter(liveCoupon).length;
  const openRequests = requests.filter((r) => !["COMPLETED", "REJECTED", "CANCELLED"].includes(r.status)).length;
  // The cheapest reward still out of reach: what the member is saving towards.
  const goal = data.items.filter((i) => i.shortBy > 0 && !i.blocked?.startsWith("หมด")).sort((a, b) => a.shortBy - b.shortBy)[0] ?? null;

  const onRedeemed = (next: RewardsData, result: { id: string; kind: string }) => {
    setData(next);
    setPicked(null);
    const r = next.redemptions.find((x) => x.id === result.id) ?? null;
    if (result.kind === "COUPON") {
      choose("coupons");
      setCoupon(r);
    } else {
      choose("requests");
      setRequest(r);
      setToast("ส่งคำขอแล้ว ทีมงานจะแจ้งความคืบหน้าทาง LINE");
    }
  };

  return (
    <div className="member rewards">
      <section className="rw-balance" aria-label="แต้มของฉัน">
        <div className="balance">
          <span>แต้มคงเหลือ</span>
          <b className="num">{formatPoints(data.balance)}</b>
        </div>
        {goal && (
          <div className="rw-goal">
            <div className="progress-head">
              <span>
                อีก <b className="num">{formatPoints(goal.shortBy)}</b> แต้ม แลก {goal.name}
              </span>
            </div>
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={goal.costPoints} aria-valuenow={data.balance}>
              <i style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, data.balance / goal.costPoints))})` }} />
            </div>
          </div>
        )}
      </section>

      <div className="tabs" role="tablist" aria-label="รางวัล">
        {(
          [
            ["rewards", "รางวัล"],
            ["coupons", `คูปอง${usable ? ` (${usable})` : ""}`],
            ["requests", `คำขอ${openRequests ? ` (${openRequests})` : ""}`],
          ] as Array<[Tab, string]>
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className="tab" onClick={() => choose(k)}>
            {label}
          </button>
        ))}
      </div>

      {toast && (
        <p className="notice" role="status">
          <span>{toast}</span>
        </p>
      )}

      {tab === "rewards" &&
        (data.items.length === 0 ? (
          <p className="empty">ยังไม่มีรางวัลให้แลกตอนนี้ สะสมแต้มไว้ก่อน รางวัลใหม่จะแจ้งทาง LINE</p>
        ) : (
          <ul className="rw-list">
            {data.items.map((i) => (
              <li key={i.id}>
                <button type="button" className={`rw-item${i.blocked ? " is-blocked" : ""}`} onClick={() => setPicked(i)}>
                  <RewardThumb item={i} />
                  <span className="rw-what">
                    <span className="rw-name">{i.name}</span>
                    <span className="rw-meta">{metaLine(i)}</span>
                    {i.blocked && <span className="rw-why">{i.blocked}</span>}
                  </span>
                  <span className="rw-cost num">
                    {formatPoints(i.costPoints)}
                    <small>แต้ม</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}

      {tab === "coupons" &&
        (coupons.length === 0 ? (
          <p className="empty">ยังไม่มีคูปอง แลกคูปองส่วนลดได้ที่แท็บ รางวัล</p>
        ) : (
          <ul className="rw-list">
            {coupons.map((c) => (
              <li key={c.id}>
                <button type="button" className={`rw-item rw-coupon${liveCoupon(c) ? "" : " is-done"}`} onClick={() => setCoupon(c)}>
                  <span className="rw-ticket num" aria-hidden="true">{c.valueSatang ? `฿${(c.valueSatang / 100).toLocaleString("en-US")}` : "฿"}</span>
                  <span className="rw-what">
                    <span className="rw-name">{c.rewardName}</span>
                    <span className="rw-meta">
                      {liveCoupon(c) && c.expiresAt ? `ใช้ได้ถึง ${formatThaiDate(new Date(c.expiresAt))}` : c.usedAt ? `ใช้เมื่อ ${formatThaiDate(new Date(c.usedAt))}` : c.statusLabel}
                    </span>
                  </span>
                  <span className={`badge${liveCoupon(c) ? "" : " badge-cancelled"}`}>{liveCoupon(c) ? "แสดง QR" : c.statusLabel}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}

      {tab === "requests" &&
        (requests.length === 0 ? (
          <p className="empty">ยังไม่มีคำขอแลกของรางวัล</p>
        ) : (
          <ul className="rw-list">
            {requests.map((r) => (
              <li key={r.id}>
                <button type="button" className="rw-item" onClick={() => setRequest(r)}>
                  <RewardThumb item={{ imageUrl: r.imageUrl, kind: r.kind, name: r.rewardName }} />
                  <span className="rw-what">
                    <span className="rw-name">{r.rewardName}</span>
                    <span className="rw-meta num">{r.code}</span>
                  </span>
                  <span className={`badge${["REJECTED", "CANCELLED"].includes(r.status) ? " badge-cancelled" : ""}`}>{r.statusLabel}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}

      <p className="hint center">แต้มใช้แลกแล้วหักทันที · ถ้าคำขอไม่ผ่านหรือยกเลิก แต้มคืนเต็มจำนวน</p>

      {picked && <RedeemSheet item={picked} balance={data.balance} contact={contact} stores={stores} onClose={() => setPicked(null)} onDone={onRedeemed} />}
      {coupon && <CouponSheet coupon={coupon} onClose={() => setCoupon(null)} />}
      {request && (
        <RequestSheet
          r={request}
          onClose={() => setRequest(null)}
          onCancelled={(next) => {
            setData(next);
            setRequest(null);
            setToast("ยกเลิกคำขอแล้ว แต้มคืนเข้าบัญชีเรียบร้อย");
          }}
        />
      )}
    </div>
  );
}

function metaLine(i: RewardItem): string {
  if (i.kind === "COUPON") {
    return [i.minSpendSatang ? `ซื้อครบ ${formatBaht(i.minSpendSatang)}` : null, i.validDays ? `ใช้ได้ ${i.validDays} วัน` : null].filter(Boolean).join(" · ") || "คูปองส่วนลด";
  }
  return [i.fulfilment ? `ได้รับใน ${i.fulfilment}` : "ของรางวัล", i.stockLeft !== null && i.stockLeft > 0 && i.stockLeft <= 10 ? `เหลือ ${i.stockLeft} ชิ้น` : null].filter(Boolean).join(" · ");
}

function RewardThumb({ item }: { item: { imageUrl: string | null; kind: string; name: string } }) {
  if (item.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="rw-thumb" src={item.imageUrl} alt="" width={64} height={64} loading="lazy" />;
  }
  return (
    <span className="rw-thumb rw-thumb-blank" aria-hidden="true">
      {item.kind === "COUPON" ? "฿" : <IconGift size={26} />}
    </span>
  );
}

// ------------------------------------------------------------------ redeem

function RedeemSheet({
  item,
  balance,
  contact,
  stores,
  onClose,
  onDone,
}: {
  item: RewardItem;
  balance: number;
  contact: { name: string; phone: string };
  stores: Store[];
  onClose: () => void;
  onDone: (d: RewardsData, r: { id: string; kind: string }) => void;
}) {
  const physical = item.kind === "PHYSICAL";
  const [accept, setAccept] = useState(false);
  const [method, setMethod] = useState<"PICKUP" | "SHIP">("PICKUP");
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [name, setName] = useState(contact.name);
  const [phone, setPhone] = useState(contact.phone);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await api<RewardsData & { result: { id: string; kind: string } }>("/api/me/rewards/redeem", {
      method: "POST",
      body: { rewardId: item.id, acceptTerms: accept, delivery: physical ? { method, name, phone, address, storeId } : undefined },
    });
    setBusy(false);
    if (res.ok) onDone(res.data, res.data.result);
    else setError(res.error);
  };

  const footer = item.blocked ? (
    <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>
      ปิด
    </button>
  ) : (
    <button type="button" className="btn btn-primary btn-block" disabled={!accept || busy} onClick={() => void submit()}>
      {busy && <span className="spinner" aria-hidden="true" />}
      <span>{busy ? "กำลังแลก…" : `ยืนยัน ใช้ ${formatPoints(item.costPoints)} แต้ม`}</span>
    </button>
  );

  return (
    <Sheet title={item.name} onClose={onClose} footer={footer}>
      <div className="rw-sheet">
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="rw-hero" src={item.imageUrl} alt="" />
        )}
        {item.description && <p>{item.description}</p>}
        <dl className="summary">
          <div>
            <dt>ใช้แต้ม</dt>
            <dd className="num">{formatPoints(item.costPoints)}</dd>
          </div>
          <div>
            <dt>แต้มคงเหลือหลังแลก</dt>
            <dd className="num">{item.blocked ? "–" : formatPoints(balance - item.costPoints)}</dd>
          </div>
          {item.kind === "COUPON" ? (
            <div>
              <dt>ส่วนลด</dt>
              <dd>
                {item.valueSatang ? formatBaht(item.valueSatang) : "–"}
                {item.minSpendSatang ? ` เมื่อซื้อครบ ${formatBaht(item.minSpendSatang)}` : ""}
              </dd>
            </div>
          ) : (
            item.fulfilment && (
              <div>
                <dt>ระยะเวลา</dt>
                <dd>{item.fulfilment}</dd>
              </div>
            )
          )}
          {item.endsAt && (
            <div>
              <dt>แลกได้ถึง</dt>
              <dd>{formatThaiDate(new Date(item.endsAt))}</dd>
            </div>
          )}
        </dl>

        {item.blocked ? (
          <p className="notice notice-error">{item.blocked}</p>
        ) : (
          <>
            {physical && (
              <fieldset className="rw-delivery">
                <legend>รับของอย่างไร</legend>
                <div className="rw-choice" role="radiogroup">
                  {(["PICKUP", "SHIP"] as const).map((m) => (
                    <label key={m} className={`rw-option${method === m ? " on" : ""}`}>
                      <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} />
                      <span>{m === "PICKUP" ? "รับที่ร้าน" : "จัดส่งให้"}</span>
                    </label>
                  ))}
                </div>
                {method === "PICKUP" && stores.length > 1 && (
                  <div className="field">
                    <label htmlFor="rw-store">สาขา</label>
                    <select id="rw-store" className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {method === "PICKUP" && stores.length === 1 && <p className="hint">รับที่ {stores[0]!.name}{stores[0]!.address ? ` · ${stores[0]!.address}` : ""} ทีมงานจะแจ้งทาง LINE เมื่อของพร้อม</p>}
                <div className="field">
                  <label htmlFor="rw-name">ชื่อผู้รับ</label>
                  <input id="rw-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
                </div>
                <div className="field">
                  <label htmlFor="rw-phone">เบอร์ติดต่อ</label>
                  <input id="rw-phone" className="input num" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" maxLength={15} />
                </div>
                {method === "SHIP" && (
                  <div className="field">
                    <label htmlFor="rw-addr">ที่อยู่จัดส่ง</label>
                    <textarea id="rw-addr" className="input" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" maxLength={400} />
                  </div>
                )}
              </fieldset>
            )}
            {item.terms && (
              <div className="rw-terms">
                <h3>เงื่อนไข</h3>
                <p>{item.terms}</p>
              </div>
            )}
            <label className="checkline rw-accept">
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
              <span>
                {physical
                  ? "ยอมรับเงื่อนไข · แต้มถูกหักทันที และคืนเต็มจำนวนถ้าคำขอไม่ผ่าน"
                  : "ยอมรับเงื่อนไข · แลกแล้วยกเลิกหรือคืนแต้มไม่ได้"}
              </span>
            </label>
            {error && <p className="notice notice-error">{error}</p>}
          </>
        )}
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------------ coupon

function CouponSheet({ coupon, onClose }: { coupon: RedemptionRow; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const live = liveCoupon(coupon);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!live || !coupon.couponCode) return;
    let alive = true;
    void import("qrcode").then((QR) =>
      QR.toString(coupon.couponCode!, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#0b3d29", light: "#ffffff" } }).then((svg) => {
        if (alive) setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      }),
    );
    // Keep the screen awake while the cashier scans (where the browser allows it).
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock
      ?.request("screen")
      .then((l) => {
        lock = l;
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      void lock?.release().catch(() => undefined);
    };
  }, [coupon.couponCode, live]);

  if (!live) {
    return (
      <Sheet title={coupon.rewardName} onClose={onClose}>
        <div className="rw-sheet">
          <p className="notice">
            <span>
              {coupon.status === "USED" && coupon.usedAt ? `ใช้คูปองนี้แล้วเมื่อ ${formatThaiDate(new Date(coupon.usedAt))}` : `คูปองนี้${coupon.statusLabel}`}
            </span>
          </p>
          <p className="hint num">
            {coupon.couponCode} · {coupon.code}
          </p>
        </div>
      </Sheet>
    );
  }

  return (
    <div className="bright" role="dialog" aria-modal="true" aria-label={`คูปอง ${coupon.rewardName}`}>
      <button ref={closeRef} type="button" className="icon-btn bright-close" onClick={onClose} aria-label="ปิด" autoFocus>
        <IconClose size={24} />
      </button>
      <p className="rw-coupon-value num">{coupon.valueSatang ? formatBaht(coupon.valueSatang) : coupon.rewardName}</p>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt={`QR คูปอง ${coupon.couponCode}`} className="bright-qr" width={300} height={300} />
      ) : (
        <span className="bright-qr rw-qr-wait" aria-hidden="true" />
      )}
      <p className="bright-code num">{coupon.couponCode}</p>
      <p className="bright-name">{coupon.rewardName}</p>
      <p className="hint">
        {coupon.minSpendSatang ? `ใช้เมื่อซื้อครบ ${formatBaht(coupon.minSpendSatang)} · ` : ""}
        ใช้ได้ถึง {coupon.expiresAt ? formatThaiDate(new Date(coupon.expiresAt)) : "–"} · ให้พนักงานสแกนก่อนชำระเงิน
      </p>
      {coupon.terms && <p className="hint rw-coupon-terms">{coupon.terms}</p>}
    </div>
  );
}

// ----------------------------------------------------------------- request

function RequestSheet({ r, onClose, onCancelled }: { r: RedemptionRow; onClose: () => void; onCancelled: (d: RewardsData) => void }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reached = new Map(r.steps.map((s) => [s.status, s.at]));
  // Under review counts as "received"; a pickup never ships.
  const steps = STEPS.filter((s) => !(r.method === "PICKUP" && s.status === "SHIPPED"));
  const stopped = r.status === "REJECTED" || r.status === "CANCELLED";

  const cancel = async () => {
    setBusy(true);
    setError(null);
    const res = await api<RewardsData>(`/api/me/redemptions/${r.id}/cancel`, { method: "POST" });
    setBusy(false);
    if (res.ok) onCancelled(res.data);
    else setError(res.error);
  };

  return (
    <Sheet
      title={r.rewardName}
      onClose={onClose}
      footer={
        r.canCancel ? (
          <button type="button" className="btn btn-secondary btn-block" disabled={busy} onClick={() => (confirm ? void cancel() : setConfirm(true))}>
            {confirm ? `ยืนยันยกเลิก · คืน ${formatPoints(r.costPoints)} แต้ม` : "ยกเลิกคำขอ"}
          </button>
        ) : undefined
      }
    >
      <div className="rw-sheet">
        <p className="hint num">Redemption ID {r.code} · ขอเมื่อ {formatThaiDate(new Date(r.createdAt))}</p>
        {stopped ? (
          <p className="notice notice-error">
            {r.statusLabel}
            {r.note ? ` · ${r.note}` : ""} · คืน {formatPoints(r.costPoints)} แต้มแล้ว
          </p>
        ) : (
          <ol className="rw-steps">
            {steps.map((s) => {
              const at = reached.get(s.status) ?? (s.status === "SUBMITTED" ? r.createdAt : undefined);
              return (
                <li key={s.status} className={at ? "done" : ""}>
                  <span className="rw-dot" aria-hidden="true">{at ? <IconCheck size={14} /> : null}</span>
                  <span>
                    {s.status === "COMPLETED" && r.method === "PICKUP" ? "รับของแล้ว" : s.label}
                    {at && <small> · {formatThaiDate(new Date(at))}</small>}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {!stopped && r.note && <p className="notice"><span>{r.note}</span></p>}
        {r.trackingNo && (
          <p>
            เลขพัสดุ{r.carrier ? ` (${r.carrier})` : ""}: <b className="num">{r.trackingNo}</b>
          </p>
        )}
        {!stopped && r.fulfilment && r.status !== "COMPLETED" && <p className="hint">ระยะเวลาโดยประมาณ {r.fulfilment}</p>}
        {error && <p className="notice notice-error">{error}</p>}
      </div>
    </Sheet>
  );
}
