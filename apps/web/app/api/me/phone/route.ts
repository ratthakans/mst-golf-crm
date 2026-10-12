import type { NextRequest } from "next/server";
import { findMemberByPhone, parsePhone } from "@mstgolf/core";
import { ApiError, handle, json, readJson, str, withSession } from "@/lib/api";
import { getOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

// POST { phone } — sign in with the number alone. Only while the tenant runs
// without SMS codes (settings.features.otp off) to test the flow; with codes on
// this route refuses and the site uses /api/me/otp instead.
export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const org = await getOrg();
    if (org.settings.features.otp) throw new ApiError(403, "OTP_REQUIRED", "กรุณายืนยันเบอร์ด้วยรหัส SMS");
    const phone = parsePhone(str((await readJson<{ phone: string }>(req)).phone, 40));
    const member = await findMemberByPhone(org.id, phone);
    if (member && member.status !== "ACTIVE") {
      return json({ error: "เบอร์นี้ใช้เข้าสู่ระบบไม่ได้ กรุณาติดต่อร้าน", code: "PHONE_TAKEN" }, 409);
    }
    if (member?.registered) return withSession(json({ next: "member" }), { kind: "member", memberId: member.id });
    return withSession(json({ next: "signup" }), { kind: "phone", phone, proven: false });
  });
}
