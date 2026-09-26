import type { Metadata } from "next";
import { currentConsentTexts } from "@mstgolf/core";
import { ConsentDocument } from "@/components/ConsentDocument";
import { getOrg } from "@/lib/org";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "ข้อกำหนดสมาชิก",
  description: "ข้อกำหนดการเป็นสมาชิก MST Golf ฉบับปัจจุบัน",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const org = await getOrg();
  const { terms } = await currentConsentTexts(org.id);
  return (
    <ConsentDocument
      heading="ข้อกำหนดสมาชิก"
      sections={terms ? [{ title: terms.title, body: terms.body, version: terms.version, effectiveAt: terms.effectiveAt.toISOString() }] : []}
    />
  );
}
