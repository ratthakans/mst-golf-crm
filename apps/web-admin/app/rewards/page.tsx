import Link from "next/link";
import { listRedemptions, OPEN_STATUSES, rewardsReport, type RedemptionListFilter } from "@mstgolf/core";
import { allowPage } from "../../lib/auth";
import { currentOrg } from "../../lib/org";
import { Forbidden } from "../Forbidden";
import { formatDateTime, num, pct, REDEMPTION_STATUS } from "../ui/format";

export const dynamic = "force-dynamic";

const VIEWS: Array<{ key: NonNullable<RedemptionListFilter["view"]> | "report"; label: string }> = [
  { key: "open", label: "คำขอที่ต้องดำเนินการ" },
  { key: "coupons", label: "คูปอง" },
  { key: "closed", label: "คำขอที่ปิดแล้ว" },
  { key: "report", label: "รายงาน" },
];

const DAY = 24 * 3600_000;
const ageText = (d: Date) => {
  const h = Math.floor((Date.now() - d.getTime()) / 3600_000);
  return h < 24 ? `${h} ชม.` : `${Math.floor(h / 24)} วัน`;
};

export default async function RewardsPage({ searchParams }: { searchParams: { view?: string; q?: string; days?: string } }) {
  const user = await allowPage("rewards.view");
  if (!user) return <Forbidden />;
  const org = await currentOrg();
  const view = (VIEWS.find((v) => v.key === searchParams.view)?.key ?? "open") as (typeof VIEWS)[number]["key"];
  const q = searchParams.q?.trim() ?? "";

  return (
    <>
      <div className="page-head">
        <div className="row between">
          <div>
            <h1>รางวัล</h1>
            <p>คำขอแลกของจากสมาชิก คูปองที่ออกไป และรายงานแต้มเข้า–ออก</p>
          </div>
          <div className="row">
            <Link href="/rewards/catalog" className="btn btn-ghost btn-sm">แคตตาล็อกรางวัล</Link>
            {user.permissions.includes("coupons.use") && <Link href="/coupons" className="btn btn-sm">ตรวจคูปอง</Link>}
          </div>
        </div>
      </div>
      <div className="tabs">
        {VIEWS.map((v) => (
          <Link key={v.key} href={`/rewards?view=${v.key}`} className={`tab${view === v.key ? " on" : ""}`}>{v.label}</Link>
        ))}
      </div>
      {view === "report" ? <Report orgId={org.id} days={Number(searchParams.days) || 30} /> : <List orgId={org.id} view={view} q={q} />}
    </>
  );
}

