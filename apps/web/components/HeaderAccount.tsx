"use client";

import Link from "next/link";
import { useBrief } from "./useBrief";

// Right side of the site header: "สมาชิก" (sign in or sign up with a mobile
// number), or the member's name and points once signed in (/api/me/brief).
export function HeaderAccount() {
  const brief = useBrief();

  if (brief === undefined) return <span className="acct-skeleton skeleton" aria-hidden="true" />;

  if (!brief || !brief.signedIn) {
    return (
      <Link href="/app/member" className="btn btn-primary btn-sm acct-login">
        เข้าสู่ระบบ<span className="acct-login-more">/ สมัคร</span>
      </Link>
    );
  }

  if (!brief.member) {
    return (
      <Link href="/app/member" className="btn btn-primary btn-sm">
        สมัครสมาชิก
      </Link>
    );
  }

  return (
    <Link href="/app/member" className="acct-chip" aria-label={`บัตรสมาชิกของ ${brief.name} แต้มคงเหลือ ${brief.member.points.toLocaleString("th-TH")} แต้ม`}>
      <span className="acct-name">{brief.name}</span>
      <span className="acct-points num">{brief.member.points.toLocaleString("th-TH")} แต้ม</span>
    </Link>
  );
}
