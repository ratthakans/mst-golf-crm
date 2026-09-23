import type { Metadata } from "next";
import { getRepo } from "../../lib/repo";
import { SignupForm } from "./SignupForm";

// Public sign-up page — the link staff share and the QR at the counter.
// Rendered without the back-office shell (see lib/public-paths.ts) and it reads
// only the org's name, form fields and consent text.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const org = await (await getRepo()).getOrg();
  return {
    title: `สมัครสมาชิก · ${org.name}`,
    description: `สมัครสมาชิก ${org.name} รับแต้มต้อนรับ ${org.signupBonus.toLocaleString("en-TH")} แต้ม`,
    robots: { index: false },
  };
}

export default async function RegisterPage() {
  const repo = await getRepo();
  const [org, fields] = await Promise.all([repo.getOrg(), repo.getFieldDefinitions()]);

  return (
    <main className="public-page">
      <header className="public-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mst-logo.png" alt={org.name} className="public-logo" />
        <h1>สมัครสมาชิก</h1>
        <p>
          สะสมแต้มทุกการซื้อ รับสิทธิพิเศษตามระดับสมาชิก — สมัครวันนี้รับ{" "}
          <strong>{org.signupBonus.toLocaleString("en-TH")} แต้ม</strong>
        </p>
      </header>
      <SignupForm
        mode="public"
        orgName={org.name}
        fields={fields}
        consentText={org.consentText}
        signupBonus={org.signupBonus}
      />
    </main>
  );
}
