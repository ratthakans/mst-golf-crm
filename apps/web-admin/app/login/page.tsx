import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "../../lib/auth";
import { currentOrg } from "../../lib/org";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const org = await currentOrg();
  return { title: `เข้าสู่ระบบ · ${org.settings.productName}`, robots: { index: false } };
}

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  if (await getSessionUser()) redirect("/");
  const org = await currentOrg();
  return (
    <main className="public-page login-page">
      <header className="public-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mst-logo.png" alt={org.name} className="public-logo" />
        <h1>{org.settings.productName}</h1>
        <p>เข้าสู่ระบบสำหรับพนักงาน</p>
      </header>
      <LoginForm next={searchParams.next ?? "/"} />
    </main>
  );
}
