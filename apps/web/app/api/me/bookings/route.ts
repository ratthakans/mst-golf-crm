import type { NextRequest } from "next/server";
import { handle, json, requireMember } from "@/lib/api";
import { loadBookings } from "@/lib/views";

export const dynamic = "force-dynamic";

// GET — การจองของฉัน: upcoming (confirmed / checked in) and the last 10 past ones.
export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const { orgId, member } = await requireMember();
    return json(await loadBookings(orgId, member.id));
  });
}
