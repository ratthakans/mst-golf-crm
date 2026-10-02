import { NextResponse } from "next/server";
import { syncShopify } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../../lib/auth";
import { fail } from "../../../../lib/api";
import { currentOrg } from "../../../../lib/org";

export const maxDuration = 60;

// "Sync now" on Settings › ร้านออนไลน์ — the same run the nightly job makes.
export async function POST() {
  const user = await requireApi("settings.manage");
  if (user instanceof NextResponse) return user;
  try {
    const org = await currentOrg();
    return NextResponse.json(await syncShopify(org.id, actorOf(user)));
  } catch (e) {
    return fail(e);
  }
}
