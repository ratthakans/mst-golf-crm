import type { NextRequest } from "next/server";
import { findMemberByLine } from "@mstgolf/core";
import { handle, json, requireLineUser } from "@/lib/api";
import { getOrg } from "@/lib/org";
import { loadCard } from "@/lib/views";

export const dynamic = "force-dynamic";

// GET — who is signed in, and their member card (null before sign-up).
export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const user = await requireLineUser();
    const org = await getOrg();
    const member = await findMemberByLine(org.id, user.sub);
    return json({
      user: { name: user.name, picture: user.picture },
      member: member ? await loadCard(org.id, member.id) : null,
    });
  });
}
