import Link from "next/link";
import { notFound } from "next/navigation";
import { getCrmData, formatCurrency, formatNumber, formatPct } from "../../../lib/data";
import { SEGMENT_COLOR, SEGMENT_LABEL } from "../../../lib/segments";
import { LogPurchase } from "./LogPurchase";
import { PhotoUploader } from "./PhotoUploader";
import { MemberAvatar, photoVersion } from "../MemberAvatar";
import { allowPage } from "../../../lib/auth";
import { can } from "../../../lib/permissions";
import { Forbidden } from "../../Forbidden";
import type { EventTypeName } from "@mstgolf/analytics";
import { findTier, lowestTier, tierProgress } from "@mstgolf/shared/tiers";

const EVENT_META: Record<string, { icon: string; label: string }> = {
  REGISTER: { icon: "✨", label: "สมัครสมาชิก" },
  PURCHASE: { icon: "🛒", label: "ซื้อสินค้า" },
  VISIT: { icon: "📍", label: "เข้าร้าน" },
  FITTING_BOOKING: { icon: "🎯", label: "จองฟิตติ้ง" },
  REDEEM_POINTS: { icon: "🎁", label: "แลกของรางวัล" },
  CLICK_PROMO: { icon: "👆", label: "กดโปรโมชัน" },
  EARN_POINTS: { icon: "➕", label: "ได้แต้ม" },
  OPEN_MENU: { icon: "📱", label: "เปิดเมนู" },
  TIER_UP: { icon: "⬆️", label: "เลื่อนระดับ" },
  PROFILE_UPDATE: { icon: "✏️", label: "แก้ไขโปรไฟล์" },
  SCAN_QR: { icon: "🔳", label: "สแกน QR" },
};

const CHURN_STATUS_TH: Record<string, string> = {
  active: "ยังใช้งาน",
  cooling: "เริ่มห่าง",
  at_risk: "เสี่ยง",
  churned: "หายไป",
};

