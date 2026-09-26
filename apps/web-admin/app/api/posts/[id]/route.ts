import { NextResponse } from "next/server";
import { deletePost, savePost } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../../lib/auth";
import { fail, readJson } from "../../../../lib/api";
import { currentOrg } from "../../../../lib/org";
import { postInput } from "../../../../lib/post-input";
import { deletePublicImage } from "../../../../lib/public-images";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireApi("posts.manage");
  if (user instanceof NextResponse) return user;
  try {
    const org = await currentOrg();
    const post = await savePost(org.id, actorOf(user), params.id, postInput(await readJson(req)));
    return NextResponse.json({ post });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireApi("posts.manage");
  if (user instanceof NextResponse) return user;
  try {
    const org = await currentOrg();
    const { coverUrl } = await deletePost(org.id, actorOf(user), params.id);
    await deletePublicImage(coverUrl).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
