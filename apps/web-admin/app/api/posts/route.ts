import { NextResponse } from "next/server";
import { savePost } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../lib/auth";
import { fail, readJson } from "../../../lib/api";
import { currentOrg } from "../../../lib/org";
import { postInput } from "../../../lib/post-input";

export async function POST(req: Request) {
  const user = await requireApi("posts.manage");
  if (user instanceof NextResponse) return user;
  try {
    const org = await currentOrg();
    const post = await savePost(org.id, actorOf(user), null, postInput(await readJson(req)));
    return NextResponse.json({ post }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
