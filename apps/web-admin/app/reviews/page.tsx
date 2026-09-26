import Link from "next/link";
import { db } from "@mstgolf/core";
import { allowPage } from "../../lib/auth";
import { currentOrg } from "../../lib/org";
import { Forbidden } from "../Forbidden";
import { formatDateTime, formatPhone } from "../ui/format";
import { ResolveButtons } from "./ResolveButtons";

export const dynamic = "force-dynamic";

const KIND: Record<string, { label: string; tone: string; how: string }> = {
  PHONE_CONFLICT: {
    label: "เบอร์ชนกัน",
    tone: "amber",
    how: "มีคนใช้ LINE อีกบัญชีสมัครด้วยเบอร์ที่ผูก LINE ไว้แล้ว — โทรถามลูกค้า ถ้าเป็นคนเดียวกันที่เปลี่ยน LINE ให้ลบ LINE เดิม (ลบข้อมูลตัวตน) แล้วให้ลูกค้าสมัครใหม่ ถ้าเป็นคนละคน ให้แก้เบอร์ที่ผิด",
  },
  MERGE_REQUEST: { label: "ขอรวมบัญชี", tone: "blue", how: "เปิดสมาชิก แล้วใช้ปุ่ม รวมบัญชีซ้ำ" },
  ERASE_REQUEST: { label: "ขอลบข้อมูล", tone: "red", how: "ตรวจตัวตนลูกค้า แล้วเปิดสมาชิกและใช้ปุ่ม ลบข้อมูล (PDPA)" },
};

export default async function ReviewsPage({ searchParams }: { searchParams: { status?: string } }) {
  const user = await allowPage("reviews.request");
  if (!user) return <Forbidden />;
  const org = await currentOrg();
  const status = searchParams.status === "closed" ? "closed" : "open";
  const items = await db(org.id).reviewItem.findMany({
    where: status === "open" ? { status: "OPEN" } : { status: { in: ["DONE", "DISMISSED"] } },
    orderBy: { createdAt: status === "open" ? "asc" : "desc" },
    take: 200,
    include: { member: { select: { id: true, code: true, displayName: true, status: true } } },
  });
  const canResolve = user.permissions.includes("reviews.resolve");

  return (
    <>
      <div className="page-head">
        <h1>คิวตรวจสอบ</h1>
        <p>เรื่องที่ต้องมีคนตัดสินใจ: เบอร์ชนกันตอนสมัคร คำขอรวมบัญชี และคำขอลบข้อมูลตาม PDPA</p>
      </div>
      <div className="tabs">
        <Link href="/reviews" className={`tab${status === "open" ? " on" : ""}`}>รอดำเนินการ</Link>
        <Link href="/reviews?status=closed" className={`tab${status === "closed" ? " on" : ""}`}>ปิดแล้ว</Link>
      </div>
      {items.length === 0 ? (
        <div className="empty">{status === "open" ? "ไม่มีเรื่องค้าง 🎉" : "ยังไม่มีรายการที่ปิด"}</div>
      ) : (
        <div className="stack">
          {items.map((it) => {
            const k = KIND[it.kind]!;
            const p = (it.payload ?? {}) as Record<string, unknown>;
            return (
              <div key={it.id} className="card">
                <div className="row between">
                  <div className="row">
                    <span className={`pill ${k.tone}`}>{k.label}</span>
                    <span className="muted small">{formatDateTime(it.createdAt)}</span>
                    {it.status !== "OPEN" && <span className="pill gray">{it.status === "DONE" ? "ดำเนินการแล้ว" : "ไม่ดำเนินการ"}</span>}
                  </div>
                  {it.member && (
                    <Link href={`/members/${it.member.id}`} className="btn btn-ghost btn-sm">
                      {it.member.displayName} · {it.member.code} →
                    </Link>
                  )}
                </div>
                <dl className="kv" style={{ marginTop: 12 }}>
                  {it.kind === "PHONE_CONFLICT" && (
                    <>
                      <dt>เบอร์</dt>
                      <dd className="mono">{formatPhone(String(p.phone ?? ""))}</dd>
                      <dt>ผู้สมัครใหม่</dt>
                      <dd>{String(p.fullName ?? "–")} · ทาง {p.channel === "WEB" ? "เว็บไซต์" : "LINE"}</dd>
                    </>
                  )}
                  {it.kind === "MERGE_REQUEST" && p.otherCode ? (
                    <>
                      <dt>อีกบัญชี</dt>
                      <dd className="mono">{String(p.otherCode)}</dd>
                    </>
                  ) : null}
                  {typeof p.requestedBy === "string" && (
                    <>
                      <dt>ผู้ขอ</dt>
                      <dd>{p.requestedBy}</dd>
                    </>
                  )}
                  {it.note && (
                    <>
                      <dt>รายละเอียด</dt>
                      <dd>{it.note}</dd>
                    </>
                  )}
                </dl>
                {it.status === "OPEN" && <p className="muted small" style={{ marginTop: 10 }}>วิธีจัดการ: {k.how}</p>}
                {it.status === "OPEN" && canResolve && <ResolveButtons id={it.id} />}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
