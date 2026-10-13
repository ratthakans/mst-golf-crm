import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";
import "./phase1.css";
import { AppShell } from "./AppShell";
import { CommandPalette } from "./CommandPalette";
import { getSessionUser } from "../lib/auth";
import { currentOrg } from "../lib/org";
import { ROLE_LABEL } from "../lib/permissions";

// Names come from the tenant's config, never from code.
export async function generateMetadata(): Promise<Metadata> {
  const org = await currentOrg();
  return {
    title: org.name,
    description: `ระบบสมาชิก แต้ม และจองซิมกอล์ฟของ ${org.name}`,
    robots: { index: false, follow: false },
    icons: { icon: "/icon.svg" },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [org, user] = await Promise.all([currentOrg(), getSessionUser()]);
  return (
    <html lang="th">
      <body>
        <AppShell
          orgName={org.name}
          user={user ? { name: user.name, roleLabel: ROLE_LABEL[user.role], permissions: user.permissions } : null}
        >
          {children}
        </AppShell>
        {user && <CommandPalette permissions={user.permissions} />}
      </body>
    </html>
  );
}
