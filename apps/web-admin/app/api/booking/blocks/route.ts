import { NextResponse } from "next/server";
import { blockLane } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../../lib/auth";
import { fail, optStr, readJson, str } from "../../../../lib/api";
import { currentOrg } from "../../../../lib/org";

export async function POST(req: Request) {
  const user = await requireApi("booking.block");
  if (user instanceof NextResponse) return user;
  try {
    const b = await readJson(req);
    const reason = b.reason === "PRIVATE" || b.reason === "EVENT" ? b.reason : "MAINTENANCE";
    const org = await currentOrg();
    const r = await blockLane(org.id, actorOf(user), { laneId: str(b.laneId), startAt: str(b.startAt), endAt: str(b.endAt), reason, note: optStr(b.note) });
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
