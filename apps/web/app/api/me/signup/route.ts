import type { NextRequest } from "next/server";
import { signUp } from "@mstgolf/core";
import { handle, isLineClient, json, kickOutbox, readJson, requireLineUser, str } from "@/lib/api";
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

// POST — sign the current LINE user up (or link them to the member the store
// already created with this phone). The LINE user comes from the cookie only.
export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const user = await requireLineUser();
    const body = await readJson<SignupBody>(req);
    const org = await getOrg();
    const result = await signUp(org.id, {
      lineUserId: user.sub,
      channel: body.inLine === true || isLineClient(req) ? "LINE" : "WEB",
      fullName: str(body.fullName, 120),
      phone: str(body.phone, 40),
      birthday: str(body.birthday, 20) || null,
      email: str(body.email, 160) || null,
      pictureUrl: user.picture,
      acceptTerms: body.acceptTerms === true,
      marketing: body.marketing === true,
    });
    kickOutbox();
    return json(
      {
        outcome: result.outcome,
        welcomePoints: result.welcomePoints,
        member: await loadCard(org.id, result.member.id),
      },
      201,
    );
  });
}
