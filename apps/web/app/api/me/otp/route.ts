import type { NextRequest } from "next/server";
import { requestOtp } from "@mstgolf/core";
import { clientIp, handle, json, readJson, str } from "@/lib/api";
import { getOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

// POST { phone } — texts a 6-digit code. The answer never says whether the number is a member.
export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const { phone } = await readJson<{ phone: string }>(req);
    const org = await getOrg();
    const r = await requestOtp(org.id, str(phone, 40), { ip: clientIp(req) });
    return json({ phone: r.phone, expiresInSec: r.expiresInSec, resendInSec: r.resendInSec, devCode: r.devCode ?? null });
  });
}
