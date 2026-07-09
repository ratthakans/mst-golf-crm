import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";
import { Nav } from "./Nav";
import { CommandPalette } from "./CommandPalette";
import { CommandHint } from "./CommandHint";
import { ThemeToggle } from "./ThemeToggle";
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
        <div className="layout">
          <aside className="sidebar">
            <div className="brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mst-logo.png" alt="MST Golf" className="brand-logo" />
            </div>
            <div className="brand-sub">ระบบสมาชิก CRM</div>
            <CommandHint />
            <Nav />
            <div className="spacer" />
            <ThemeToggle />
            <div className={`src-badge ${live ? "live" : "sample"}`}>
              <span className="src-dot" />
              {live ? "ฐานข้อมูลจริง" : "ข้อมูลตัวอย่าง"}
              <div className="src-hint">
                {live
                  ? "อ่าน/เขียน Postgres"
                  : "ตั้ง DATA_SOURCE=database เพื่อใช้ Postgres"}
              </div>
            </div>
          </aside>
          <main className="main">{children}</main>
        </div>
        <CommandPalette />
      </body>
    </html>
  );
}
