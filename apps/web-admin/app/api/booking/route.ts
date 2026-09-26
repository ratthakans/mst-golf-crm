import { NextResponse } from "next/server";
import { calendar, localDateKey, staffCreateBooking } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../lib/auth";
import { fail, optStr, readJson, str } from "../../../lib/api";
import { currentOrg } from "../../../lib/org";
import { flushOutbox } from "../../../lib/outbox";

// GET: the simulator calendar (polled every 15 s by the page).
export async function GET(req: Request) {
  const user = await requireApi("booking.view");
  if (user instanceof NextResponse) return user;
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || localDateKey(new Date());
    const days = Number(url.searchParams.get("days") || 1);
    const org = await currentOrg();
    return NextResponse.json({ days: await calendar(org.id, date, days) });
  } catch (e) {
    return fail(e);
  }
}

// POST: staff take a walk-in or a phone booking.
export async function POST(req: Request) {
  const user = await requireApi("booking.manage");
  if (user instanceof NextResponse) return user;
  try {
    const b = await readJson(req);
    const org = await currentOrg();
    const booking = await staffCreateBooking(org.id, actorOf(user), {
      laneId: str(b.laneId),
      startAt: str(b.startAt),
      partySize: Number(b.partySize ?? 1),
      source: b.source === "PHONE" ? "PHONE" : "WALKIN",
      memberId: optStr(b.memberId) || null,
      guestName: optStr(b.guestName) || null,
      guestPhone: optStr(b.guestPhone) || null,
      note: optStr(b.note) || null,
      checkInNow: b.checkInNow === true,
    });
    flushOutbox();
    return NextResponse.json({ booking }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
