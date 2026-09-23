import { allowPage } from "../lib/auth";
import { getCrmData, formatNumber } from "../lib/data";
import { Forbidden } from "./Forbidden";
import { SEGMENT_ORDER, SEGMENT_COLOR, SEGMENT_LABEL } from "../lib/segments";
import { AreaChart, Trend } from "./charts";
import { DailyBriefing } from "./DailyBriefing";
import { CountUp } from "./CountUp";

const FUNNEL_LABEL: Record<string, string> = {
  Scanned: "สแกน QR",
  Registered: "สมัครสมาชิก",
  Purchased: "ซื้อครั้งแรก",
  Repeat: "ซื้อซ้ำ",
};

// Month-over-month change between the two most recent months. The series passed
// in already excludes the current partial month, so these are both complete.
function mom(series: number[]): number {
  if (series.length < 2) return 0;
  const a = series[series.length - 1]!;
  const b = series[series.length - 2]!;
  return b > 0 ? (a - b) / b : 0;
}

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  if (!(await allowPage("overview.view"))) return <Forbidden />;
  const { org, stats, segments, funnel, timeseries } = await getCrmData();
  const revSeries = timeseries.map((t) => t.revenue);
  const labels = timeseries.map((t) => t.label);
  const maxSeg = Math.max(1, ...Object.values(segments));

  const revTrend = mom(revSeries);

  return (
    <>
      <div className="page-head">
        <h1>{org.name} — ภาพรวม</h1>
        <p>สุขภาพฐานสมาชิกและกลุ่มลูกค้า แบบเห็นภาพรวมในหน้าเดียว</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <DailyBriefing />
      </div>

      <div className="bento">
        <div className="card stat bento-hero span-2 row-2">
          <div className="bento-hero-top">
            <div>
              <div className="label">รายได้ (สะสม)</div>
              <div className="value">
                <CountUp value={stats.revenue} prefix="฿" />
              </div>
            </div>
            <Trend delta={revTrend} />
          </div>
          <div className="bento-hero-chart">
            <AreaChart data={revSeries} labels={labels} height={150} format={(n) => `฿${Math.round(n / 1000)}k`} />
          </div>
          <div className="sub">6 เดือนล่าสุด · แจกไป {formatNumber(stats.pointsIssued)} แต้ม</div>
        </div>

        <div className="card stat">
          <div className="label">สมาชิกทั้งหมด</div>
          <div className="value">{formatNumber(stats.totalMembers)}</div>
          <div className="sub">ใหม่ {stats.newMembers30d} คนใน 30 วัน</div>
        </div>

        <div className="card stat">
          <div className="label">ใช้งาน (30 วัน)</div>
          <div className="value accent">{formatNumber(stats.activeMembers30d)}</div>
          <div className="sub">เข้ามาภายใน 30 วัน</div>
        </div>

        <div className="card stat">
          <div className="label">เสี่ยงหลุด</div>
          <div className="value warn">{formatNumber(stats.atRiskMembers)}</div>
          <div className="sub">เงียบเกิน {org.churnDays} วัน</div>
        </div>

        <div className="card stat">
          <div className="label">แต้มที่แจกไป</div>
          <div className="value">{formatNumber(stats.pointsIssued)}</div>
          <div className="sub">สะสมทั้งระบบ</div>
        </div>

        <div className="card span-2">
          <h3>กลุ่มลูกค้า RFM</h3>
          {SEGMENT_ORDER.map((seg) => {
            const count = segments[seg];
            return (
              <div className="seg-row" key={seg}>
                <span className="seg-name">
                  <span className="dot" style={{ background: SEGMENT_COLOR[seg], marginRight: 7 }} />
                  {SEGMENT_LABEL[seg]}
                </span>
                <span className="seg-bar-wrap">
                  <span
                    className="seg-bar"
                    style={{ width: `${(count / maxSeg) * 100}%`, background: SEGMENT_COLOR[seg] }}
                  />
                </span>
                <span className="seg-count">{count}</span>
              </div>
            );
          })}
        </div>

        <div className="card span-2">
          <h3>กรวยการได้ลูกค้า</h3>
          {funnel.map((s, i) => {
            const top = funnel[0]?.members || 1;
            return (
              <div className="funnel-row" key={s.stage}>
                <div className="funnel-top">
                  <span>{FUNNEL_LABEL[s.stage] ?? s.stage}</span>
                  <span className="conv">
                    {i === 0 ? `${s.members} คน` : `${Math.round(s.conversionFromPrev * 100)}% จากขั้นก่อน`}
                  </span>
                </div>
                <div className="funnel-bar-wrap">
                  <div className="funnel-bar" style={{ width: `${Math.max(6, (s.members / top) * 100)}%` }}>
                    {s.members}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
