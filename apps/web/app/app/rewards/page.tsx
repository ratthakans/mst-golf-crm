import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { findMemberByLine, listStores } from "@mstgolf/core";
import { LoginPanel } from "@/components/customer/LoginPanel";
import { RewardsApp } from "@/components/customer/RewardsApp";
import { getOrg, loginSetup } from "@/lib/org";
import { currentLineUser } from "@/lib/session";
import { loadCard, loadRewards } from "@/lib/views";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "แลกรางวัล",
  description: "ใช้แต้มสมาชิก MST Golf แลกคูปองส่วนลดและของรางวัล ติดตามสถานะได้ใน LINE",
  robots: { index: false, follow: false },
};

// /app/rewards — Rich Menu "Points & Rewards": catalogue, my coupons, my requests.
export default async function RewardsPage() {
  const org = await getOrg();
  if (!org.settings.features.rewards) {
    return (
      <section className="panel login-panel">
        <h1>ระบบแลกรางวัลยังไม่เปิด</h1>
        <p className="muted">สะสมแต้มไว้ได้เลย แต้มของคุณอยู่ครบในบัตรสมาชิก</p>
      </section>
    );
  }
  const [setup, user] = await Promise.all([loginSetup(org.id), currentLineUser()]);
  if (!user) return <LoginPanel setup={setup} purpose="rewards" />;
  const member = await findMemberByLine(org.id, user.sub);
  if (!member) redirect("/app/member?next=rewards");

  const [card, data, stores] = await Promise.all([loadCard(org.id, member.id), loadRewards(org.id, member.id), listStores(org.id)]);
  return (
    <RewardsApp
      initial={data}
      contact={{ name: card.name, phone: card.phone ?? "" }}
      stores={stores.filter((s) => s.isActive).map((s) => ({ id: s.id, name: s.name, address: s.address }))}
    />
  );
}
