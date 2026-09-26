import { NextResponse } from "next/server";
import { db, writeAudit } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../../lib/auth";
import { fail, readJson, str } from "../../../../lib/api";
import { currentOrg } from "../../../../lib/org";

// Close a review item after acting on it (the merge / erase itself runs from the member page).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireApi("reviews.resolve");
  if (user instanceof NextResponse) return user;
  try {
    const b = await readJson(req);
    const status = b.status === "DONE" ? "DONE" : b.status === "DISMISSED" ? "DISMISSED" : null;
    if (!status) return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
    const org = await currentOrg();
    const client = db(org.id);
    const item = await client.reviewItem.findFirst({ where: { id: params.id } });
    if (!item) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
    await client.reviewItem.updateMany({
      where: { id: item.id },
      data: { status, resolvedBy: user.id, resolvedAt: new Date(), note: [item.note, str(b.note).trim()].filter(Boolean).join(" · ") || null },
    });
    await writeAudit(client, org.id, actorOf(user), { action: "review.resolve", entity: "review", entityId: item.id, after: { status } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
