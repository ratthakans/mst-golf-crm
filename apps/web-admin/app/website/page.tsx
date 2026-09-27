import Link from "next/link";
import { listPosts } from "@mstgolf/core";
import { allowPage } from "../../lib/auth";
import { currentOrg } from "../../lib/org";
import { webOrigin } from "../../lib/web-origin";
import { Forbidden } from "../Forbidden";
import { CATEGORY_LABEL, formatDateTime } from "../ui/format";
import { WebsiteTabs } from "./WebsiteTabs";

export const dynamic = "force-dynamic";


export default async function WebsitePage() {
  const user = await allowPage("posts.manage");
  if (!user) return <Forbidden />;
  const org = await currentOrg();
  const posts = await listPosts(org.id, { limit: 200 });
  const site = webOrigin(org.settings.site.siteUrl);
  return (
    <>
      <div className="page-head page-head-actions">
        <div>
          <h1>เว็บไซต์</h1>
          <p>
            เขียนและเผยแพร่บทความ บริการ และข่าวสารบนเว็บไซต์ MST Golf · เผยแพร่แล้วขึ้นเว็บภายใน 5 นาที
            {site && (
              <>
                {" "}· <a href={`${site}/blog`} target="_blank" rel="noreferrer">เปิดหน้าบทความ ↗</a>
              </>
            )}
          </p>
        </div>
        <div className="head-actions">
          <Link className="btn" href="/website/new">+ เขียนบทความ</Link>
        </div>
      </div>
      <WebsiteTabs on="posts" />
      {posts.length === 0 ? (
        <div className="empty">ยังไม่มีบทความ — เริ่มจากบทความแรก เช่น “วิธีเลือกไดรเวอร์ให้เหมาะกับวงสวิง”</div>
      ) : (
        <div className="card table-card table-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>หมวด</th>
                <th>สถานะ</th>
                <th>แก้ไขล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/website/${p.id}`} className="member-name">{p.title}</Link>
                    <span className="sub mono">/blog/{p.slug}</span>
                  </td>
                  <td>{CATEGORY_LABEL[p.category]}</td>
                  <td>{p.status === "PUBLISHED" ? <span className="pill green">เผยแพร่แล้ว</span> : <span className="pill gray">ฉบับร่าง</span>}</td>
                  <td className="dim nowrap">{formatDateTime(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
