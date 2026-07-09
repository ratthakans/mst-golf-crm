import { getInsightsData, formatCurrency, formatNumber, formatPct } from "../../lib/data";
import { SEGMENT_LABEL, SEGMENT_COLOR } from "../../lib/segments";
import { CurveChart, Donut } from "../charts";
import { CountUp } from "../CountUp";
import type { RfmSegment } from "@mstgolf/analytics";

const CAT_LABEL: Record<string, string> = {
  clubs: "ไม้กอล์ฟ", balls: "ลูกกอล์ฟ", apparel: "เสื้อผ้า", footwear: "รองเท้า", accessories: "อุปกรณ์เสริม",
};
const CAT_COLOR = ["#166b3f", "#3aa76d", "#7ee2ab", "#c9a94a", "#8a7fd4"];
const catLabel = (c: string) => CAT_LABEL[c] ?? c;

// A concrete next step for each recommended category — turns lift into action.
const ACTION: Record<string, string> = {
  clubs: "ชวนอัปเกรดชุดไม้ / ไดรเวอร์รุ่นใหม่",
  balls: "เสนอลูก Pro V1 แพ็กประหยัด",
  apparel: "เสนอเสื้อโปโล/แจ็กเก็ตคอลเลกชันใหม่",
  footwear: "เสนอรองเท้า FootJoy + ฟิตติ้งไซซ์",
  accessories: "เสนอถุงกอล์ฟ/ถุงมือเข้าเซ็ต",
};

