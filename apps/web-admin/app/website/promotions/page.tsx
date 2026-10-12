import Link from "next/link";
import { listPosts } from "@mstgolf/core";
import { allowPage } from "../../../lib/auth";
import { currentOrg } from "../../../lib/org";
import { webAsset, webOrigin } from "../../../lib/web-origin";
import { Forbidden } from "../../Forbidden";
import { formatDate } from "../../ui/format";
import { WebsiteTabs } from "../WebsiteTabs";

export const dynamic = "force-dynamic";

type State = { label: string; tone: string; order: number };

// Promotions are what the website leads with: the hero carousel, the deals
// grid and the promotion bar all read from this list.
export default async function PromotionsAdminPage() {
  const user = await allowPage("posts.manage");
  if (!user) return <Forbidden />;
  const org = await currentOrg();
  const site = webOrigin(org.settings.site.siteUrl);
  const now = new Date();
  const rows = (await listPosts(org.id, { category: "PROMOTION", limit: 200 })).map((p) => {
    const state: State =
      p.status !== "PUBLISHED"
        ? { label: "ฉบับร่าง", tone: "gray", order: 2 }
        : p.endsAt && p.endsAt <= now
          ? { label: "หมดแล้ว", tone: "gray", order: 3 }
          : p.startsAt && p.startsAt > now
            ? { label: "รอเริ่ม", tone: "blue", order: 1 }
            : { label: "กำลังแสดง", tone: "green", order: 0 };
    return { ...p, state };
  });
  rows.sort((a, b) => a.state.order - b.state.order);
  const live = rows.filter((r) => r.state.order === 0);
  const inHero = live.filter((r) => r.coverUrl).length;

  return (
    <>
      <div className="page-head page-head-actions">
        <div>
          <h1>เว็บไซต์</h1>
          <p>
            โปรโมชันที่กำลังแสดง {live.length} รายการ · ขึ้นแบนเนอร์หน้าแรก {Math.min(inHero, 5)} รายการ (เฉพาะที่มีรูปปก สูงสุด 5) · แก้แล้วขึ้นเว็บภายใน 5 นาที
            {site && (
              <>
                {" "}· <a href={`${site}/promotions`} target="_blank" rel="noreferrer">เปิดหน้าโปรโมชัน ↗</a>
              </>
            )}
          </p>
        </div>
        <div className="head-actions">
          <Link className="btn" href="/website/new?type=promotion">+ เพิ่มโปรโมชัน</Link>
        </div>
      </div>
      <WebsiteTabs on="promotions" />
      {rows.length === 0 ? (
        <div className="empty">ยังไม่มีโปรโมชัน — เพิ่มอันแรก ใส่รูปปกแนวนอน วันเริ่ม–วันหมด และลิงก์ปุ่ม แล้วจะขึ้นแบนเนอร์หน้าแรกเอง</div>
      ) : (
        <div className="card table-card table-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>โปรโมชัน</th>
                <th>ช่วงเวลา</th>
                <th>ปุ่ม</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/website/${p.id}`} className="member-cell">
                      {p.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={webAsset(p.coverUrl, site)} alt="" width={80} height={45} style={{ objectFit: "cover", borderRadius: 6 }} />
                      ) : (
                        <span className="avatar avatar-initial" style={{ width: 80, height: 45, borderRadius: 6 }} title="ไม่มีรูปปก — ไม่ขึ้นแบนเนอร์">—</span>
                      )}
                      <span>
                        <span className="member-name">{p.title}</span>
                        {p.excerpt && <span className="sub">{p.excerpt}</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="dim nowrap">
                    {p.startsAt ? formatDate(p.startsAt) : "ทันที"} – {p.endsAt ? formatDate(new Date(p.endsAt.getTime() - 1)) : "ไม่มีกำหนด"}
                  </td>
                  <td className="dim small">{p.linkUrl ? `${p.linkLabel || "ดูรายละเอียด"} → ${p.linkUrl}` : "หน้ารายละเอียด"}</td>
                  <td>
                    <span className={`pill ${p.state.tone}`}>{p.state.label}</span>
                    {p.state.order === 0 && !p.coverUrl && <div className="sub">ไม่มีรูปปก</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
