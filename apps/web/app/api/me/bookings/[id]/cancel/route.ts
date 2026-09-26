import type { NextRequest } from "next/server";
import { cancelByMember } from "@mstgolf/core";
import { handle, json, kickOutbox, requireMember } from "@/lib/api";
import { toBookingRow } from "@/lib/views";

// POST — cancel a confirmed booking, allowed up to cancelHoursBefore (2 h) before start.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(req, async () => {
    const { orgId, member } = await requireMember();
    const booking = await cancelByMember(orgId, member.id, params.id);
    kickOutbox();
    return json({ booking: toBookingRow(booking) });
  });
}
