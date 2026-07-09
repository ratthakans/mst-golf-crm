import {
  branchPerformance, channelLabel, channelMix, hourDistribution, pointsEconomy, topProducts,
} from "@mstgolf/analytics";
import { getCrmData, formatCurrency, formatNumber } from "../../lib/data";
import { BarChart, Donut } from "../charts";

const CAT_LABEL: Record<string, string> = {
  clubs: "ไม้กอล์ฟ", balls: "ลูกกอล์ฟ", apparel: "เสื้อผ้า", footwear: "รองเท้า", accessories: "อุปกรณ์เสริม",
};

export default async function OperationsPage() {
  const { org, members, events } = await getCrmData();
  const cur = (n: number) => formatCurrency(n, org.currency);

  const channels = channelMix(events);
  const products = topProducts(events, 8);
  const branches = branchPerformance(events);
  const hours = hourDistribution(events);
  const pe = pointsEconomy(events, members.map((m) => m.points));

  const chanTotal = Math.max(1, channels.reduce((s, c) => s + c.revenue, 0));
  const branchMax = Math.max(1, ...branches.map((b) => b.revenue));

  return (
    <>
      <div className="page-head">
        <h1>เชิงลึกเชิงปฏิบัติการ</h1>
        <p>use case จากข้อมูลดิบ — ช่องทางขาย สินค้าขายดี สาขา ช่วงเวลาพีค และเศรษฐกิจแต้ม</p>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>ยอดขายตามช่องทาง</h3>
          <div className="wallet-row">
            <Donut
              data={channels.map((c, i) => ({
                label: channelLabel(c.channel),
                value: c.revenue,
                color: ["#166b3f", "#3aa76d", "#c9a94a", "#8a7fd4"][i % 4]!,
              }))}
              centerLabel={`${channels.length}`}
              centerSub="ช่องทาง"
            />
            <div className="wallet-legend">
              {channels.map((c, i) => (
                <div className="wl-item" key={c.channel}>
                  <span className="dot" style={{ background: ["#166b3f", "#3aa76d", "#c9a94a", "#8a7fd4"][i % 4] }} />
                  <span className="wl-name">{channelLabel(c.channel)}</span>
                  <span className="aff-count" style={{ marginRight: 8 }}>{formatNumber(c.orders)} ออเดอร์</span>
                  <span className="wl-pct">{cur(c.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="muted-sub" style={{ marginTop: 4, marginBottom: 0 }}>
            สัดส่วนรายได้ตามช่องทาง — {Math.round((channels[0]?.revenue ?? 0) / chanTotal * 100)}% มาจาก{channelLabel(channels[0]?.channel ?? "store")}
          </p>
        </div>

        <div className="card">
          <h3>เศรษฐกิจแต้มสะสม</h3>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="pp-chip"><span>แจกไปแล้ว</span>{formatNumber(pe.earned)}</div>
            <div className="pp-chip"><span>ถูกแลกไป</span>{formatNumber(pe.redeemed)}</div>
            <div className="pp-chip"><span>คงค้างในระบบ</span>{formatNumber(pe.outstanding)}</div>
            <div className="pp-chip"><span>อัตราแลก</span>{Math.round(pe.redemptionRate * 100)}%</div>
          </div>
          <p className="muted-sub" style={{ marginTop: 12, marginBottom: 0 }}>
            แต้มคงค้างคือภาระในอนาคต — อัตราแลกต่ำแปลว่าลูกค้ายังไม่เห็นคุณค่าของรางวัล ลองปรับแคตตาล็อก
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>ช่วงเวลาพีค (footfall + การซื้อ)</h3>
        <BarChart
          data={hours.map((h) => ({ label: `${h.hour}`, value: h.count }))}
          format={(n) => formatNumber(n)}
          color="var(--brand)"
        />
        <p className="muted-sub" style={{ marginTop: 8, marginBottom: 0 }}>ชั่วโมงของวัน (08:00–21:00) — ใช้จัดกะพนักงานและเวลายิงโปร</p>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>สินค้าขายดี (ตามรายได้)</h3>
          <div className="affinity-list">
            {products.map((p) => (
              <div className="aff-row" key={p.name}>
                <span className="aff-pair" style={{ textTransform: "none" }}>
                  {p.name} <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}>· {CAT_LABEL[p.category] ?? p.category}</span>
                </span>
                <span className="aff-meta">
                  <span className="aff-lift">{cur(p.revenue)}</span>
                  <span className="aff-count">{formatNumber(p.units)} ชิ้น</span>
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <BarChart data={products.slice(0, 6).map((p) => ({ label: p.name.split(" ")[0] ?? p.name, value: p.revenue }))}
              format={(n) => `${Math.round(n / 1000)}k`} color="var(--loyal)" height={120} />
          </div>
        </div>

        <div className="card">
          <h3>ผลงานรายสาขา</h3>
          {branches.map((b) => (
            <div className="branch-row" key={b.branch}>
              <div className="branch-top">
                <span className="branch-name">{b.branch}</span>
                <span className="branch-rev">{cur(b.revenue)}</span>
              </div>
              <div className="branch-bar-wrap">
                <div className="branch-bar" style={{ width: `${(b.revenue / branchMax) * 100}%` }} />
              </div>
              <div className="branch-sub">{formatNumber(b.orders)} ออเดอร์ · {formatNumber(b.visits)} การเข้าร้าน</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
