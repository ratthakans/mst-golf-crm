import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentConsentTexts, findMemberByLine, localDateKey } from "@mstgolf/core";
import { LoginPanel } from "@/components/customer/LoginPanel";
import { MemberView } from "@/components/customer/MemberView";
import { SignupForm } from "@/components/customer/SignupForm";
import { getOrg, loginSetup } from "@/lib/org";
import { qrDataUrl } from "@/lib/qr";
import { currentLineUser } from "@/lib/session";
import { loadCard, loadPoints } from "@/lib/views";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "บัตรสมาชิก",
  description: "สมัครสมาชิก MST Golf ด้วย LINE ดูบัตร QR แต้ม และระดับสมาชิก",
  robots: { index: false, follow: false },
};

// /app/member — the same page in LINE (LIFF, Rich Menu button A+B) and on the
// web (LINE Login): sign-in → sign-up form or the member card.
export default async function MemberPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = searchParams.next === "booking" || searchParams.next === "rewards" ? searchParams.next : null;
  const org = await getOrg();
  const [setup, user] = await Promise.all([loginSetup(org.id), currentLineUser()]);

  if (!user) return <LoginPanel setup={setup} purpose="member" />;

  const member = await findMemberByLine(org.id, user.sub);
  if (!member) {
    const { terms, marketing } = await currentConsentTexts(org.id);
    const doc = (t: typeof terms) => (t ? { title: t.title, body: t.body, version: t.version } : null);
    return (
      <SignupForm
        lineName={user.name}
        welcomePoints={org.settings.welcomeBonus}
        terms={doc(terms)}
        marketing={doc(marketing)}
        next={next}
        todayKey={localDateKey(new Date())}
        birthdayMultiplier={org.settings.tiers[0]?.benefits.birthdayPointMultiplier ?? 1}
      />
    );
  }

  if (next) redirect(`/app/${next}`);

  const [card, points] = await Promise.all([loadCard(org.id, member.id), loadPoints(org.id, member.id)]);
  const tiers = org.settings.tiers;

  return (
    <MemberView
      card={card}
      points={points}
      qrSrc={await qrDataUrl(card.code)}
      topTierName={tiers[tiers.length - 1]?.name ?? null}
    />
  );
}
