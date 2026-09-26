import { NextResponse } from "next/server";
import { staffUpdateMember } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../../lib/auth";
import { fail, optStr, readJson } from "../../../../lib/api";
import { currentOrg } from "../../../../lib/org";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireApi("members.edit");
  if (user instanceof NextResponse) return user;
  try {
    const b = await readJson(req);
    const org = await currentOrg();
    const member = await staffUpdateMember(org.id, actorOf(user), params.id, {
      fullName: optStr(b.fullName) ?? undefined,
      phone: optStr(b.phone) ?? undefined,
      birthday: b.birthday === undefined ? undefined : optStr(b.birthday) || null,
      email: b.email === undefined ? undefined : optStr(b.email) || null,
    });
    return NextResponse.json({ member });
  } catch (e) {
    return fail(e);
  }
}
