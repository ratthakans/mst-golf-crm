import type { NextRequest } from "next/server";
import { releaseHold } from "@mstgolf/core";
import { handle, json, requireMember } from "@/lib/api";

// POST — the member backed out of the confirmation screen: free the held slot now.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(req, async () => {
    const { orgId, member } = await requireMember();
    await releaseHold(orgId, member.id, params.id);
    return json({ ok: true });
  });
}