function prettyAttr(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export default async function MemberDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await allowPage("members.view");
  if (!user) return <Forbidden />;
  const { org, members, events, rfm, clv, churn, profiles } = await getCrmData();
  const member = members.find((m) => m.id === params.id);
  if (!member) notFound();

  const r = rfm.find((x) => x.memberId === member.id);
  const c = clv.find((x) => x.memberId === member.id);
  const ch = churn.find((x) => x.memberId === member.id);
  const seg = r?.segment ?? "Regular";
  const timeline = events
    .filter((e) => e.memberId === member.id)
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const attrs = Object.entries(member.attributes ?? {});
  const spend12m = profiles.find((p) => p.memberId === member.id)?.spend12m ?? 0;
  const tier = findTier(member.tier, org.tiers) ?? lowestTier(org.tiers);
  const progress = tierProgress(spend12m, org.tiers);

  return (
    <>
      <div className="page-head">
        <Link href="/members" className="back-link">← สมาชิก</Link>
        <div className="member-head">
          {can(user.role, "members.edit") ? (
            <PhotoUploader
              memberId={member.id}
              name={member.displayName ?? member.id}
              version={photoVersion(member.pictureUrl)}
            />
          ) : (
            <MemberAvatar id={member.id} name={member.displayName ?? member.id} version={photoVersion(member.pictureUrl)} size={64} />
          )}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0 }}>{member.displayName}</h1>
              <span className={`badge tier-${member.tier}`}>{member.tier}</span>
              <span className="badge seg-badge" style={{ background: SEGMENT_COLOR[seg] }}>{SEGMENT_LABEL[seg]}</span>
            </div>
            <p style={{ marginTop: 6 }}>
              {member.phone ?? "ไม่มีเบอร์"} · {member.email ?? "ไม่มีอีเมล"} · สมัคร{" "}
              {member.createdAt.toLocaleDateString("en-GB")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card stat"><div className="label">แต้มสะสม</div><div className="value">{formatNumber(member.points)}</div></div>
        <div className="card stat"><div className="label">ยอดซื้อสะสม</div><div className="value">{formatCurrency(r?.monetary ?? 0, org.currency)}</div><div className="sub">{r?.frequency ?? 0} ออเดอร์</div></div>
        <div className="card stat"><div className="label">CLV คาดการณ์</div><div className="value accent">{formatCurrency(Math.round(c?.predictedLifetime ?? 0), org.currency)}</div><div className="sub">เฉลี่ย {formatCurrency(Math.round(c?.avgOrderValue ?? 0), org.currency)}/ครั้ง</div></div>
        <div className="card stat"><div className="label">ความเสี่ยงหลุด</div><div className={`value ${(ch?.probability ?? 0) > 0.5 ? "warn" : ""}`}>{formatPct(ch?.probability ?? 0)}</div><div className="sub">{CHURN_STATUS_TH[ch?.status ?? "active"]} · เงียบ {r?.recencyDays ?? 0} วัน</div></div>
      </div>

      <div className="card tier-card" style={{ marginBottom: 16 }}>
        <div className="tier-card-head">
          <h3 style={{ margin: 0 }}>ระดับสมาชิก</h3>
          <span className={`badge tier-${tier.name}`}>{tier.name}</span>
          <span className="tier-card-rate">แต้ม ×{tier.pointRate}</span>
        </div>
        <div className="tier-card-meta">
          <span>ยอดซื้อ 12 เดือน <strong>{formatCurrency(spend12m, org.currency)}</strong></span>
          <span>
            {progress.next
              ? <>อีก <strong>{formatCurrency(progress.remaining ?? 0, org.currency)}</strong> ถึง {progress.next.name}</>
              : "ระดับสูงสุด"}
          </span>
        </div>
        <div className="tier-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.pct * 100)}>
          <div className="tier-fill" style={{ width: `${Math.round(progress.pct * 100)}%` }} />
        </div>
        <div className="tier-benefits">
          <span>ส่วนลดร้าน {tier.benefits.discountPct}%</span>
          <span>ส่วนลดซิม {tier.benefits.simDiscountPct}%</span>
          <span>จองซิมล่วงหน้า {tier.benefits.simBookingDaysAhead} วัน</span>
          <span>แต้มเดือนเกิด ×{tier.benefits.birthdayPointMultiplier}</span>
          {tier.benefits.exclusiveCampaigns && <span>แคมเปญเฉพาะระดับ</span>}
        </div>
      </div>

      <div className="grid grid-2">
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3>โปรไฟล์กอล์ฟ</h3>
            {attrs.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>ยังไม่มีข้อมูลโปรไฟล์</p>}
            <div className="attr-grid">
              {attrs.map(([k, v]) => (
                <div className="attr-row" key={k}>
                  <span className="attr-key">{k}</span>
                  <span className="attr-val">{prettyAttr(v)}</span>
                </div>
              ))}
            </div>
          </div>

          {can(user.role, "sales.record") && (
            <div className="card">
              <h3>บันทึกการซื้อ</h3>
              <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
                สร้าง event การซื้อ + แต้ม + อัปเดตระดับ แล้วคำนวณ RFM/CLV ใหม่ทันที
              </p>
              <LogPurchase memberId={member.id} />
            </div>
          )}
        </div>

        <div className="card">
          <h3>ไทม์ไลน์พฤติกรรม · {timeline.length} รายการ</h3>
          <div className="timeline">
            {timeline.map((e, i) => {
              const base = EVENT_META[e.type as EventTypeName] ?? { icon: "•", label: e.type };
              const photoChange = e.type === "PROFILE_UPDATE" && e.payload?.field === "picture";
              const meta = photoChange
                ? { icon: "🖼️", label: e.payload?.action === "removed" ? "ลบรูปโปรไฟล์" : "อัปโหลดรูปโปรไฟล์" }
                : base;
              const amount = e.payload?.amount;
              const items = e.payload?.items ?? [];
              return (
                <div className="tl-row" key={i}>
                  <div className="tl-icon">{meta.icon}</div>
                  <div className="tl-body">
                    <div className="tl-head">
                      <span className="tl-label">{meta.label}</span>
                      <span className="tl-date">{e.occurredAt.toLocaleDateString("en-GB")}</span>
                    </div>
                    {amount !== undefined && (
                      <div className="tl-detail">
                        {formatCurrency(amount, org.currency)}
                        {items.length > 0 && ` — ${items.map((it) => it.name).join(", ")}`}
                      </div>
                    )}
                    {e.type === "REDEEM_POINTS" && e.payload?.reward != null && (
                      <div className="tl-detail">{String(e.payload.reward)}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
