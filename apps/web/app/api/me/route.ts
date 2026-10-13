import type { NextRequest } from "next/server";
import { handle, json, requireCustomer } from "@/lib/api";
import { customerLabel, memberFor } from "@/lib/member";
import { getOrg } from "@/lib/org";
import { loadCard } from "@/lib/views";

export const dynamic = "force-dynamic";

// GET — who is signed in, and their member card (null before sign-up).
export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const customer = await requireCustomer();
    const org = await getOrg();
    const member = await memberFor(org, customer);
    return json({
      user: { name: customerLabel(customer, member), via: customer.kind === "line" ? "LINE" : "PHONE" },
      member: member ? await loadCard(org.id, member.id) : null,
    });
  });
}
