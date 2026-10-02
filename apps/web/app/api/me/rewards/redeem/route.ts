import type { NextRequest } from "next/server";
import { redeemReward } from "@mstgolf/core";
import { handle, json, kickOutbox, readJson, requireMember, str } from "@/lib/api";
import { loadRewards } from "@/lib/views";

export const dynamic = "force-dynamic";

// POST { rewardId, acceptTerms, delivery? } — spend points. The member comes from the session, never the body.
export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const { orgId, member } = await requireMember();
    const b = await readJson<{ rewardId: string; acceptTerms: boolean; delivery: unknown }>(req);
    const result = await redeemReward(orgId, member.id, { rewardId: str(b.rewardId, 40), acceptTerms: b.acceptTerms === true, delivery: b.delivery });
    kickOutbox();
    return json({ result, ...(await loadRewards(orgId, member.id)) });
  });
}
