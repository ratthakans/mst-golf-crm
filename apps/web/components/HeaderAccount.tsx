"use client";

import Link from "next/link";
import { IconUser } from "./icons";
import { useBrief } from "./useBrief";

// Right side of the site header: "สมาชิก" (sign in or sign up with a mobile
// number), or the member's name and points once signed in (/api/me/brief).
export function HeaderAccount() {
  const brief = useBrief();

  if (brief === undefined) return <span className="acct-skeleton skeleton" aria-hidden="true" />;

  if (!brief || !brief.signedIn) {
    return (
      <Link href="/app/member" className="btn btn-outline btn-sm acct-login" aria-label="เข้าสู่ระบบ หรือ สมัครสมาชิก">
        <IconUser size={18} />
        <span className="acct-login-text" aria-hidden="true">
          เข้าสู่ระบบ / สมัคร
        </span>
      </Link>
    );
  }

  if (!brief.member) {
    return (
      <Link href="/app/member" className="btn btn-outline btn-sm acct-login" aria-label="สมัครสมาชิก">
        <IconUser size={18} />
        <span className="acct-login-text" aria-hidden="true">
          สมัครสมาชิก
        </span>
      </Link>
    );
  }

  return (
    <Link href="/app/member" className="acct-chip" aria-label={`บัตรสมาชิกของ ${brief.name} แต้มคงเหลือ ${brief.member.points.toLocaleString("th-TH")} แต้ม`}>
      <IconUser size={18} className="acct-icon" />
      <span className="acct-text">
        <span className="acct-name">{brief.name}</span>
        <span className="acct-points num">{brief.member.points.toLocaleString("th-TH")} แต้ม</span>
      </span>
    </Link>
  );
}
