import { NextResponse } from "next/server";
import { db, writeAudit } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../lib/auth";
import { fail, readJson, str } from "../../../lib/api";
import { currentOrg } from "../../../lib/org";

// Customer Service asks a Super Admin to merge two members or erase one.
export async function POST(req: Request) {
  const user = await requireApi("reviews.request");
  if (user instanceof NextResponse) return user;
  try {
    const b = await readJson(req);
    const kind = b.kind === "ERASE_REQUEST" ? "ERASE_REQUEST" : b.kind === "MERGE_REQUEST" ? "MERGE_REQUEST" : null;
    const memberId = str(b.memberId);
    const note = str(b.note).trim();
    if (!kind || !memberId || !note) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    const org = await currentOrg();
    const client = db(org.id);
    const member = await client.member.findFirst({ where: { id: memberId, status: "ACTIVE" } });
    if (!member) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });
    const item = await client.reviewItem.create({
      data: { orgId: org.id, kind, memberId, note, payload: { otherCode: str(b.otherCode) || null, requestedBy: user.name } },
    });
    await writeAudit(client, org.id, actorOf(user), { action: `review.${kind.toLowerCase()}`, entity: "member", entityId: memberId, reason: note });
    return NextResponse.json({ id: item.id }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
