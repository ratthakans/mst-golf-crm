import Link from "next/link";
import { lineConfig, liffUrl, searchMembers } from "@mstgolf/core";
import { allowPage } from "../../lib/auth";
import { currentOrg } from "../../lib/org";
import { Forbidden } from "../Forbidden";
import { formatBaht, formatDate, formatPhone, num, SOURCE_LABEL } from "../ui/format";
import { TierPill, tierInfo } from "../ui/TierPill";
import { MemberAvatar, photoVersion } from "./MemberAvatar";
import { SignupLinkButton } from "./SignupLinkButton";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function MembersPage({
  searchParams,
}: {
  searchParams: { q?: string; tier?: string; line?: string; source?: string; page?: string };
}) {
  const user = await allowPage("members.view");
  if (!user) return <Forbidden />;
  const org = await currentOrg();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const source = ["LINE", "WEB", "COUNTER", "POS", "IMPORT"].includes(searchParams.source ?? "") ? (searchParams.source as "LINE") : undefined;
  const { total, rows } = await searchMembers(org.id, {
    q: searchParams.q,
    tier: searchParams.tier || undefined,
    hasLine: searchParams.line === "yes" ? true : searchParams.line === "no" ? false : undefined,
    source,
    page,
    pageSize: PAGE_SIZE,
  });
  const line = await lineConfig(org.id);
  const signupUrl = liffUrl(line?.liffId ?? null, "/member", org.settings.site.siteUrl);
  const showMoney = user.permissions.includes("dashboard.revenue");
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (v && k !== "page") u.set(k, v);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return s ? `?${s}` : "";
  };

  return (
    <>
      <div className="page-head page-head-actions">
        <div>
          <h1>สมาชิก</h1>
          <p>{num(total)} คน{searchParams.q ? ` ที่ตรงกับ “${searchParams.q}”` : ""} · ค้นหาด้วยชื่อ เบอร์โทร หรือรหัสสมาชิก</p>
        </div>
        {user.permissions.includes("members.create") && (
          <div className="head-actions">
            <SignupLinkButton orgName={org.name} signupBonus={org.settings.welcomeBonus} signupUrl={signupUrl} />
            <Link href="/members/new" className="btn">+ เพิ่มสมาชิก</Link>
          </div>
        )}
      </div>

      <form className="toolbar" method="get">
        <input type="search" name="q" defaultValue={searchParams.q ?? ""} placeholder="ชื่อ / 0891112233 / MST00000001" aria-label="ค้นหาสมาชิก" />
        <select name="tier" defaultValue={searchParams.tier ?? ""} aria-label="ระดับ">
          <option value="">ทุกระดับ</option>
          {org.settings.tiers.map((t) => (
            <option key={t.key} value={t.key}>{t.name}</option>
          ))}
        </select>
        <select name="line" defaultValue={searchParams.line ?? ""} aria-label="LINE">
          <option value="">LINE ทั้งหมด</option>
          <option value="yes">ผูก LINE แล้ว</option>
          <option value="no">ยังไม่ผูก LINE</option>
        </select>
        <select name="source" defaultValue={searchParams.source ?? ""} aria-label="ช่องทางสมัคร">
          <option value="">ทุกช่องทาง</option>
          {["LINE", "WEB", "COUNTER", "POS", "IMPORT"].map((s) => (
            <option key={s} value={s}>{SOURCE_LABEL[s]}</option>
          ))}
        </select>
        <button className="btn btn-ghost" type="submit">ค้นหา</button>
        {(searchParams.q || searchParams.tier || searchParams.line || searchParams.source) && (
          <Link href="/members" className="link-btn">ล้างตัวกรอง</Link>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="empty">ไม่พบสมาชิก</div>
      ) : (
        <div className="card table-card table-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>สมาชิก</th>
                <th>เบอร์โทร</th>
                <th>ระดับ</th>
                <th className="num">แต้ม</th>
                {showMoney && <th className="num">ยอด 12 เดือน</th>}
                <th>ซื้อล่าสุด</th>
                <th>สมัครทาง</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const t = tierInfo(m.tier, org.settings.tiers);
                return (
                  <tr key={m.id}>
                    <td>
                      <Link href={`/members/${m.id}`} className="member-cell">
                        <MemberAvatar id={m.id} name={m.displayName} version={photoVersion(m.pictureUrl)} size={32} />
                        <span>
                          <span className="member-name">{m.displayName}</span>
                          <span className="sub mono">{m.code}{m.hasLine ? " · LINE" : ""}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="mono nowrap">{formatPhone(m.phone)}</td>
                    <td><TierPill {...t} /></td>
                    <td className="num">{num(m.points)}</td>
                    {showMoney && <td className="num">{formatBaht(m.spend12mSatang)}</td>}
                    <td className="dim nowrap">{formatDate(m.lastPurchaseAt)}</td>
                    <td className="dim">{SOURCE_LABEL[m.source] ?? m.source}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="pager">
          {page > 1 && <Link className="btn btn-ghost btn-sm" href={`/members${qs(page - 1)}`}>← ก่อนหน้า</Link>}
          <span>หน้า {page} / {pages}</span>
          {page < pages && <Link className="btn btn-ghost btn-sm" href={`/members${qs(page + 1)}`}>ถัดไป →</Link>}
        </div>
      )}
    </>
  );
}
