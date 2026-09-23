import Link from "next/link";
import { normalizeThaiMobile } from "@mstgolf/shared/phone";
import { lowestTier } from "@mstgolf/shared/tiers";
import { allowPage } from "../../lib/auth";
import { getCrmData, formatNumber } from "../../lib/data";
import { can } from "../../lib/permissions";
import { Forbidden } from "../Forbidden";
import { MembersTable, type MemberRow } from "./MembersTable";
import { photoVersion } from "./MemberAvatar";
import { SignupLinkButton } from "./SignupLinkButton";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const user = await allowPage("members.view");
  if (!user) return <Forbidden />;
  const canCreate = can(user.role, "members.create");
  const { members, rfm, clv, churn, org } = await getCrmData();
  const rfmById = new Map(rfm.map((r) => [r.memberId, r]));
  const clvById = new Map(clv.map((c) => [c.memberId, c]));
  const churnById = new Map(churn.map((c) => [c.memberId, c]));

  const rows: MemberRow[] = members
    .map((m) => {
      const r = rfmById.get(m.id);
      return {
        id: m.id,
        name: m.displayName ?? m.id,
        phone: normalizeThaiMobile(m.phone) ?? (m.phone ?? "").replace(/\D/g, ""),
        photo: photoVersion(m.pictureUrl),
        tier: m.tier ?? lowestTier(org.tiers).name,
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
      <div className="page-head page-head-actions">
        <div>
          <h1>สมาชิก</h1>
          <p>{formatNumber(members.length)} คน · ให้คะแนนจากความถี่ ความสดใหม่ ยอดซื้อ CLV และความเสี่ยงหลุด</p>
        </div>
        {canCreate && (
          <div className="head-actions">
            <SignupLinkButton orgName={org.name} signupBonus={org.signupBonus} />
            <Link href="/members/new" className="btn">+ เพิ่มสมาชิก</Link>
          </div>
        )}
      </div>
      <MembersTable rows={rows} />
    </>
  );
}
