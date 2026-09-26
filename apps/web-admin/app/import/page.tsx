import { dataQuality, listImports, listStores, POS_FIELD_LABEL } from "@mstgolf/core";
import { allowPage } from "../../lib/auth";
import { currentOrg } from "../../lib/org";
import { Forbidden } from "../Forbidden";
import { formatBaht, formatDateTime, num, pct } from "../ui/format";
import { ImportView } from "./ImportView";
import { RollbackButton } from "./RollbackButton";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const user = await allowPage("import.run");
  if (!user) return <Forbidden />;
  const org = await currentOrg();
  const [stores, history, quality] = await Promise.all([listStores(org.id), listImports(org.id, 30), dataQuality(org.id, 14)]);
  const tag = org.settings.pos.memberTag;
  const last7 = quality.days.slice(-7);
  const bills7 = last7.reduce((s, d) => s + d.bills, 0);
  const with7 = last7.reduce((s, d) => s + d.withMember, 0);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>นำเข้ายอดขาย POS</h1>
        <p>
          ตอนขาย ใส่ <code>{tag}:เบอร์มือถือ</code> หรือ <code>{tag}:รหัสสมาชิก</code> ในหมายเหตุบิล · สิ้นวัน export ไฟล์ CSV จาก POS แล้ววางที่นี่ ·
          ระบบให้แต้ม เลื่อนระดับ และแจ้งลูกค้าทาง LINE ให้เอง · นำเข้าไฟล์เดิมซ้ำ แต้มไม่เบิ้ล
        </p>
      </div>

      <ImportView
        stores={stores.filter((s) => s.isActive).map((s) => ({ id: s.id, name: s.name }))}
        fieldLabels={POS_FIELD_LABEL}
        savedMapping={!!org.settings.pos.mapping}
      />

      <div className="grid grid-2">
        <div className="card">
          <h3>คุณภาพข้อมูล 7 วันล่าสุด</h3>
          <p className="muted-sub">บิลที่มีเลขสมาชิก {num(with7)} จาก {num(bills7)} บิล ({pct(bills7 ? with7 / bills7 : null)})</p>
          {last7.length === 0 ? (
            <p className="muted small">ยังไม่มีบิล</p>
          ) : (
            <div className="bars-v" style={{ height: 120 }}>
              {last7.map((d) => (
                <div className="b" key={d.date} title={`${d.date}: ${d.withMember}/${d.bills}`}>
                  <em>{Math.round(d.pct * 100)}%</em>
                  <i style={{ height: `${d.pct * 100}%`, background: d.pct >= 0.7 ? "var(--brand)" : d.pct >= 0.4 ? "#f59e0b" : "var(--atrisk)" }} />
                  <span>{d.date.slice(8)}/{d.date.slice(5, 7)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3>บิลที่หาเจ้าของไม่ได้ (14 วัน)</h3>
          <dl className="kv">
            <dt>ไม่มี {tag} ในหมายเหตุ</dt>
            <dd className="mono">{num(quality.noRef)} บิล</dd>
            <dt>เบอร์/รหัสอ่านไม่ได้</dt>
            <dd className="mono">{num(quality.badRefs)} บิล</dd>
            <dt>รหัสสมาชิกไม่มีในระบบ</dt>
            <dd className="mono">{num(quality.unknownCodes)} บิล</dd>
          </dl>
          <p className="muted small" style={{ marginTop: 12 }}>
            บิลเหล่านี้นำเข้าแล้วแต่ไม่มีใครได้แต้ม — ดาวน์โหลดรายการจากประวัติด้านล่างเพื่อตามแก้ที่ POS
          </p>
        </div>
      </div>

      <div className="card table-card">
        <h3>ประวัติการนำเข้า</h3>
        {history.length === 0 ? (
          <div className="empty">ยังไม่เคยนำเข้า</div>
        ) : (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>นำเข้าเมื่อ</th>
                  <th>ไฟล์</th>
                  <th className="num">บิล</th>
                  <th className="num">ยอดขาย</th>
                  <th className="num">แต้มที่ให้</th>
                  <th className="num">มีปัญหา</th>
                  <th>โดย</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const problems = (h.counts.unmatched ?? 0) + (h.counts.invalid ?? 0) + (h.counts.duplicate ?? 0);
                  return (
                    <tr key={h.id} className={h.status === "ROLLED_BACK" ? "row-muted" : ""}>
                      <td className="nowrap">
                        {formatDateTime(h.committedAt ?? h.createdAt)}
                        {h.status === "ROLLED_BACK" && <span className="sub">ยกเลิกแล้ว {formatDateTime(h.rolledBackAt)}</span>}
                      </td>
                      <td>
                        {h.fileName}
                        <span className="sub">{h.mode === "HISTORY" ? "ย้อนหลัง (ไม่ให้แต้ม) · " : ""}{h.counts.from ? `${h.counts.from.slice(0, 10)} – ${(h.counts.to ?? "").slice(0, 10)}` : ""}</span>
                      </td>
                      <td className="num">{num(h.counts.ok + h.counts.unmatched)}</td>
                      <td className="num">{formatBaht(h.counts.salesSatang ?? 0)}</td>
                      <td className="num">{num(h.counts.pointsAwarded ?? 0)}</td>
                      <td className="num">
                        {problems ? <a href={`/api/import/${h.id}/problems`}>{num(problems)} ↓</a> : <span className="dim">0</span>}
                      </td>
                      <td className="dim">{h.uploadedBy ?? "–"}</td>
                      <td>{h.canRollback && <RollbackButton id={h.id} fileName={h.fileName} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
