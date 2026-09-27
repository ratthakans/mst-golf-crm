import { Fragment } from "react";
import Link from "next/link";
import { addDays, dashboardSummary, localDateKey, startOfLocalDay, type PeriodMetrics, readiness } from "@mstgolf/core";
import { allowPage } from "../lib/auth";
import { currentOrg } from "../lib/org";
import { Forbidden } from "./Forbidden";
import { RangePicker } from "./RangePicker";
import { formatBaht, formatDateTime, num, pct, SOURCE_LABEL } from "./ui/format";
import { TierPill } from "./ui/TierPill";

export const dynamic = "force-dynamic";

function presets(today: Date) {
  const key = localDateKey;
  const firstOfMonth = `${key(today).slice(0, 7)}-01`;
  return [
    { label: "วันนี้", from: key(today), to: key(today) },
    { label: "7 วัน", from: key(addDays(today, -6)), to: key(today) },
    { label: "30 วัน", from: key(addDays(today, -29)), to: key(today) },
    { label: "เดือนนี้", from: firstOfMonth, to: key(today) },
    { label: "90 วัน", from: key(addDays(today, -89)), to: key(today) },
  ];
}

function Delta({ now, before }: { now: number; before: number }) {
  if (!before && !now) return null;
  if (!before) return <span className="delta up">ใหม่</span>;
  const d = (now - before) / Math.abs(before);
  if (Math.abs(d) < 0.005) return <span className="delta">±0%</span>;
  if (d > 5) return <span className="delta up">▲ &gt;500%</span>;
  return <span className={`delta ${d > 0 ? "up" : "down"}`}>{d > 0 ? "▲" : "▼"} {Math.abs(d * 100).toFixed(0)}%</span>;
}

const SRC_COLORS: Record<string, string> = { LINE: "#06c755", WEB: "#2563eb", COUNTER: "#0a5c36", POS: "#a16207", IMPORT: "#94a3b8", WALKIN: "#0a5c36", PHONE: "#7c3aed" };

