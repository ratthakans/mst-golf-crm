import { getCrmData, formatNumber } from "../../lib/data";
import { MembersTable, type MemberRow } from "./MembersTable";

export default async function MembersPage() {
  const { members, rfm, clv, churn } = await getCrmData();
  const rfmById = new Map(rfm.map((r) => [r.memberId, r]));
  const clvById = new Map(clv.map((c) => [c.memberId, c]));
  const churnById = new Map(churn.map((c) => [c.memberId, c]));

  const rows: MemberRow[] = members
    .map((m) => {
      const r = rfmById.get(m.id);
      return {
        id: m.id,
        name: m.displayName ?? m.id,
        tier: m.tier ?? "Silver",
        seg: r?.segment ?? "Regular",
        points: m.points,
        spend: r?.monetary ?? 0,
        clv: Math.round(clvById.get(m.id)?.predictedLifetime ?? 0),
        churnPct: Math.round((churnById.get(m.id)?.probability ?? 0) * 100),
        churnStatus: churnById.get(m.id)?.status ?? "active",
        recency: r?.recencyDays ?? 0,
      };
    })
    .sort((a, b) => b.clv - a.clv);

  return (
    <>
      <div className="page-head">
        <h1>สมาชิก</h1>
        <p>{formatNumber(members.length)} คน · ให้คะแนนจากความถี่ ความสดใหม่ ยอดซื้อ CLV และความเสี่ยงหลุด</p>
      </div>
      <MembersTable rows={rows} />
    </>
  );
}
