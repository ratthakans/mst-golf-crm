import { NextResponse } from "next/server";
import { useCoupon } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../../lib/auth";
import { fail, optStr, readJson, str } from "../../../../lib/api";
import { currentOrg } from "../../../../lib/org";

export async function POST(req: Request) {
  const user = await requireApi("coupons.use");
  if (user instanceof NextResponse) return user;
  try {
    const b = await readJson(req);
    const org = await currentOrg();
    const res = await useCoupon(org.id, actorOf(user), { couponCode: str(b.code), storeId: optStr(b.storeId) ?? null, invoiceNo: optStr(b.invoiceNo) ?? null });
    return NextResponse.json(res);
  } catch (e) {
    return fail(e);
  }
}
