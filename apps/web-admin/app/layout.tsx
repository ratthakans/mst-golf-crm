import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";
import "./phase1.css";
import { AppShell } from "./AppShell";
import { CommandPalette } from "./CommandPalette";
import { getSessionUser } from "../lib/auth";
import { currentOrg } from "../lib/org";
import { ROLE_LABEL } from "../lib/permissions";

// Runs before paint to set the theme attribute from storage / OS preference, so
// dark mode never flashes light on first load.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('mst-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;

// Names come from the tenant's config, never from code.
export async function generateMetadata(): Promise<Metadata> {
  const org = await currentOrg();
  return {
    title: org.settings.productName,
    description: `ระบบสมาชิก แต้ม และจองซิมกอล์ฟของ ${org.name}`,
    robots: { index: false, follow: false },
    icons: { icon: "/icon.svg" },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [org, user] = await Promise.all([currentOrg(), getSessionUser()]);
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <AppShell
          orgName={org.name}
          productName={org.settings.productName}
          user={user ? { name: user.name, roleLabel: ROLE_LABEL[user.role], permissions: user.permissions } : null}
        >
          {children}
        </AppShell>
        {user && <CommandPalette permissions={user.permissions} />}
      </body>
    </html>
  );
}
