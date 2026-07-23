"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Nav } from "./Nav";
import { CommandHint } from "./CommandHint";
import { ThemeToggle } from "./ThemeToggle";

// Owns the responsive shell: on desktop the sidebar is a static column, on
// narrow screens it becomes an off-canvas drawer opened from the top bar.
// The CSS decides which of the two it is — this only tracks open/closed.
export function AppShell({
  live,
  children,
}: {
  live: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Any navigation closes the drawer — covers nav links, the command palette
  // and the back button alike.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header className="topbar">
        <button
          type="button"
          className="hamburger"
          onClick={() => setOpen(true)}
          aria-label="เปิดเมนู"
          aria-expanded={open}
          aria-controls="app-sidebar"
        >
          <span />
          <span />
          <span />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mst-logo.png" alt="MST Golf" className="topbar-logo" />
        {!live && <span className="topbar-tag">ตัวอย่าง</span>}
      </header>

      <div
        className={`scrim${open ? " show" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div className="layout">
        <aside id="app-sidebar" className={`sidebar${open ? " open" : ""}`}>
          <button
            type="button"
            className="drawer-close"
            onClick={() => setOpen(false)}
            aria-label="ปิดเมนู"
          >
            ✕
          </button>
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
    </>
  );
}
