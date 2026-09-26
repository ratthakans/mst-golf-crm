import { NextResponse } from "next/server";
import { createMemberAtCounter } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../lib/auth";
import { fail, optStr, readJson, str } from "../../../lib/api";
import { currentOrg } from "../../../lib/org";
import { flushOutbox } from "../../../lib/outbox";

// Staff create a member at the counter. (Customers sign up in LINE / on the website.)
export async function POST(req: Request) {
  const user = await requireApi("members.create");
  if (user instanceof NextResponse) return user;
  try {
    const b = await readJson(req);
    const org = await currentOrg();
    const r = await createMemberAtCounter(org.id, actorOf(user), {
      fullName: str(b.fullName),
      phone: str(b.phone),
      birthday: optStr(b.birthday) || null,
      email: optStr(b.email) || null,
      consentConfirmed: b.consentConfirmed === true,
      marketing: b.marketing === true,
    });
    flushOutbox();
    return NextResponse.json({ member: r.member, welcomePoints: r.welcomePoints }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
