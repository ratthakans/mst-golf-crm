import { redirect } from "next/navigation";
import { LiffEntry } from "@/components/customer/LiffEntry";
import { getOrg, loginSetup } from "@/lib/org";

export const dynamic = "force-dynamic";

// LIFF endpoint. liff.line.me/<liffId>/member opens https://<domain>/app?liff.state=/member;
// liff.init() then forwards to /app/member. Without LINE configured, go straight there.
export default async function AppEntry() {
  const setup = await loginSetup((await getOrg()).id);
  if (!setup.lineReady || !setup.liffId) redirect("/app/member");
  return <LiffEntry liffId={setup.liffId} />;
}
