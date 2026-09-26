import type { NextRequest } from "next/server";
import { findMemberByLine, memberBookings } from "@mstgolf/core";
import { handle, json } from "@/lib/api";
import { getOrg } from "@/lib/org";
import { currentLineUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET — the few facts the public header shows (name, points, next booking).
// Read on the server from the session cookie so the content pages themselves
// stay statically cached. Always 200: { signedIn: false } when logged out.
export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const user = await currentLineUser();
    if (!user) return json({ signedIn: false });
    const org = await getOrg();
    const member = await findMemberByLine(org.id, user.sub);
    if (!member) return json({ signedIn: true, member: null, name: user.name });
    const { upcoming } = await memberBookings(org.id, member.id);
    const next = upcoming.find((b) => b.status === "CONFIRMED" || b.status === "CHECKED_IN") ?? null;
    return json({
      signedIn: true,
      name: member.firstName ?? member.displayName,
      member: {
        points: member.points,
        tierKey: member.tier,
        tierName: org.settings.tiers.find((t) => t.key === member.tier)?.name ?? org.settings.tiers[0]?.name ?? "Member",
        nextBooking: next ? { startAt: next.startAt.toISOString(), laneName: next.laneName } : null,
      },
    });
  });
}
