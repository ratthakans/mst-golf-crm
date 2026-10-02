import Link from "next/link";
import { notFound } from "next/navigation";
import { getRedemption, REDEMPTION_STATUS_LABEL, type Delivery, type RedemptionStatus } from "@mstgolf/core";
import { allowPage } from "../../../../lib/auth";
import { currentOrg } from "../../../../lib/org";
import { Forbidden } from "../../../Forbidden";
import { formatBaht, formatDateTime, formatPhone, num, REDEMPTION_STATUS } from "../../../ui/format";
import { TierPill, tierInfo } from "../../../ui/TierPill";
import { RedemptionActions } from "./RedemptionActions";

export const dynamic = "force-dynamic";

interface HistoryEntry {
  status: RedemptionStatus;
  at: string;
  by: string;
  note?: string | null;
}

export default async function RedemptionPage({ params }: { params: { id: string } }) {
  const user = await allowPage("rewards.view");
  if (!user) return <Forbidden />;
  const org = await currentOrg();
  const r = await getRedemption(org.id, params.id);
  if (!r) notFound();
  const expired = r.status === "ISSUED" && r.expiresAt && r.expiresAt < new Date();
  const st = REDEMPTION_STATUS[expired ? "EXPIRED" : r.status]!;
  const delivery = r.delivery as Delivery | null;
  const history = (r.history as unknown as HistoryEntry[]) ?? [];
  const who = (by: string) => (by === "member" ? "สมาชิก" : by === "system" ? "ระบบ" : r.names[by] ?? "พนักงาน");
  const canAct = user.permissions.includes("redemptions.process") && r.next.length > 0 && !expired;

  return (
    <div className="stack">
      <Link href={r.kind === "COUPON" ? "/rewards?view=coupons" : "/rewards"} className="back-link">← รางวัล</Link>
      <div className="card">
        <div className="row between">
          <div>
            <div className="row">
              <h1 style={{ margin: 0 }} className="mono">{r.code}</h1>
              <span className={`pill ${st.tone}`}>{st.label}</span>
            </div>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              {r.kind === "COUPON" ? "คูปอง" : "ของรางวัล"} · {r.rewardName} · {num(r.costPoints)} แต้ม · ขอเมื่อ {formatDateTime(r.createdAt)}
            </p>
          </div>
          {r.member.status === "ACTIVE" && (
            <Link href={`/members/${r.member.id}`} className="btn btn-ghost btn-sm">
              {r.member.displayName} · {r.member.code} →
            </Link>
          )}
        </div>
        <dl className="kv" style={{ marginTop: 16 }}>
          <dt>สมาชิก</dt>
          <dd>
            {r.member.displayName} <span className="mono muted">{r.member.code}</span> <TierPill {...tierInfo(r.member.tier, org.settings.tiers)} /> · แต้มคงเหลือ {num(r.member.points)}
          </dd>
          {r.kind === "COUPON" ? (
            <>
              <dt>รหัสคูปอง</dt>
              <dd className="mono">{r.couponCode}</dd>
              <dt>มูลค่า</dt>
              <dd>{r.valueSatang ? formatBaht(r.valueSatang) : "–"}{r.reward.minSpendSatang ? ` · ขั้นต่ำ ${formatBaht(r.reward.minSpendSatang)}` : ""}</dd>
              <dt>ใช้ได้ถึง</dt>
              <dd>{formatDateTime(r.expiresAt)}</dd>
              {r.usedAt && (
                <>
                  <dt>ใช้เมื่อ</dt>
                  <dd>
                    {formatDateTime(r.usedAt)}
                    {r.usedStore ? ` · ${r.usedStore.name}` : ""}
                    {r.usedInvoiceNo ? ` · บิล ${r.usedInvoiceNo}` : ""}
                    {r.usedById ? ` · โดย ${r.names[r.usedById] ?? "พนักงาน"}` : ""}
                  </dd>
                </>
              )}
            </>
          ) : (
            <>
              <dt>การรับของ</dt>
              <dd>{delivery?.method === "SHIP" ? "จัดส่งตามที่อยู่" : `รับที่ร้าน${r.pickupStoreName ? ` · ${r.pickupStoreName}` : ""}`}</dd>
              {delivery ? (
                <>
                  <dt>ผู้รับ</dt>
                  <dd>{delivery.name} · <span className="mono">{formatPhone(delivery.phone)}</span></dd>
                  {delivery.address && (
                    <>
                      <dt>ที่อยู่</dt>
                      <dd style={{ whiteSpace: "pre-line" }}>{delivery.address}</dd>
                    </>
                  )}
                </>
              ) : (
                <>
                  <dt>ผู้รับ</dt>
                  <dd className="muted">ข้อมูลถูกลบตามคำขอ PDPA</dd>
                </>
              )}
              {r.reward.fulfilment && (
                <>
                  <dt>ระยะเวลาที่แจ้งลูกค้า</dt>
                  <dd>{r.reward.fulfilment}</dd>
                </>
              )}
              {(r.trackingNo || r.carrier) && (
                <>
                  <dt>พัสดุ</dt>
                  <dd className="mono">{[r.carrier, r.trackingNo].filter(Boolean).join(" · ")}</dd>
                </>
              )}
              <dt>ผู้รับผิดชอบ</dt>
              <dd>{r.ownerId ? r.names[r.ownerId] ?? "พนักงาน" : <span className="muted">ยังไม่มี — คนแรกที่เปลี่ยนสถานะจะเป็นเจ้าของเคส</span>}</dd>
            </>
          )}
          {r.note && (
            <>
              <dt>ข้อความถึงลูกค้า</dt>
              <dd>{r.note}</dd>
            </>
          )}
          {r.reward.stock !== null && (
            <>
              <dt>สต็อกตอนนี้</dt>
              <dd>{num(r.reward.stock)}</dd>
            </>
          )}
        </dl>
        {canAct && (
          <RedemptionActions
            id={r.id}
            kind={r.kind}
            status={r.status}
            next={r.next.map((s) => ({ status: s, label: REDEMPTION_STATUS_LABEL[s] }))}
            carrier={r.carrier}
            trackingNo={r.trackingNo}
            mine={r.ownerId === user.id}
            method={delivery?.method ?? null}
            points={r.costPoints}
          />
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>ประวัติสถานะ</h3>
        <ol className="timeline" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {history.map((h, i) => (
            <li key={i} className="tl-row">
              <div className="tl-body">
                <div className="tl-head">
                  <span className={`pill ${REDEMPTION_STATUS[h.status]?.tone ?? "gray"}`}>{REDEMPTION_STATUS[h.status]?.label ?? h.status}</span>
                  <span className="tl-date">{formatDateTime(h.at)} · {who(h.by)}</span>
                </div>
                {h.note && <div className="tl-detail">{h.note}</div>}
              </div>
            </li>
          ))}
        </ol>
        <p className="muted small">ทุกการเปลี่ยนสถานะส่งข้อความ LINE ถึงสมาชิก · ไม่อนุมัติ/ยกเลิก = คืนแต้มและคืนสต็อกอัตโนมัติ</p>
      </div>
    </div>
  );
}
