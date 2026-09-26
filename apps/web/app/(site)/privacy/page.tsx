import type { Metadata } from "next";
import { currentConsentTexts } from "@mstgolf/core";
import { ConsentDocument } from "@/components/ConsentDocument";
import { getOrg } from "@/lib/org";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว",
  description: "MST Golf เก็บและใช้ข้อมูลส่วนบุคคลของสมาชิกอย่างไร ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562",
  alternates: { canonical: "/privacy" },
};

// The consent texts are versioned in the back office; this page always shows
// the version currently in force (the same text members accept at sign-up).
export default async function PrivacyPage() {
  const org = await getOrg();
  const { terms, marketing } = await currentConsentTexts(org.id);
  const sections = [terms, marketing]
    .filter((t): t is NonNullable<typeof t> => !!t)
    .map((t) => ({ title: t.title, body: t.body, version: t.version, effectiveAt: t.effectiveAt.toISOString() }));
  return (
    <ConsentDocument
      heading="นโยบายความเป็นส่วนตัว"
      intro="ข้อความด้านล่างคือความยินยอมที่สมาชิกให้ไว้ตอนสมัคร ขอเข้าถึง แก้ไข หรือลบข้อมูลของคุณได้โดยติดต่อร้าน และเปลี่ยนการรับข่าวสารได้เองในหน้าโปรไฟล์สมาชิก"
      sections={sections}
    />
  );
}
