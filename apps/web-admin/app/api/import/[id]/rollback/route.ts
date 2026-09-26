import { NextResponse } from "next/server";
import { rollbackImport } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../../../lib/auth";
import { fail, readJson, str } from "../../../../../lib/api";
import { currentOrg } from "../../../../../lib/org";

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireApi("import.run");
  if (user instanceof NextResponse) return user;
  try {
    const b = await readJson(req);
    const org = await currentOrg();
    return NextResponse.json(await rollbackImport(org.id, actorOf(user), params.id, str(b.reason)));
  } catch (e) {
    return fail(e);
  }
}
