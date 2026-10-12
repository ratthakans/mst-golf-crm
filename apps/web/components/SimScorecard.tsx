import Link from "next/link";
import { type Availability, localDateKey } from "@mstgolf/core";

// Today's (or tomorrow's) lanes from the same availability the booking page
// uses, so the page can't show a slot as free that isn't. Every free slot is a
// link that opens the booking page on that exact lane and hour.
// Wide screens: a lane × hour grid of solid blocks. Phones: one line per hour
// listing the free lanes, instead of a 12-column table that scrolls sideways.

const LABEL: Record<string, string> = { free: "ว่าง", taken: "จองแล้ว", blocked: "ปิด", past: "ผ่านไปแล้ว", closed: "ปิด" };

const bookHref = (startAt: string, laneId: string) =>
  `/app/booking?date=${localDateKey(new Date(startAt))}&at=${encodeURIComponent(startAt)}&lane=${encodeURIComponent(laneId)}`;

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
  const laneName = (id: string) => avail.lanes.find((l) => l.id === id)?.name ?? "";

  return (
    <div className="scorecard-wrap">
      <p className="scorecard-cap">
        {dateLabel} · ว่าง <span className="mono">{free}</span> ช่อง
      </p>

      <table className="scorecard" aria-label={`ช่องว่าง Golf Simulator ${dateLabel}`}>
        <thead>
          <tr>
            <th scope="col" className="sc-lane">
              Lane
            </th>
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
                const label = `${lane.name} ${s.label} น. ${LABEL[state] ?? "ปิด"}`;
                return (
                  <td key={s.startAt} className={`sc-${state}`}>
                    {state === "free" ? (
                      <Link href={bookHref(s.startAt, lane.id)} className="sc-cell" aria-label={`${label} — จองช่องนี้`} title={`${lane.name} ${s.label} น. — จองช่องนี้`} />
                    ) : (
                      <span className="sc-cell" title={label}>
                        <span className="visually-hidden">{label}</span>
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="sc-list" aria-label={`ช่องว่าง Golf Simulator ${dateLabel}`}>
        {slots.map((s) => {
          const open = s.lanes.filter((l) => l.state === "free");
          return (
            <li key={s.startAt} className={open.length ? "" : "sc-full"}>
              <span className="sc-time mono">{s.label}</span>
              {open.length ? (
                <span className="sc-chips">
                  {open.map((l) => (
                    <Link key={l.laneId} href={bookHref(s.startAt, l.laneId)} className="sc-chip" aria-label={`จอง ${laneName(l.laneId)} เวลา ${s.label} น.`}>
                      {laneName(l.laneId)}
                    </Link>
                  ))}
                </span>
              ) : (
                <span className="sc-none">เต็ม</span>
              )}
            </li>
          );
        })}
      </ul>

      <p className="scorecard-key">
        <span>
          <i className="sc-key sc-key-free" aria-hidden="true" /> ว่าง กดเพื่อจอง
        </span>
        <span>
          <i className="sc-key sc-key-taken" aria-hidden="true" /> จองแล้ว
        </span>
        <span>
          <i className="sc-key sc-key-off" aria-hidden="true" /> ปิด
        </span>
        <Link href="/app/booking" className="scorecard-go">
          เลือกวันอื่น →
        </Link>
      </p>
    </div>
  );
}
