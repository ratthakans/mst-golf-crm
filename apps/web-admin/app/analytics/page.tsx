import { getCrmData, formatCurrency, formatPct } from "../../lib/data";
import { BarChart, heatColor } from "../charts";

export default async function AnalyticsPage() {
  const { org, timeseries, cohort, affinity } = await getCrmData();
  const cur = (n: number) => formatCurrency(n, org.currency);

  return (
    <>
      <div className="page-head">
        <h1>วิเคราะห์ข้อมูล</h1>
        <p>เทรนด์เชิงพฤติกรรมและมุมมองเชิงสถิติ คำนวณจาก event log ทั้งหมด</p>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>รายได้ · 6 เดือนล่าสุด</h3>
          <BarChart
            data={timeseries.map((t) => ({ label: t.label, value: t.revenue }))}
            format={(n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)))}
          />
        </div>
        <div className="card">
          <h3>สมาชิกที่ยังใช้งานต่อเดือน</h3>
          <BarChart
            data={timeseries.map((t) => ({ label: t.label, value: t.activeMembers }))}
            color="var(--loyal)"
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>การคงอยู่ตามรุ่น (COHORT RETENTION)</h3>
        <p className="muted-sub">% ของสมาชิกแต่ละเดือนที่สมัคร ที่ยังกลับมาซื้อ/เข้าร้าน หลังผ่านไป N เดือน</p>
        <div style={{ overflowX: "auto" }}>
          <table className="cohort-table">
            <thead>
              <tr>
                <th>รุ่น (เดือนสมัคร)</th>
                <th className="mono">จำนวน</th>
                {Array.from({ length: cohort.months }, (_, i) => (
                  <th key={i} className="mono">M{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohort.rows.map((row) => (
                <tr key={row.cohort}>
                  <td>{row.label}</td>
                  <td className="mono">{row.size}</td>
                  {row.retention.map((v, i) => (
                    <td key={i} className="heat-cell" style={{ background: heatColor(v) }}>
                      {v === null ? "" : formatPct(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>ซื้อคู่กันบ่อย (LIFT)</h3>
          <p className="muted-sub">คู่หมวดสินค้าที่ถูกซื้อพร้อมกันมากกว่าปกติ — เป้าหมายการขายพ่วง</p>
          {affinity.pairs.length === 0 && <p className="muted-sub">ตะกร้ายังไม่พอสำหรับวิเคราะห์</p>}
          <div className="affinity-list">
            {affinity.pairs.slice(0, 6).map((p) => (
              <div className="aff-row" key={`${p.a}-${p.b}`}>
                <span className="aff-pair">{p.a} + {p.b}</span>
                <span className="aff-meta">
                  <span className="aff-lift">{p.lift.toFixed(1)}× lift</span>
                  <span className="aff-count">{p.count} ตะกร้า</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>รายได้แยกตามหมวด</h3>
          <div className="affinity-list">
            {affinity.categories.map((c) => (
              <div className="aff-row" key={c.category}>
                <span className="aff-pair">{c.category}</span>
                <span className="aff-meta">
                  <span className="aff-lift">{cur(c.revenue)}</span>
                  <span className="aff-count">{c.units} ชิ้น · {c.baskets} ตะกร้า</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
