import { NextResponse } from "next/server";
import { confirmReadiness } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../lib/auth";
import { fail, readJson, str } from "../../../lib/api";
import { currentOrg } from "../../../lib/org";

// MST confirms (or takes back) a go-live checklist item — Settings › ความพร้อมเปิดใช้.
export async function POST(req: Request) {
  const user = await requireApi("settings.manage");
  if (user instanceof NextResponse) return user;
  try {
    const b = await readJson(req);
    const org = await currentOrg();
    await confirmReadiness(org.id, actorOf(user), str(b.key), b.confirmed === true);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
