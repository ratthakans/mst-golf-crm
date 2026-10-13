import type { NextRequest } from "next/server";
import { findMemberByPhone, parsePhone, RATE, takeHit } from "@mstgolf/core";
import { ApiError, clientIp, handle, json, readJson, str, withSession } from "@/lib/api";
import { getOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

// POST { phone } — sign in with the number alone. Only while the tenant runs
// without SMS codes (settings.features.otp off) to test the flow; with codes on
// this route refuses and the site uses /api/me/otp instead. Never on the
// production database unless ALLOW_PHONE_ONLY_SIGNIN=1 is set on purpose, and
// rate-limited per IP and per number (durable, in the database).
export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const org = await getOrg();
    const productionDb = (process.env.DATABASE_SCHEMA || "public") === "public";
    if (org.settings.features.otp || (productionDb && process.env.ALLOW_PHONE_ONLY_SIGNIN !== "1")) {
      throw new ApiError(403, "OTP_REQUIRED", "กรุณายืนยันเบอร์ด้วยรหัส SMS");
    }
    const phone = parsePhone(str((await readJson<{ phone: string }>(req)).phone, 40));
    await takeHit(
      org.id,
      "phone_signin",
      [
        { key: clientIp(req), max: 30, windowMs: RATE.HOUR },
        { key: phone, max: 10, windowMs: RATE.HOUR },
      ],
      "ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่",
    );
    const member = await findMemberByPhone(org.id, phone);
    if (member && member.status !== "ACTIVE") {
      return json({ error: "เบอร์นี้ใช้เข้าสู่ระบบไม่ได้ กรุณาติดต่อร้าน", code: "PHONE_TAKEN" }, 409);
    }
    if (member?.registered) return withSession(json({ next: "member" }), { kind: "member", memberId: member.id, proven: false });
    return withSession(json({ next: "signup" }), { kind: "phone", phone, proven: false });
  });
}
