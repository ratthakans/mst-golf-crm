import { NextResponse } from "next/server";
import { adjustPoints } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../../../lib/auth";
import { fail, readJson, str } from "../../../../../lib/api";
import { currentOrg } from "../../../../../lib/org";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireApi("points.adjust");
  if (user instanceof NextResponse) return user;
  try {
    const b = await readJson(req);
    const org = await currentOrg();
    const r = await adjustPoints(org.id, actorOf(user), { memberId: params.id, delta: Number(b.delta), note: str(b.note) });
    return NextResponse.json(r);
  } catch (e) {
    return fail(e);
  }
}
