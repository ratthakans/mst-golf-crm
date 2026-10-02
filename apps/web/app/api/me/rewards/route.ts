import type { NextRequest } from "next/server";
import { handle, json, requireMember } from "@/lib/api";
import { loadRewards } from "@/lib/views";

export const dynamic = "force-dynamic";

// GET — the catalogue as this member sees it, plus their coupons and requests.
export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const { orgId, member } = await requireMember();
    return json(await loadRewards(orgId, member.id));
  });
}
