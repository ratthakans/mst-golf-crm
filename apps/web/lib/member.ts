import { cache } from "react";
import { findActiveMember, findMemberByLine, findMemberByPhone, type MemberSummary } from "@mstgolf/core";
import { getOrg } from "./org";
import { currentCustomer, sessionUsable, type Customer } from "./session";

// The signed-in customer and, once they have signed up, their member record.
// One lookup per request (React cache) for the layout, the page and the API.

export interface CurrentMember {
  customer: Customer | null;
  member: MemberSummary | null;
}

export async function memberFor(org: { id: string; settings: { features: { otp: boolean; line: boolean } } }, customer: Customer | null): Promise<MemberSummary | null> {
  if (!customer || !sessionUsable(org.settings.features, customer)) return null;
  const orgId = org.id;
  if (customer.kind === "member") return findActiveMember(orgId, customer.memberId);
  if (customer.kind === "line") return findMemberByLine(orgId, customer.sub);
  // A verified phone becomes a member the moment the sign-up (or the counter) registers it.
  const m = await findMemberByPhone(orgId, customer.phone);
  return m && m.status === "ACTIVE" && m.registered ? m : null;
}

export const currentMember = cache(async (): Promise<CurrentMember> => {
  const org = await getOrg();
  const raw = await currentCustomer();
  const customer = raw && sessionUsable(org.settings.features, raw) ? raw : null;
  const member = await memberFor(org, customer);
  return { customer, member };
});

/** What the site shows as "signed in as …". */
export function customerLabel(c: Customer | null, m: MemberSummary | null): string | null {
  if (m) return m.displayName;
  if (c?.kind === "line") return c.name || null;
  if (c?.kind === "phone") return `${c.phone.slice(0, 3)}-xxx-${c.phone.slice(-4)}`;
  return null;
}
