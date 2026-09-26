import { NextResponse } from "next/server";
import { eraseMember } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../../../lib/auth";
import { fail, readJson, str } from "../../../../../lib/api";
import { currentOrg } from "../../../../../lib/org";
import { deleteMemberPhoto } from "../../../../../lib/photo-store";

// PDPA erasure (Super Admin). The photo file is deleted too.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requireApi("members.erase");
  if (user instanceof NextResponse) return user;
  try {
    const b = await readJson(req);
    if (b.confirm !== "ลบข้อมูล") return NextResponse.json({ error: "พิมพ์คำว่า ลบข้อมูล เพื่อยืนยัน" }, { status: 400 });
    const org = await currentOrg();
    const { pictureUrl } = await eraseMember(org.id, actorOf(user), params.id, str(b.reason));
    await deleteMemberPhoto(pictureUrl).catch((e) => console.error("[erase] photo delete failed", e));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
