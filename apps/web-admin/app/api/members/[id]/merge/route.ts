import { NextResponse } from "next/server";
import { mergeMembers } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../../../lib/auth";
import { fail, readJson, str } from "../../../../../lib/api";
import { currentOrg } from "../../../../../lib/org";

// Merges `otherId` into this member (this one survives) or the reverse.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireApi("members.merge");
  if (user instanceof NextResponse) return user;
  try {
    const b = await readJson(req);
    const other = str(b.otherId);
    const keepOther = b.keep === "other";
    const org = await currentOrg();
    const member = await mergeMembers(org.id, actorOf(user), {
      survivorId: keepOther ? other : params.id,
      mergedId: keepOther ? params.id : other,
      reason: str(b.reason),
    });
    return NextResponse.json({ member });
  } catch (e) {
    return fail(e);
  }
}
