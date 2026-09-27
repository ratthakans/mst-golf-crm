import Link from "next/link";
import type { Availability } from "@mstgolf/core";

// Today's lanes laid out like a scorecard: one row per lane, one column per
// hour, a mark in each box. Server-rendered from the same availability the
// booking page uses, so the page can't show a slot as free that isn't.

const MARK: Record<string, { sym: string; label: string }> = {
  free: { sym: "○", label: "ว่าง" },
  taken: { sym: "●", label: "จองแล้ว" },
  blocked: { sym: "×", label: "ปิด" },
  past: { sym: "·", label: "ผ่านไปแล้ว" },
  closed: { sym: "·", label: "ปิด" },
};

export function SimScorecard({ avail, dateLabel }: { avail: Availability; dateLabel: string }) {
  if (!avail.open || avail.slots.length === 0) {
    return <p className="scorecard-closed">วันนี้ร้านปิด — เลือกวันอื่นได้ที่หน้าจอง</p>;
  }
  // Hours that have passed on every lane are dropped, so the card starts at "now".
  const slots = avail.slots.filter((s) => s.lanes.some((l) => l.state !== "past"));
  if (slots.length === 0) {
    return <p className="scorecard-closed">วันนี้เลยเวลาเปิดแล้ว — จองของพรุ่งนี้ได้ที่หน้าจอง</p>;
  }
  const free = slots.reduce((n, s) => n + s.lanes.filter((l) => l.state === "free").length, 0);
  return (
    <div className="scorecard-wrap">
      <table className="scorecard">
        <caption>
          {dateLabel} · ว่าง <span className="mono">{free}</span> ช่อง
        </caption>
        <thead>
          <tr>
            <th scope="col" className="sc-lane">Lane</th>
            {slots.map((s) => (
              <th key={s.startAt} scope="col" className="mono">
                {s.label.slice(0, 2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {avail.lanes.map((lane) => (
            <tr key={lane.id}>
              <th scope="row" className="sc-lane">
                {lane.name}
              </th>
              {slots.map((s) => {
                const state = s.lanes.find((l) => l.laneId === lane.id)?.state ?? "closed";
                const m = MARK[state] ?? MARK.closed!;
                return (
                  <td key={s.startAt} className={`sc-${state}`} title={`${lane.name} ${s.label} น. ${m.label}`}>
                    <span aria-hidden="true">{m.sym}</span>
                    <span className="visually-hidden">{m.label}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="scorecard-key">
        <span>○ ว่าง</span>
        <span>● จองแล้ว</span>
        <span>× ปิด</span>
        <Link href="/app/booking" className="scorecard-go">
          เลือกช่องและจอง →
        </Link>
      </p>
    </div>
  );
}
