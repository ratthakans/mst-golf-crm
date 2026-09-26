"use client";

import Link from "next/link";
import { formatHm, formatPoints, formatThaiDate } from "@/lib/format";
import { useBrief } from "./useBrief";

// "แต้มของฉัน" beside the hero (flow page 04): the same numbers as the LINE
// member card once signed in; the welcome offer before that.
export function MyStatus({ welcomePoints }: { welcomePoints: number }) {
  const brief = useBrief();

  if (brief === undefined) {
    return (
      <div className="mine" aria-busy="true">
        <span className="skeleton" style={{ height: 14, width: "60%" }} />
        <span className="skeleton" style={{ height: 34, width: "45%", marginTop: 10 }} />
      </div>
    );
  }

  if (brief && brief.signedIn && brief.member) {
    const m = brief.member;
    return (
      <Link href="/app/member" className="mine mine-link">
        <span className="mine-label">แต้มของฉัน · {brief.name}</span>
        <span className="mine-big num">{formatPoints(m.points)}</span>
        <span className="mine-row">
          <span>ระดับ</span>
          <b>{m.tierName}</b>
        </span>
        <span className="mine-row">
          <span>การจองถัดไป</span>
          <b className="num">
            {m.nextBooking ? `${formatThaiDate(new Date(m.nextBooking.startAt), { year: false })} ${formatHm(new Date(m.nextBooking.startAt))} · ${m.nextBooking.laneName}` : "—"}
          </b>
        </span>
      </Link>
    );
  }

  return (
    <Link href="/app/member" className="mine mine-link">
      <span className="mine-label">สมาชิกใหม่รับทันที</span>
      <span className="mine-big num">
        {formatPoints(welcomePoints)} <small>แต้ม</small>
      </span>
      <span className="mine-cta">สมัครผ่าน LINE ใช้เวลาไม่ถึงนาที</span>
    </Link>
  );
}