export default async function InsightsPage() {
  const { org, totalMembers, migration, movers, nba, wallet, survival, clvForecast } =
    await getInsightsData();
  const cur = (n: number) => formatCurrency(n, org.currency);

  const walletData = wallet.categories.slice(0, 5).map((c, i) => ({
    label: catLabel(c.category),
    value: c.buyers,
    color: CAT_COLOR[i % CAT_COLOR.length]!,
  }));
  const coverageMax = Math.max(1, ...wallet.coverage.map((c) => c.members));

  return (
    <>
      <div className="page-head">
        <h1>สัญญาณ &amp; การเคลื่อนไหว</h1>
        <p>ไม่ใช่แค่ภาพนิ่งวันนี้ — ใครกำลังเลื่อนขึ้น/หล่นลง ใครควรเสนออะไรต่อ และลูกค้าจะกลับมาซื้อซ้ำเร็วแค่ไหน</p>
      </div>

      {/* Movement hero */}
      <div className="hero-strip" style={{ marginBottom: 16 }}>
        <div className="hero-stats">
          <div>
            <div className="hero-num up">▲ <CountUp value={migration.upCount} /></div>
            <div className="hero-cap">เลื่อนขึ้น ({migration.windowDays} วัน)</div>
          </div>
          <div>
            <div className="hero-num down">▼ <CountUp value={migration.downCount} /></div>
            <div className="hero-cap">หล่นลง</div>
          </div>
          <div>
            <div className="hero-num">＋<CountUp value={migration.entryCount} /></div>
            <div className="hero-cap">สมาชิกใหม่เข้าฐาน</div>
          </div>
          <div>
            <div className="hero-num accent">{cur(clvForecast.total)}</div>
            <div className="hero-cap">มูลค่าคาดการณ์ 12 เดือนข้างหน้า</div>
          </div>
        </div>
      </div>

      {/* Segment migration */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>การไหลของกลุ่ม (RFM) — {migration.windowDays} วันล่าสุด</h3>
        <p className="card-sub">ระบบเทียบกลุ่มของทุกคน “เมื่อ {migration.windowDays} วันก่อน” กับ “วันนี้” โดยเล่นเหตุการณ์ย้อนหลัง</p>
        <table className="tbl">
          <thead>
            <tr><th>กลุ่ม</th><th className="num">ก่อน</th><th className="num">ตอนนี้</th><th className="num">เปลี่ยน</th><th></th></tr>
          </thead>
          <tbody>
            {migration.perSegment
              .filter((s) => s.before > 0 || s.after > 0)
              .map((s) => (
                <tr key={s.segment}>
                  <td>
                    <span className="dot" style={{ background: SEGMENT_COLOR[s.segment as RfmSegment], marginRight: 7 }} />
                    {SEGMENT_LABEL[s.segment as RfmSegment]}
                  </td>
                  <td className="num">{s.before}</td>
                  <td className="num">{s.after}</td>
                  <td className={`num ${s.delta > 0 ? "pos" : s.delta < 0 ? "neg" : ""}`}>
                    {s.delta > 0 ? "+" : ""}{s.delta}
                  </td>
                  <td style={{ width: "34%" }}>
                    <span className="delta-bar-wrap">
                      <span
                        className={`delta-bar ${s.delta >= 0 ? "pos" : "neg"}`}
                        style={{ width: `${Math.min(100, (Math.abs(s.delta) / Math.max(1, totalMembers * 0.05)) * 100)}%` }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        <div className="grid grid-2" style={{ marginTop: 16 }}>
          <div>
            <div className="mini-head up">↗ เลื่อนขึ้น — ข่าวดี</div>
            {migration.upgraders.slice(0, 6).map((u) => (
              <div className="move-row" key={u.memberId}>
                <span className="move-name">{u.displayName}</span>
                <span className="move-path">
                  {SEGMENT_LABEL[u.from as RfmSegment]} <span className="arr">→</span> <b>{SEGMENT_LABEL[u.to]}</b>
                </span>
              </div>
            ))}
          </div>
          <div>
            <div className="mini-head down">↘ หล่นลง — รีบดูแล</div>
            {migration.downgraders.slice(0, 6).map((u) => (
              <div className="move-row" key={u.memberId}>
                <span className="move-name">{u.displayName}</span>
                <span className="move-path">
                  {SEGMENT_LABEL[u.from as RfmSegment]} <span className="arr">→</span> <b className="neg">{SEGMENT_LABEL[u.to]}</b>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Movers & shakers */}
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>💹 มาแรง — ยอดพุ่ง (90 วัน)</h3>
          <p className="card-sub">เทียบยอดซื้อ 90 วันล่าสุด กับ 90 วันก่อนหน้า</p>
          <table className="tbl">
            <thead><tr><th>ลูกค้า</th><th className="num">ก่อน</th><th className="num">ล่าสุด</th><th className="num">เพิ่ม</th></tr></thead>
            <tbody>
              {movers.climbers.map((m) => (
                <tr key={m.memberId}>
                  <td>{m.displayName}</td>
                  <td className="num dim">{cur(m.prior)}</td>
                  <td className="num">{cur(m.recent)}</td>
                  <td className="num pos">+{cur(m.delta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>🧊 เย็นลง — ยอดร่วง</h3>
          <p className="card-sub">เคยซื้อเยอะ แต่ 90 วันล่าสุดหายไป — โอกาสกู้กลับ</p>
          <table className="tbl">
            <thead><tr><th>ลูกค้า</th><th className="num">ก่อน</th><th className="num">ล่าสุด</th><th className="num">ลด</th></tr></thead>
            <tbody>
              {movers.fallers.map((m) => (
                <tr key={m.memberId}>
                  <td>{m.displayName}</td>
                  <td className="num dim">{cur(m.prior)}</td>
                  <td className="num">{cur(m.recent)}</td>
                  <td className="num neg">{cur(m.delta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Next best action */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>🎯 ควรเสนออะไรต่อ (Next-Best-Action)</h3>
        <p className="card-sub">
          จาก market-basket — “คนที่ซื้อ A มักซื้อ B มากกว่าปกติ (lift)” จับคู่กับสิ่งที่ลูกค้าแต่ละคน<b>ยังไม่มี</b> เรียงตามมูลค่า × ความมั่นใจ
        </p>
        <table className="tbl">
          <thead>
            <tr><th>ลูกค้า</th><th>ซื้อไปแล้ว</th><th>ควรเสนอต่อ</th><th>เพราะ</th><th className="num">lift</th><th className="num">มูลค่าสะสม</th></tr>
          </thead>
          <tbody>
            {nba.map((a) => (
              <tr key={a.memberId}>
                <td>{a.displayName}</td>
                <td className="dim">{a.owns.map(catLabel).join(", ")}</td>
                <td><b className="accent-t">{ACTION[a.recommend] ?? catLabel(a.recommend)}</b></td>
                <td className="dim">ซื้อ{catLabel(a.because)}แล้ว</td>
                <td className="num"><span className="lift-pill">{a.lift.toFixed(1)}×</span></td>
                <td className="num">{cur(a.spend)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Wallet share + Survival */}
      <div className="grid grid-2">
        <div className="card">
          <h3>👛 Wallet share — ลูกค้าซื้อลึกแค่ไหน</h3>
          <p className="card-sub">
            <b>{formatPct(wallet.singleCategoryBuyers / Math.max(1, wallet.totalBuyers))}</b> ของผู้ซื้อ ({formatNumber(wallet.singleCategoryBuyers)} คน)
            ซื้อแค่ <b>หมวดเดียว</b> — คือบ่อ cross-sell ก้อนใหญ่ที่สุด
          </p>
          <div className="wallet-row">
            <Donut
              data={walletData}
              centerLabel={wallet.avgCategories.toFixed(1)}
              centerSub="หมวด/คน เฉลี่ย"
            />
            <div className="wallet-legend">
              {wallet.categories.slice(0, 5).map((c, i) => (
                <div className="wl-item" key={c.category}>
                  <span className="dot" style={{ background: CAT_COLOR[i % CAT_COLOR.length] }} />
                  <span className="wl-name">{catLabel(c.category)}</span>
                  <span className="wl-pct">{formatPct(c.penetration)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="coverage">
            <div className="cov-head">มีกี่หมวดต่อคน</div>
            {wallet.coverage.map((c) => (
              <div className="cov-row" key={c.categories}>
                <span className="cov-k">{c.categories} หมวด</span>
                <span className="cov-track"><span className="cov-fill" style={{ width: `${(c.members / coverageMax) * 100}%` }} /></span>
                <span className="cov-n">{formatNumber(c.members)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>⏱️ ลูกค้ากลับมาซื้อซ้ำเร็วแค่ไหน</h3>
          <p className="card-sub">
            Kaplan-Meier: จากผู้ซื้อครั้งแรก เหลือกี่ % ที่<b>ยังไม่</b>ซื้อซ้ำ ณ แต่ละวัน
            {survival.medianDays != null
              ? <> — ครึ่งหนึ่งที่จะกลับมา ทำภายใน <b>{survival.medianDays} วัน</b></>
              : <> — เกินครึ่งยังไม่กลับมาในช่วงที่วัด</>}
          </p>
          <CurveChart points={survival.points} markerDay={survival.medianDays} />
          <div className="survival-legend">
            <span>ซื้อซ้ำแล้ว <b>{formatPct(survival.repeatRate)}</b> ของผู้ซื้อครั้งแรก</span>
            <span className="dim">กลุ่มตัวอย่าง {formatNumber(survival.sampleSize)} คน</span>
          </div>

          <div className="forecast">
            <div className="cov-head">Top มูลค่าคาดการณ์ (12 เดือน)</div>
            {clvForecast.top.slice(0, 5).map((c, i) => (
              <div className="fc-row" key={i}>
                <span className="fc-name">{c.displayName}</span>
                <span className="fc-val">{cur(c.predictedAnnual)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
