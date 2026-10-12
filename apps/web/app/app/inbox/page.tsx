import type { Metadata } from "next";
import Link from "next/link";
import { memberInbox } from "@mstgolf/core";
import { LoginPanel } from "@/components/customer/LoginPanel";
import { MarkRead } from "@/components/customer/MarkRead";
import { formatThaiDate } from "@/lib/format";
import { currentMember } from "@/lib/member";
import { getOrg, loginSetup } from "@/lib/org";
import { toInboxRow } from "@/lib/views";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "การแจ้งเตือน", robots: { index: false, follow: false } };

// /app/inbox — every message the store has for this member: points, tier,
// bookings, coupons and reward requests, birthday. The same content goes by
// email when the member gave one (and by LINE when the tenant has LINE on).
export default async function InboxPage() {
  const org = await getOrg();
  const { member } = await currentMember();
  if (!member) return <LoginPanel setup={await loginSetup(org.id)} purpose="member" />;
  const items = (await memberInbox(org.id, member.id)).map(toInboxRow);
  const unread = items.some((i) => !i.read);

  return (
    <section className="inbox">
      <h1 className="panel-title">การแจ้งเตือน</h1>
      {unread && <MarkRead />}
      {items.length === 0 ? (
        <p className="empty">ยังไม่มีการแจ้งเตือน เมื่อได้แต้ม จองซิม หรือแลกรางวัล รายละเอียดจะอยู่ที่นี่</p>
      ) : (
        <ol className="inbox-list">
          {items.map((n) => (
            <li key={n.id} className={`inbox-item${n.read ? "" : " unread"}`}>
              <div className="inbox-head">
                <h2>{n.title}</h2>
                <time dateTime={n.at}>{formatThaiDate(new Date(n.at))}</time>
              </div>
              {n.lead && <p className="inbox-lead">{n.lead}</p>}
              {n.rows.length > 0 && (
                <dl className="summary">
                  {n.rows.map((r) => (
                    <div key={r.label}>
                      <dt>{r.label}</dt>
                      <dd className={r.strong ? "strong" : undefined}>{r.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {n.foot && <p className="hint">{n.foot}</p>}
              {n.link && (
                <Link href={n.link.href} className="text-link">
                  {n.link.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="hint center">
        {member.email && member.emailNotify ? `ส่งสำเนาทางอีเมล ${member.email} ด้วย · ` : "ใส่อีเมลในโปรไฟล์ เพื่อรับสำเนาทางอีเมล · "}
        <Link href="/app/member?tab=profile">ตั้งค่า</Link>
      </p>
    </section>
  );
}
