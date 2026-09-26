import type { NextRequest } from "next/server";
import { findMemberByLine } from "@mstgolf/core";
import { ApiError, handle, json, readJson, str } from "@/lib/api";
import { devLoginEnabled, getOrg } from "@/lib/org";
import { cookieOptions, MEMBER_COOKIE, signMemberSession } from "@/lib/session";

// Local development only: sign in as a fake LINE user without a LINE channel.
// Returns 404 unless NODE_ENV !== "production" and LINE_DEV_LOGIN=1.
export async function POST(req: NextRequest) {
  if (!devLoginEnabled()) return json({ error: "Not found", code: "NOT_FOUND" }, 404);
  return handle(req, async () => {
    const body = await readJson<{ lineUserId: string; name: string }>(req);
    const sub = str(body.lineUserId, 64).trim();
    const name = str(body.name, 80).trim() || "Dev user";
    if (!/^[A-Za-z0-9_-]{3,64}$/.test(sub)) throw new ApiError(400, "INVALID_INPUT", "LINE user id ใช้ A-Z 0-9 _ - ยาว 3–64 ตัว");
    const org = await getOrg();
    const session = await signMemberSession({ sub, name, picture: null });
    const member = await findMemberByLine(org.id, sub);
    const res = json({ ok: true, member: !!member });
    res.cookies.set(MEMBER_COOKIE, session, cookieOptions);
    return res;
  });
}
