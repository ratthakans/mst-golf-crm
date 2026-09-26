import type { NextRequest } from "next/server";
import { findMemberByLine, lineConfig, verifyIdToken } from "@mstgolf/core";
import { ApiError, handle, json, readJson, str } from "@/lib/api";
import { getOrg } from "@/lib/org";
import { cookieOptions, MEMBER_COOKIE, signMemberSession } from "@/lib/session";

// POST { idToken } — the LIFF ID token is verified with LINE (client_id = the
// LINE Login channel) and exchanged for our own httpOnly session cookie.
export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const { idToken } = await readJson<{ idToken: string }>(req);
    const token = str(idToken, 4000);
    if (!token) throw new ApiError(400, "INVALID_INPUT", "ไม่พบข้อมูลการเข้าสู่ระบบจาก LINE");
    const org = await getOrg();
    const line = await lineConfig(org.id);
    if (!line?.loginChannelId) throw new ApiError(503, "LINE_NOT_CONFIGURED", "ระบบสมาชิกกำลังจะเปิดให้บริการ");
    const profile = await verifyIdToken(token, line.loginChannelId);
    if (!profile) throw new ApiError(401, "TOKEN_INVALID", "การเข้าสู่ระบบหมดอายุ กรุณาลองใหม่");
    const session = await signMemberSession({ sub: profile.sub, name: profile.name ?? "", picture: profile.picture ?? null });
    const member = await findMemberByLine(org.id, profile.sub);
    const res = json({ ok: true, member: !!member });
    res.cookies.set(MEMBER_COOKIE, session, cookieOptions);
    return res;
  });
}

// DELETE — sign out of this site (LIFF's own logout happens in the browser).
export async function DELETE(req: NextRequest) {
  return handle(req, async () => {
    const res = json({ ok: true });
    res.cookies.set(MEMBER_COOKIE, "", { ...cookieOptions, maxAge: 0 });
    return res;
  });
}
