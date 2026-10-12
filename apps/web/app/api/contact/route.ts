import type { NextRequest } from "next/server";
import { submitContact } from "@mstgolf/core";
import { clientIp, handle, json, kickOutbox, readJson, str } from "@/lib/api";
import { currentMember } from "@/lib/member";
import { getOrg } from "@/lib/org";

// POST — the contact form. Delivered to Marketing's email; refused with an
// honest message (and the store's phone) when no one would receive it.
export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const b = await readJson<{ name: string; phone: string; email: string; topic: string; message: string; website: string }>(req);
    const org = await getOrg();
    const { member } = await currentMember();
    await submitContact(org.id, {
      name: str(b.name, 120),
      phone: str(b.phone, 40) || null,
      email: str(b.email, 160) || null,
      topic: str(b.topic, 60),
      message: str(b.message, 2000),
      website: str(b.website, 200) || null,
      memberCode: member?.code ?? null,
      ip: clientIp(req),
    });
    kickOutbox();
    return json({ ok: true });
  });
}
