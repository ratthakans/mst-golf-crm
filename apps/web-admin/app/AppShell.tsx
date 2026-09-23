"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Nav } from "./Nav";
import { CommandHint } from "./CommandHint";
import { ThemeToggle } from "./ThemeToggle";
import { isPublicPath } from "../lib/public-paths";
import type { Permission } from "../lib/permissions";

// Owns the responsive shell: on desktop the sidebar is a static column, on
// narrow screens it becomes an off-canvas drawer opened from the top bar.
// The CSS decides which of the two it is — this only tracks open/closed.
export interface ShellUser {
  name: string;
  roleLabel: string;
  permissions: Permission[];
}

export function AppShell({
  live,
  orgName,
  productName,
  user,
  children,
}: {
  live: boolean;
  orgName: string;
  productName: string;
  user: ShellUser | null;
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

  // Customer-facing pages (the sign-up link) never show the back office.
  if (isPublicPath(pathname)) return <>{children}</>;

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
        <img src="/mst-logo.png" alt={orgName} className="topbar-logo" />
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
            <img src="/mst-logo.png" alt={orgName} className="brand-logo" />
          </div>
          <div className="brand-sub">{productName}</div>
          <CommandHint />
          <Nav permissions={user?.permissions ?? []} />
          <div className="spacer" />
          {user && (
            <div className="user-box">
              <div className="user-box-name">{user.name}</div>
              <div className="user-box-role">{user.roleLabel}</div>
              <div className="user-box-links">
                <a href="/account/password">เปลี่ยนรหัสผ่าน</a>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
                    window.location.assign("/login");
                  }}
                >
                  ออกจากระบบ
                </button>
              </div>
            </div>
          )}
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
