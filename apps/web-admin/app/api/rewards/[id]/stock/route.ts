import { NextResponse } from "next/server";
import { adjustRewardStock } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../../../lib/auth";
import { fail, readJson, str } from "../../../../../lib/api";
import { currentOrg } from "../../../../../lib/org";

// Receive stock (+) or write it off (−) without racing members who are redeeming.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireApi("rewards.manage");
  if (user instanceof NextResponse) return user;
  try {
    const b = await readJson(req);
    const org = await currentOrg();
    const r = await adjustRewardStock(org.id, actorOf(user), params.id, Number(b.delta), str(b.note));
    return NextResponse.json({ stock: r.stock });
  } catch (e) {
    return fail(e);
  }
}