function SourceSplit({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  if (!total) return <p className="muted small">ยังไม่มีข้อมูลในช่วงนี้</p>;
  return (
    <>
      <div className="split-bar">
        {entries.map(([k, n]) => (
          <i key={k} style={{ width: `${(n / total) * 100}%`, background: SRC_COLORS[k] ?? "#94a3b8" }} title={`${SOURCE_LABEL[k] ?? k} ${n}`} />
        ))}
      </div>
      <div className="legend">
        {entries.map(([k, n]) => (
          <span key={k} style={{ ["--c" as string]: SRC_COLORS[k] ?? "#94a3b8" }}>
            {SOURCE_LABEL[k] ?? k} {num(n)}
          </span>
        ))}
      </div>
    </>
  );
}

function Kpis({ c, p, showMoney }: { c: PeriodMetrics; p: PeriodMetrics; showMoney: boolean }) {
  return (
    <div className="kpis">
      <div className="card kpi">
        <div className="label">สมาชิกใหม่</div>
        <div className="value">
          {num(c.newMembers)}
          <Delta now={c.newMembers} before={p.newMembers} />
        </div>
        <div className="sub">ช่วงก่อนหน้า {num(p.newMembers)}</div>
      </div>
      {showMoney && (
        <div className="card kpi">
          <div className="label">ยอดซื้อของสมาชิก</div>
          <div className="value">
            {formatBaht(c.memberSpendSatang)}
            <Delta now={c.memberSpendSatang} before={p.memberSpendSatang} />
          </div>
          <div className="sub">{num(c.memberBills)} บิล · ยอดขายที่นำเข้าทั้งหมด {formatBaht(c.allSalesSatang)}</div>
        </div>
      )}
      {showMoney && (
        <div className="card kpi">
          <div className="label">ยอดขายที่ระบุตัวสมาชิกได้</div>
          <div className="value">{pct(c.identifiedPct)}</div>
          <div className="sub">ยิ่งสูง ยิ่งแปลว่าพนักงานใส่ MSTMEMBER ในบิลครบ</div>
        </div>
      )}
      <div className="card kpi">
        <div className="label">ใช้ lane ซิม</div>
        <div className="value">
          {pct(c.occupancyPct, c.occupancyPct !== null && c.occupancyPct > 0 && c.occupancyPct < 0.1 ? 1 : 0)}
          {c.occupancyPct !== null && p.occupancyPct !== null && <Delta now={c.occupancyPct} before={p.occupancyPct} />}
        </div>
        <div className="sub">
          {num(Math.round(c.bookedHours))} จาก {num(Math.round(c.sellableHours))} ชม. · {num(c.bookings)} การจอง · ไม่มา {num(c.noShows)}
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const user = await allowPage("dashboard.view");
  if (!user) return <Forbidden />;
  const org = await currentOrg();
  const today = startOfLocalDay(new Date());
  const to = searchParams.to && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.to) ? searchParams.to : localDateKey(today);
  const from = searchParams.from && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.from) ? searchParams.from : localDateKey(addDays(today, -29));
  const showMoney = user.permissions.includes("dashboard.revenue");
  const [s, ready] = await Promise.all([
    dashboardSummary(org.id, from, to),
    user.permissions.includes("settings.manage") ? readiness(org.id) : Promise.resolve(null),
  ]);
  const readyOpen = ready ? ready.filter((i) => i.state !== "ok").length : 0;
  const maxNew = Math.max(1, ...s.weekly.map((w) => w.newMembers));
  const maxSpend = Math.max(1, ...s.weekly.map((w) => w.memberSpendSatang));
  const maxHeat = Math.max(1, ...s.heatmap.rows.flatMap((r) => r.counts));

  return (
    <div className="stack">
      <div className="page-head page-head-actions">
        <div>
          <h1>ภาพรวม</h1>
          <p>
            สมาชิก {num(s.totalMembers)} คน · ผูก LINE แล้ว {num(s.membersWithLine)} คน
            {s.lastImportAt ? ` · นำเข้า POS ล่าสุด ${formatDateTime(s.lastImportAt)}` : " · ยังไม่เคยนำเข้า POS"}
          </p>
        </div>
        <RangePicker from={from} to={to} presets={presets(today)} />
      </div>

      {s.pendingReviews > 0 && user.permissions.includes("reviews.request") && (
        <Link href="/reviews" className="card row between" style={{ borderColor: "#eed28a" }}>
          <span>
            <b>มีเรื่องรอตรวจสอบ {num(s.pendingReviews)} รายการ</b>
            <span className="muted small"> — เบอร์ซ้ำ คำขอรวมบัญชี หรือคำขอลบข้อมูล</span>
          </span>
          <span className="btn btn-ghost btn-sm">เปิดคิว →</span>
        </Link>
      )}

      {ready && readyOpen > 0 && (
        <Link href="/settings/readiness" className="card row between">
          <span>
            <b>ก่อนเปิดใช้จริง: พร้อม {num(ready.length - readyOpen)} จาก {num(ready.length)} รายการ</b>
            <span className="muted small"> — รอ MST ยืนยันค่า {num(ready.filter((i) => i.state === "confirm").length)} · รอข้อมูล {num(ready.filter((i) => i.state === "waiting").length)}</span>
          </span>
          <span className="btn btn-ghost btn-sm">ดูรายการ →</span>
        </Link>
      )}

      <Kpis c={s.current} p={s.previous} showMoney={showMoney} />

      <div className="grid grid-2">
        <div className="card">
          <h3>สมาชิกใหม่รายสัปดาห์</h3>
          <div className="bars-v">
            {s.weekly.map((w, i) => (
              <div className="b" key={w.weekStart} title={`สัปดาห์ ${w.weekStart}: ${w.newMembers} คน`}>
                <em>{w.newMembers || ""}</em>
                <i style={{ height: `${(w.newMembers / maxNew) * 100}%` }} />
                <span>{i % 2 === 0 ? `${w.weekStart.slice(8)}/${w.weekStart.slice(5, 7)}` : "\u00a0"}</span>
              </div>
            ))}
          </div>
          <h3 style={{ marginTop: 18 }}>ช่องทางสมัครในช่วงที่เลือก</h3>
          <SourceSplit counts={s.current.newBySource} />
        </div>
        {showMoney ? (
          <div className="card">
            <h3>ยอดซื้อของสมาชิกรายสัปดาห์</h3>
            <div className="bars-v">
              {s.weekly.map((w, i) => (
                <div className="b" key={w.weekStart} title={`สัปดาห์ ${w.weekStart}: ${formatBaht(w.memberSpendSatang)}`}>
                  <em>{w.memberSpendSatang ? `${Math.round(w.memberSpendSatang / 100_000)}k` : ""}</em>
                  <i style={{ height: `${(Math.max(0, w.memberSpendSatang) / maxSpend) * 100}%` }} />
                  <span>{i % 2 === 0 ? `${w.weekStart.slice(8)}/${w.weekStart.slice(5, 7)}` : "\u00a0"}</span>
                </div>
              ))}
            </div>
            <h3 style={{ marginTop: 18 }}>สมาชิกแต่ละระดับ</h3>
            <div className="row" style={{ gap: 18 }}>
              {s.tierCounts.map((t, i) => (
                <span key={t.key} className="row" style={{ gap: 8 }}>
                  <TierPill name={t.name} rank={i} />
                  <b className="mono">{num(t.count)}</b>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="card">
            <h3>สมาชิกแต่ละระดับ</h3>
            <div className="row" style={{ gap: 18 }}>
              {s.tierCounts.map((t, i) => (
                <span key={t.key} className="row" style={{ gap: 8 }}>
                  <TierPill name={t.name} rank={i} />
                  <b className="mono">{num(t.count)}</b>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>การจองซิมตามช่องทาง</h3>
          <SourceSplit counts={s.current.bookingsBySource} />
        </div>
        <div className="card">
          <h3>ช่วงเวลาที่จองซิมบ่อย</h3>
          {s.heatmap.hours.length === 0 ? (
            <p className="muted small">ยังไม่ได้ตั้งเวลาเปิดร้าน</p>
          ) : (
            <div className="heat-scroll">
              <div className="heat" style={{ gridTemplateColumns: `28px repeat(${s.heatmap.hours.length}, minmax(24px, 1fr))` }}>
                <span />
                {s.heatmap.hours.map((h) => (
                  <span key={h} className="h">{h}</span>
                ))}
                {s.heatmap.rows.map((r) => (
                  <Fragment key={r.weekday}>
                    <span className="d">{r.weekday}</span>
                    {r.counts.map((c, i) => (
                      <span
                        key={`${r.weekday}-${i}`}
                        className="c"
                        style={{ opacity: c ? 0.18 + (0.82 * c) / maxHeat : 0.06 }}
                        title={`${r.weekday} ${s.heatmap.hours[i]}:00 — ${c} การจอง`}
                      >
                        {c || ""}
                      </span>
                    ))}
                  </Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
