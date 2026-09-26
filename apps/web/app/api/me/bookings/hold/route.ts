import type { NextRequest } from "next/server";
import { holdSlot } from "@mstgolf/core";
import { handle, isLineClient, json, readJson, requireMember, str } from "@/lib/api";
import { toBookingRow } from "@/lib/views";

// POST { laneId, startAt, partySize, inLine? } — holds one slot for the
// configured hold time (5 min). The price after the tier discount comes back
// in the booking; the unique index turns a race into SLOT_TAKEN (409).
export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const { orgId, member } = await requireMember();
    const body = await readJson<{ laneId: string; startAt: string; partySize: number; inLine: boolean }>(req);
    const booking = await holdSlot(orgId, {
      memberId: member.id,
      laneId: str(body.laneId, 64),
      startAt: str(body.startAt, 40),
      partySize: typeof body.partySize === "number" ? body.partySize : Number(body.partySize) || 0,
      source: body.inLine === true || isLineClient(req) ? "LINE" : "WEB",
    });
    return json({ booking: toBookingRow(booking) }, 201);
  });
}
