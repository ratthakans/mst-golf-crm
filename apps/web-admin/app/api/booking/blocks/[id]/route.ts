import { NextResponse } from "next/server";
import { unblockLane } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../../../lib/auth";
import { fail } from "../../../../../lib/api";
import { currentOrg } from "../../../../../lib/org";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireApi("booking.block");
  if (user instanceof NextResponse) return user;
  try {
    const org = await currentOrg();
    await unblockLane(org.id, actorOf(user), params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
