import type { NextRequest } from "next/server";
import { markInboxRead } from "@mstgolf/core";
import { handle, json, requireMember } from "@/lib/api";

// POST — the member opened the inbox: everything in it is now read.
export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const { orgId, member } = await requireMember();
    await markInboxRead(orgId, member.id);
    return json({ ok: true });
  });
}
