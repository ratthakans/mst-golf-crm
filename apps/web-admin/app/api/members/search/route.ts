import { NextResponse } from "next/server";
import { searchMembers } from "@mstgolf/core";
import { requireApi } from "../../../../lib/auth";
import { fail } from "../../../../lib/api";
import { currentOrg } from "../../../../lib/org";

// Quick lookup for pickers (simulator booking, merge).
export async function GET(req: Request) {
  const user = await requireApi("members.view");
  if (user instanceof NextResponse) return user;
  try {
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return NextResponse.json({ rows: [] });
    const org = await currentOrg();
    const { rows } = await searchMembers(org.id, { q, pageSize: 8 });
    return NextResponse.json({
      rows: rows.map((m) => ({ id: m.id, code: m.code, name: m.displayName, phone: m.phone, tier: m.tier, points: m.points, hasLine: m.hasLine })),
    });
  } catch (e) {
    return fail(e);
  }
}
