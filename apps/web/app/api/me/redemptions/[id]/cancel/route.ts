import type { NextRequest } from "next/server";
import { cancelMyRedemption } from "@mstgolf/core";
import { handle, json, requireMember } from "@/lib/api";
import { loadRewards } from "@/lib/views";

export const dynamic = "force-dynamic";

// POST — withdraw a reward request before the team has picked it up; the points come back.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handle(req, async () => {
    const { orgId, member } = await requireMember();
    await cancelMyRedemption(orgId, member.id, params.id);
    return json(await loadRewards(orgId, member.id));
  });
}
