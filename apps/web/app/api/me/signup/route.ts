import type { NextRequest } from "next/server";
import { signUp } from "@mstgolf/core";
import { ApiError, handle, isLineClient, json, kickOutbox, readJson, requireCustomer, str, withSession } from "@/lib/api";
import { getOrg } from "@/lib/org";
import { loadCard } from "@/lib/views";

interface SignupBody {
  fullName: string;
  phone: string;
  birthday: string | null;
  email: string | null;
  acceptTerms: boolean;
  marketing: boolean;
  inLine: boolean;
}

// POST — sign the visitor up. Who they are comes from the cookie only: a mobile
// number they proved with an SMS code, or (when LINE is on) their LINE user. An
// existing counter/POS member with that number is linked, not duplicated.
export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const customer = await requireCustomer();
    if (customer.kind === "member") throw new ApiError(409, "ALREADY_MEMBER", "คุณเป็นสมาชิกอยู่แล้ว");
    const body = await readJson<SignupBody>(req);
    const org = await getOrg();
    const viaLine = customer.kind === "line";
    const result = await signUp(org.id, {
      lineUserId: viaLine ? customer.sub : null,
      verifiedPhone: viaLine ? null : customer.phone,
      phoneProven: viaLine ? undefined : customer.proven,
      channel: viaLine && (body.inLine === true || isLineClient(req)) ? "LINE" : "WEB",
      fullName: str(body.fullName, 120),
      phone: viaLine ? str(body.phone, 40) : customer.phone,
      birthday: str(body.birthday, 20) || null,
      email: str(body.email, 160) || null,
      pictureUrl: viaLine ? customer.picture : null,
      acceptTerms: body.acceptTerms === true,
      marketing: body.marketing === true,
    });
    kickOutbox();
    const res = json({ outcome: result.outcome, welcomePoints: result.welcomePoints, member: await loadCard(org.id, result.member.id) }, 201);
    // The member session is as proven as the phone session it replaces.
    return viaLine ? res : withSession(res, { kind: "member", memberId: result.member.id, proven: customer.kind === "phone" && customer.proven });
  });
}
