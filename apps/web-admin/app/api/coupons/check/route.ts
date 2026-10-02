import { NextResponse } from "next/server";
import { checkCoupon } from "@mstgolf/core";
import { requireApi } from "../../../../lib/auth";
import { fail, readJson, str } from "../../../../lib/api";
import { currentOrg } from "../../../../lib/org";

// Look a coupon up without using it — the cashier sees value, conditions and status first.
export async function POST(req: Request) {
  const user = await requireApi("coupons.use");
  if (user instanceof NextResponse) return user;
  try {
    const b = await readJson(req);
    const org = await currentOrg();
    return NextResponse.json(await checkCoupon(org.id, str(b.code)));
  } catch (e) {
    return fail(e);
  }
}
