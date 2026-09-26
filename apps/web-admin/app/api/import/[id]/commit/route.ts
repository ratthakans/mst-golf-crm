import { NextResponse } from "next/server";
import { commitImport } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../../../lib/auth";
import { fail } from "../../../../../lib/api";
import { currentOrg } from "../../../../../lib/org";
import { flushOutbox } from "../../../../../lib/outbox";

export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireApi("import.run");
  if (user instanceof NextResponse) return user;
  try {
    const org = await currentOrg();
    const counts = await commitImport(org.id, actorOf(user), params.id);
    flushOutbox();
    return NextResponse.json({ counts });
  } catch (e) {
    return fail(e);
  }
}
