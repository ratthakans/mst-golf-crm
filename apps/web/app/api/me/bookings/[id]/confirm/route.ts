import type { NextRequest } from "next/server";
import { confirmHold } from "@mstgolf/core";
import { handle, json, kickOutbox, requireMember } from "@/lib/api";
import { toBookingRow } from "@/lib/views";

// POST — confirm the member's own hold before it expires (else 409 HOLD_EXPIRED).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(req, async () => {
    const { orgId, member } = await requireMember();
    const booking = await confirmHold(orgId, member.id, params.id);
    kickOutbox();
    return json({ booking: toBookingRow(booking) });
  });
}