async function List({ orgId, view, q }: { orgId: string; view: NonNullable<RedemptionListFilter["view"]>; q: string }) {
  const rows = await listRedemptions(orgId, { view, q });
  return (
    <>
      <form className="toolbar" action="/rewards">
        <input type="hidden" name="view" value={view} />
        <input className="link-input" name="q" defaultValue={q} placeholder="ค้นหา Redemption ID · รหัสคูปอง · รหัสสมาชิก · ชื่อ · รางวัล" style={{ flex: 1, minWidth: 220 }} />
        <button className="btn btn-ghost btn-sm">ค้นหา</button>
        {q && <Link href={`/rewards?view=${view}`} className="link-btn">ล้าง</Link>}
      </form>
      {rows.length === 0 ? (
        <div className="empty">{view === "open" ? "ไม่มีคำขอค้าง" : "ยังไม่มีรายการ"}</div>
      ) : (
        <div className="card table-card table-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Redemption ID</th>
                <th>สมาชิก</th>
                <th>รางวัล</th>
                <th className="num">แต้ม</th>
                <th>สถานะ</th>
                <th>{view === "coupons" ? "ใช้/หมดอายุ" : "ขอเมื่อ"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const expired = r.status === "ISSUED" && r.expiresAt && r.expiresAt < new Date();
                const st = REDEMPTION_STATUS[expired ? "EXPIRED" : r.status]!;
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/rewards/redemptions/${r.id}`} className="mono">{r.code}</Link>
                      {r.couponCode && <div className="sub mono">{r.couponCode}</div>}
                    </td>
                    <td>
                      <Link href={`/members/${r.member.id}`}>{r.member.displayName}</Link>
                      <div className="sub mono">{r.member.code}</div>
                    </td>
                    <td>{r.rewardName}</td>
                    <td className="num">{num(r.costPoints)}</td>
                    <td><span className={`pill ${st.tone}`}>{st.label}</span></td>
                    <td className="dim nowrap">
                      {view === "coupons"
                        ? r.usedAt
                          ? `ใช้ ${formatDateTime(r.usedAt)}${r.usedStore ? ` · ${r.usedStore.name}` : ""}`
                          : r.expiresAt
                            ? `ถึง ${formatDateTime(r.expiresAt)}`
                            : "–"
                        : <>
                            {formatDateTime(r.createdAt)}
                            {OPEN_STATUSES.includes(r.status) && <div className="sub">รอมา {ageText(r.createdAt)}</div>}
                          </>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

async function Report({ orgId, days }: { orgId: string; days: number }) {
  const span = [30, 90, 365].includes(days) ? days : 30;
  const to = new Date();
  const from = new Date(to.getTime() - span * DAY);
  const r = await rewardsReport(orgId, from, to);
  return (
    <div className="stack">
      <div className="row">
        {[30, 90, 365].map((d) => (
          <Link key={d} href={`/rewards?view=report&days=${d}`} className={`chip${d === span ? " chip-on" : ""}`}>{d === 365 ? "12 เดือน" : `${d} วัน`}</Link>
        ))}
      </div>
      <div className="kpis">
        <div className="card kpi"><div className="label">แต้มที่ออกให้สมาชิก</div><div className="value">{num(r.pointsEarned)}</div></div>
        <div className="card kpi"><div className="label">แต้มที่ใช้แลก (หักคืนแล้ว)</div><div className="value">{num(r.pointsRedeemed)}</div></div>
        <div className="card kpi"><div className="label">การแลก</div><div className="value">{num(r.redemptions)}</div></div>
        <div className="card kpi"><div className="label">คำขอค้างตอนนี้</div><div className="value">{num(r.openRequests)}</div></div>
      </div>
      <div className="kpis">
        <div className="card kpi"><div className="label">คูปองที่ออก</div><div className="value">{num(r.couponsIssued)}</div></div>
        <div className="card kpi"><div className="label">คูปองที่ใช้แล้ว</div><div className="value">{num(r.couponsUsed)}</div></div>
        <div className="card kpi"><div className="label">อัตราการใช้คูปอง</div><div className="value">{pct(r.couponUseRate)}</div><div className="muted small">ใช้แล้ว ÷ (ใช้แล้ว + หมดอายุ)</div></div>
        <div className="card kpi"><div className="label">เวลาส่งของเฉลี่ย</div><div className="value">{r.avgFulfilmentDays === null ? "–" : `${r.avgFulfilmentDays.toFixed(1)} วัน`}</div><div className="muted small">ตั้งแต่ขอจนเสร็จสิ้น</div></div>
      </div>
      <div className="card table-card table-scroll">
        <table className="tbl">
          <thead>
            <tr><th>รางวัล</th><th>ประเภท</th><th className="num">จำนวนแลก</th><th className="num">แต้มรวม</th></tr>
          </thead>
          <tbody>
            {r.byReward.length === 0 ? (
              <tr><td colSpan={4} className="dim">ยังไม่มีการแลกในช่วงนี้</td></tr>
            ) : (
              r.byReward.map((b) => (
                <tr key={b.rewardId}>
                  <td><Link href={`/rewards/catalog/${b.rewardId}`}>{b.name}</Link></td>
                  <td className="dim">{b.kind === "COUPON" ? "คูปอง" : "ของรางวัล"}</td>
                  <td className="num">{num(b.count)}</td>
                  <td className="num">{num(b.points)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
