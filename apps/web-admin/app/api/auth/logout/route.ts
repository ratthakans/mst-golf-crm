import { NextResponse } from "next/server";
import { audit, endSession, getSessionUser } from "../../../../lib/auth";

export async function POST() {
  const user = await getSessionUser();
  if (user) await audit(user, { action: "auth.logout", entity: "user", entityId: user.id });
  endSession();
  return NextResponse.json({ ok: true });
}
