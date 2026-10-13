import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentConsentTexts, localDateKey } from "@mstgolf/core";
import { LoginPanel } from "@/components/customer/LoginPanel";
import { MemberView } from "@/components/customer/MemberView";
import { SignupForm } from "@/components/customer/SignupForm";
import { getOrg, loginSetup } from "@/lib/org";
import { qrDataUrl } from "@/lib/qr";
import { currentMember } from "@/lib/member";
import { loadCard, loadPoints } from "@/lib/views";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "บัตรสมาชิก",
  description: "สมัครสมาชิก MST Golf ด้วยเบอร์มือถือ ดูบัตร QR แต้ม และระดับสมาชิก",
  robots: { index: false, follow: false },
};

// /app/member — sign-in (mobile + SMS code, or LINE when on) → sign-up form or
// the member card. /register and /login land here.
export default async function MemberPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = searchParams.next === "booking" || searchParams.next === "rewards" ? searchParams.next : null;
  const org = await getOrg();
  const [setup, { customer, member }] = await Promise.all([loginSetup(org.id), currentMember()]);

  if (!customer || (customer.kind === "member" && !member)) {
    // What signing up gets you, from the org's own settings (never hardcoded numbers).
    const tiers = org.settings.tiers;
    const topDiscount = Math.max(0, ...tiers.map((t) => t.benefits.discountPct));
    const perks = [
      org.settings.welcomeBonus > 0 ? `รับ ${org.settings.welcomeBonus.toLocaleString("th-TH")} แต้มทันทีเมื่อสมัคร` : "สะสมแต้มทุกการซื้อในร้าน",
      topDiscount > 0 ? `ส่วนลดสินค้าตามระดับสมาชิก สูงสุด ${topDiscount}%` : "สิทธิ์และโปรโมชันเฉพาะสมาชิก",
      "จองซิมกอล์ฟออนไลน์ เลือกเลนและเวลาได้เอง",
    ];
    return <LoginPanel setup={setup} purpose="member" perks={perks} />;
  }

  if (!member) {
    const { terms, marketing } = await currentConsentTexts(org.id);
    const doc = (t: typeof terms) => (t ? { title: t.title, body: t.body, version: t.version } : null);
    return (
      <SignupForm
        prefillName={customer.kind === "line" ? customer.name : ""}
        verifiedPhone={customer.kind === "phone" ? customer.phone : null}
        phoneProven={customer.kind === "phone" && customer.proven}
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
