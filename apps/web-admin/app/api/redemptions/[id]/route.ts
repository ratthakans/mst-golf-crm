import { NextResponse } from "next/server";
import { updateRedemption, type RedemptionStatus } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../../lib/auth";
import { fail, optStr, readJson } from "../../../../lib/api";
import { currentOrg } from "../../../../lib/org";

// Move a reward request on (or record tracking / take ownership). Core checks the step is allowed.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireApi("redemptions.process");
  if (user instanceof NextResponse) return user;
  try {
    const b = await readJson(req);
    const org = await currentOrg();
    await updateRedemption(org.id, actorOf(user), params.id, {
      status: typeof b.status === "string" ? (b.status as RedemptionStatus) : undefined,
      note: optStr(b.note) ?? undefined,
      carrier: optStr(b.carrier) ?? undefined,
      trackingNo: optStr(b.trackingNo) ?? undefined,
      takeOwnership: b.takeOwnership === true,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
