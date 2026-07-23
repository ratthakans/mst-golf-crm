import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";
import { AppShell } from "./AppShell";
import { CommandPalette } from "./CommandPalette";
import { getRepo } from "../lib/repo";

// Runs before paint to set the theme attribute from storage / OS preference, so
// dark mode never flashes light on first load.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('mst-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "MST Golf — ระบบสมาชิก CRM",
  description: "ระบบ CRM สมาชิกสำหรับ MST Golf",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const repo = await getRepo();
  const live = repo.source === "database";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <AppShell live={live}>{children}</AppShell>
        <CommandPalette />
      </body>
    </html>
  );
}
