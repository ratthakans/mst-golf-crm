import Link from "next/link";
import { notFound } from "next/navigation";
import { getMember, memberActivity, memberBookings, memberCard, pointHistory } from "@mstgolf/core";
import { allowPage } from "../../../lib/auth";
import { currentOrg } from "../../../lib/org";
import { listAudit } from "../../../lib/users";
import type { Permission } from "../../../lib/permissions";
import { Forbidden } from "../../Forbidden";
import { formatBaht, formatDate, formatPhone, num, SOURCE_LABEL } from "../../ui/format";
import { TierPill, tierInfo } from "../../ui/TierPill";
import { MemberAvatar, photoVersion } from "../MemberAvatar";
import { MemberActions } from "./MemberActions";
import { MemberTabs } from "./MemberTabs";
import { PhotoUploader } from "./PhotoUploader";

export const dynamic = "force-dynamic";

export default async function MemberPage({ params, searchParams }: { params: { id: string }; searchParams: { created?: string } }) {
  const user = await allowPage("members.view");
  if (!user) return <Forbidden />;
  const org = await currentOrg();
  const member = await getMember(org.id, params.id);
  if (!member) notFound();
  const can = (p: Permission) => user.permissions.includes(p);
  const active = member.status === "ACTIVE";

  if (!active) {
    return (
      <div className="stack">
        <Link href="/members" className="back-link">← สมาชิก</Link>
        <div className="card">
          <h1 style={{ margin: 0 }}>{member.displayName}</h1>
          <p className="muted">
            {member.code} · {member.status === "MERGED" ? "บัญชีนี้ถูกรวมเข้ากับบัญชีอื่นแล้ว" : "ข้อมูลส่วนบุคคลถูกลบตามคำขอ (PDPA)"}
          </p>
        </div>
      </div>
    );
  }

  const [card, activity, points, bookings, audit] = await Promise.all([
    memberCard(org.id, member.id),
    memberActivity(org.id, member.id),
    pointHistory(org.id, member.id, 200),
    memberBookings(org.id, member.id),
    can("audit.view") ? listAudit({ entity: "member", entityId: member.id, limit: 100 }) : Promise.resolve([]),
  ]);
  const t = tierInfo(member.tier, org.settings.tiers);
  const showMoney = can("dashboard.revenue");

  return (
    <div className="stack">
      <Link href="/members" className="back-link">← สมาชิก</Link>
      {searchParams.created && <div className="form-ok">สร้างสมาชิกแล้ว — ได้แต้มต้อนรับ {num(org.settings.welcomeBonus)} แต้ม</div>}

      <div className="card">
        <div className="member-card-head">
          {can("members.edit") ? (
            <PhotoUploader memberId={member.id} name={member.displayName} version={photoVersion(member.pictureUrl)} />
          ) : (
            <MemberAvatar id={member.id} name={member.displayName} version={photoVersion(member.pictureUrl)} size={64} />
          )}
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="row" style={{ gap: 10 }}>
              <h1>{member.displayName}</h1>
              <TierPill {...t} />
            </div>
            <div className="member-meta">
              <span className="mono">{member.code}</span>
              <span>· {formatPhone(member.phone)} {member.phone && !member.phoneVerified && <span className="pill amber">ยังไม่ยืนยันที่ร้าน</span>}</span>
              <span>· {member.hasLine ? (member.lineReachable ? <span className="pill green">LINE</span> : <span className="pill red">LINE ส่งไม่ถึง</span>) : <span className="pill gray">ยังไม่ผูก LINE</span>}</span>
              <span>· สมัครทาง {SOURCE_LABEL[member.source] ?? member.source} {formatDate(member.createdAt)}</span>
              {activity.openReviews > 0 && <Link href="/reviews" className="pill amber">มีเรื่องรอตรวจ {activity.openReviews}</Link>}
            </div>
          </div>
        </div>

        <div className="member-stats">
          <div className="card">
            <div className="label">แต้มคงเหลือ</div>
            <div className="value">{num(member.points)}</div>
          </div>
          {showMoney && (
            <div className="card">
              <div className="label">ยอดซื้อ 12 เดือน</div>
              <div className="value">{formatBaht(member.spend12mSatang)}</div>
              {card.next ? (
                <>
                  <div className="progress"><i style={{ width: `${Math.round(card.next.pct * 100)}%` }} /></div>
                  <div className="muted small" style={{ marginTop: 6 }}>อีก ฿{num(Math.ceil(card.next.remainingBaht))} ถึง {card.next.name}</div>
                </>
              ) : (
                <div className="muted small" style={{ marginTop: 6 }}>ระดับสูงสุดแล้ว</div>
              )}
            </div>
          )}
          {showMoney && (
            <div className="card">
              <div className="label">ยอดซื้อสะสม</div>
              <div className="value">{formatBaht(member.lifetimeSatang)}</div>
              <div className="muted small" style={{ marginTop: 6 }}>ซื้อล่าสุด {formatDate(member.lastPurchaseAt)}</div>
            </div>
          )}
          <div className="card">
            <div className="label">สิทธิ์ระดับ {card.tier.name}</div>
            <div className="small" style={{ marginTop: 6, lineHeight: 1.7 }}>
              แต้ม ×{card.tier.pointRate} · ส่วนลดร้าน {card.tier.discountPct}% · ส่วนลดซิม {card.tier.simDiscountPct}%
              <br />จองซิมล่วงหน้า {card.tier.bookingDaysAhead} วัน · ไม่มาตามนัด {member.noShowCount} ครั้ง
            </div>
          </div>
        </div>

        <MemberActions
          member={{ id: member.id, code: member.code, displayName: member.displayName, phone: member.phone, birthday: member.birthday, email: member.email, points: member.points }}
          can={{
            edit: can("members.edit"),
            adjust: can("points.adjust"),
            merge: can("members.merge"),
            erase: can("members.erase"),
            request: can("reviews.request") && !can("reviews.resolve"),
            book: can("booking.manage"),
          }}
          role={user.role}
        />
      </div>

      <MemberTabs
        showMoney={showMoney}
        sales={activity.sales.map((s) => ({ ...s, occurredAt: s.occurredAt.toISOString() }))}
        points={points.map((p) => ({ ...p, at: p.at.toISOString() }))}
        bookings={[...bookings.upcoming, ...bookings.past].map((b) => ({
          id: b.id,
          startAt: b.startAt.toISOString(),
          laneName: b.laneName,
          partySize: b.partySize,
          status: b.status,
          source: b.source,
          priceSatang: b.priceSatang,
          paidSatang: b.paidSatang,
        }))}
        identities={activity.identities.map((i) => ({ ...i, verifiedAt: i.verifiedAt?.toISOString() ?? null, createdAt: i.createdAt.toISOString() }))}
        consents={activity.consents.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
        events={activity.events.map((e) => ({ ...e, occurredAt: e.occurredAt.toISOString() }))}
        audit={audit.map((a) => ({ id: a.id, action: a.action, userName: a.userName, reason: a.reason, createdAt: a.createdAt.toISOString(), after: a.after }))}
        showAudit={can("audit.view")}
        tierNames={Object.fromEntries(org.settings.tiers.map((x) => [x.key, x.name]))}
      />
    </div>
  );
}
