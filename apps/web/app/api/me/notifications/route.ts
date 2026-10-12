import type { NextRequest } from "next/server";
import { memberInbox } from "@mstgolf/core";
import { handle, json, requireMember } from "@/lib/api";
import { toInboxRow } from "@/lib/views";

export const dynamic = "force-dynamic";

// GET — the member's notifications, newest first.
export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const { orgId, member } = await requireMember();
    return json({ items: (await memberInbox(orgId, member.id)).map(toInboxRow) });
  });
}
