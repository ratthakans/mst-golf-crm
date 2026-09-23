import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "../../lib/auth";
import { DEV_ADMIN, getRepo } from "../../lib/repo";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const org = await (await getRepo()).getOrg();
  return { title: `เข้าสู่ระบบ · ${org.productName}`, robots: { index: false } };
}

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  if (await getSessionUser()) redirect("/");
  const repo = await getRepo();
  const org = await repo.getOrg();
  // Local sample mode only: show the built-in dev account so nobody has to dig for it.
  const devHint =
    process.env.NODE_ENV === "development" && repo.source === "sample" && !process.env.ADMIN_EMAIL ? DEV_ADMIN : null;

  return (
    <main className="public-page login-page">
      <header className="public-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mst-logo.png" alt={org.name} className="public-logo" />
        <h1>{org.productName}</h1>
        <p>เข้าสู่ระบบสำหรับพนักงาน</p>
      </header>
      <LoginForm next={searchParams.next ?? "/"} />
      {devHint && (
        <p className="login-dev-hint">
          โหมดข้อมูลตัวอย่าง (เครื่อง dev): <code>{devHint.email}</code> / <code>{devHint.password}</code>
        </p>
      )}
    </main>
  );
}
