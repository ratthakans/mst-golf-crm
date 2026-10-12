import type { NextRequest } from "next/server";
import { findMemberByPhone, verifyOtp } from "@mstgolf/core";
import { handle, json, readJson, str, withSession } from "@/lib/api";
import { getOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

// POST { phone, code } — a correct code signs the member in; a number with no
// registered member gets a short "verified phone" session to finish sign-up.
export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const body = await readJson<{ phone: string; code: string }>(req);
    const org = await getOrg();
    const phone = await verifyOtp(org.id, str(body.phone, 40), str(body.code, 12));
    const member = await findMemberByPhone(org.id, phone);
    if (member && member.status === "ACTIVE" && member.registered) {
      return withSession(json({ next: "member" }), { kind: "member", memberId: member.id });
    }
    if (member && member.status !== "ACTIVE") {
      return json({ error: "เบอร์นี้ใช้เข้าสู่ระบบไม่ได้ กรุณาติดต่อร้าน", code: "PHONE_TAKEN" }, 409);
    }
    return withSession(json({ next: "signup" }), { kind: "phone", phone, proven: true });
  });
}
