import type { NextRequest } from "next/server";
import { updateOwnProfile, type ProfileInput } from "@mstgolf/core";
import { handle, json, readJson, requireMember, str } from "@/lib/api";
import { loadCard } from "@/lib/views";

// PATCH { fullName?, email?, birthday?, marketing? } — the member edits their
// own profile. Phone is not editable here (the store changes it, with audit).
export async function PATCH(req: NextRequest) {
  return handle(req, async () => {
    const { orgId, member } = await requireMember();
    const body = await readJson<{ fullName: string; email: string | null; birthday: string | null; marketing: boolean }>(req);
    const input: ProfileInput = {};
    if (typeof body.fullName === "string") input.fullName = str(body.fullName, 120);
    if (body.email === null || typeof body.email === "string") input.email = body.email ? str(body.email, 160) : null;
    // Birthday is set once; only send it when the member has none yet.
    if (typeof body.birthday === "string" && body.birthday && !member.birthday) input.birthday = str(body.birthday, 20);
    if (typeof body.marketing === "boolean") input.marketing = body.marketing;
    await updateOwnProfile(orgId, member.id, input);
    return json({ member: await loadCard(orgId, member.id) });
  });
}
