import { NextResponse } from "next/server";
import { saveReward, type RewardInput } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../lib/auth";
import { fail, readJson } from "../../../lib/api";
import { currentOrg } from "../../../lib/org";

export async function POST(req: Request) {
  const user = await requireApi("rewards.manage");
  if (user instanceof NextResponse) return user;
  try {
    const org = await currentOrg();
    const r = await saveReward(org.id, actorOf(user), null, await readJson<RewardInput>(req));
    return NextResponse.json({ id: r.id });
  } catch (e) {
    return fail(e);
  }
}
