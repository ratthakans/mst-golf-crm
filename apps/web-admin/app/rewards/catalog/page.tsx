import Link from "next/link";
import { listRewards } from "@mstgolf/core";
import { allowPage } from "../../../lib/auth";
import { currentOrg } from "../../../lib/org";
import { Forbidden } from "../../Forbidden";
import { formatBaht, formatDate, num } from "../../ui/format";

export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  const user = await allowPage("rewards.view");
  if (!user) return <Forbidden />;
  const org = await currentOrg();
  const rewards = await listRewards(org.id);
  const tierName = (k: string | null) => (k ? org.settings.tiers.find((t) => t.key === k)?.name ?? k : null);
  const now = new Date();
  const canManage = user.permissions.includes("rewards.manage");

  return (
    <>
      <Link href="/rewards" className="back-link">← รางวัล</Link>
      <div className="page-head">
        <div className="row between">
          <div>
            <h1>แคตตาล็อกรางวัล</h1>
            <p>สิ่งที่สมาชิกเห็นในหน้ารางวัลใน LINE · คูปองออกให้ทันที ส่วนของรางวัลเป็นคำขอที่ทีมต้องอนุมัติ</p>
          </div>
          {canManage && <Link href="/rewards/catalog/new" className="btn btn-sm">+ เพิ่มรางวัล</Link>}
        </div>
      </div>
      {rewards.length === 0 ? (
        <div className="empty">ยังไม่มีรางวัล{canManage ? " — กด เพิ่มรางวัล เพื่อเริ่ม เช่น คูปองส่วนลด ฿1,000 หรือ iPad" : ""}</div>
      ) : (
        <div className="card table-card table-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>รางวัล</th>
                <th>ประเภท</th>
                <th className="num">แต้ม</th>
                <th className="num">สต็อก</th>
                <th className="num">แลกแล้ว</th>
                <th>เงื่อนไข</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rewards.map((r) => {
                const live = r.isActive && (!r.startsAt || r.startsAt <= now) && (!r.endsAt || r.endsAt >= now);
                const cond = [
                  r.kind === "COUPON" && r.valueSatang ? `มูลค่า ${formatBaht(r.valueSatang)}` : null,
                  r.minSpendSatang ? `ขั้นต่ำ ${formatBaht(r.minSpendSatang)}` : null,
                  r.validDays ? `ใช้ได้ ${r.validDays} วัน` : null,
                  r.perMemberLimit ? `คนละ ${r.perMemberLimit} ครั้ง` : null,
                  tierName(r.minTier) ? `${tierName(r.minTier)} ขึ้นไป` : null,
                  r.endsAt ? `ถึง ${formatDate(r.endsAt)}` : null,
                ].filter(Boolean);
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/rewards/catalog/${r.id}`} className="member-cell">
                        {r.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.imageUrl} alt="" width={40} height={40} style={{ objectFit: "cover", borderRadius: 6 }} />
                        ) : (
                          <span className="avatar avatar-initial" style={{ width: 40, height: 40 }}>{r.kind === "COUPON" ? "฿" : "🎁"}</span>
                        )}
                        <span className="member-name">{r.name}</span>
                      </Link>
                    </td>
                    <td className="dim">{r.kind === "COUPON" ? "คูปอง" : "ของรางวัล"}</td>
                    <td className="num">{num(r.costPoints)}</td>
                    <td className="num">{r.stock === null ? "ไม่จำกัด" : <span className={r.stock === 0 ? "danger-text" : ""}>{num(r.stock)}</span>}</td>
                    <td className="num">{num(r.redeemed)}</td>
                    <td className="dim small">{cond.join(" · ") || "–"}</td>
                    <td>{live ? <span className="pill green">เปิดให้แลก</span> : r.isActive ? <span className="pill amber">นอกช่วงเวลา</span> : <span className="pill gray">ปิด</span>}</td>
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
