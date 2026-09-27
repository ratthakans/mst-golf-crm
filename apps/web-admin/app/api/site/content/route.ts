import { NextResponse } from "next/server";
import { saveSiteContent, type SiteContentInput } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../../lib/auth";
import { fail, readJson } from "../../../../lib/api";
import { currentOrg } from "../../../../lib/org";

// Website photos and text (เว็บไซต์ › เนื้อหาหน้าเว็บ). Validated in @mstgolf/core.
export async function PUT(req: Request) {
  const user = await requireApi("posts.manage");
  if (user instanceof NextResponse) return user;
  try {
    const b = (await readJson(req)) as SiteContentInput;
    const org = await currentOrg();
    await saveSiteContent(org.id, actorOf(user), { photos: b.photos, copy: b.copy });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
