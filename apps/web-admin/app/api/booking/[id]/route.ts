import { NextResponse } from "next/server";
import { cancelByStaff, checkIn, markNoShow, moveBooking, recordPayment, toSatang } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../../lib/auth";
import { fail, readJson, str } from "../../../../lib/api";
import { currentOrg } from "../../../../lib/org";
import { flushOutbox } from "../../../../lib/outbox";

// One endpoint per booking; `action` picks what the counter did.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireApi("booking.manage");
  if (user instanceof NextResponse) return user;
  try {
    const b = await readJson(req);
    const org = await currentOrg();
    const actor = actorOf(user);
    const paid = b.paid === undefined || b.paid === "" || b.paid === null ? null : toSatang(String(b.paid));
    switch (b.action) {
      case "move": {
        const booking = await moveBooking(org.id, actor, params.id, { laneId: str(b.laneId), startAt: str(b.startAt) });
        flushOutbox();
        return NextResponse.json({ booking });
      }
      case "checkin":
        return NextResponse.json({ booking: await checkIn(org.id, actor, params.id, paid) });
      case "noshow":
        return NextResponse.json({ booking: await markNoShow(org.id, actor, params.id) });
      case "cancel": {
        const booking = await cancelByStaff(org.id, actor, params.id, str(b.reason));
        flushOutbox();
        return NextResponse.json({ booking });
      }
      case "payment":
        if (paid === null) return NextResponse.json({ error: "ใส่ยอดชำระ" }, { status: 400 });
        await recordPayment(org.id, actor, params.id, paid);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "ไม่รู้จักคำสั่ง" }, { status: 400 });
    }
  } catch (e) {
    return fail(e);
  }
}
