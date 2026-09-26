import type { NextRequest } from "next/server";
import { handle, json, requireMember } from "@/lib/api";
import { loadPoints } from "@/lib/views";

export const dynamic = "force-dynamic";

// GET — the member's point ledger, newest first (last 50 entries).
export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const { orgId, member } = await requireMember();
    return json({ balance: member.points, items: await loadPoints(orgId, member.id) });
  });
}
