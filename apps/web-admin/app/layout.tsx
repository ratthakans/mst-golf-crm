import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";
import { AppShell } from "./AppShell";
import { CommandPalette } from "./CommandPalette";
import { getRepo } from "../lib/repo";
import { getSessionUser } from "../lib/auth";
import { ROLE_LABEL } from "../lib/permissions";

// Runs before paint to set the theme attribute from storage / OS preference, so
// dark mode never flashes light on first load.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('mst-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;

// Names come from the tenant's config, never from code.
export async function generateMetadata(): Promise<Metadata> {
  const org = await (await getRepo()).getOrg();
  return {
    title: org.productName,
    description: `ระบบ Customer Intelligence ของ ${org.name}`,
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const repo = await getRepo();
  const live = repo.source === "database";
  const org = await repo.getOrg();
  const user = await getSessionUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <AppShell
          live={live}
          orgName={org.name}
          productName={org.productName}
          user={user ? { name: user.name, roleLabel: ROLE_LABEL[user.role], permissions: user.permissions } : null}
        >
          {children}
        </AppShell>
        <CommandPalette permissions={user?.permissions ?? []} />
      </body>
    </html>
  );
}
