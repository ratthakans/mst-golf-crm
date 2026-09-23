import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";
import { AppShell } from "./AppShell";
import { CommandPalette } from "./CommandPalette";
import { getRepo } from "../lib/repo";

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

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <AppShell live={live} orgName={org.name} productName={org.productName}>
          {children}
        </AppShell>
        <CommandPalette />
      </body>
    </html>
  );
}
