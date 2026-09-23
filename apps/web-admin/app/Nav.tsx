"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

type Item = { href: string; label: string; icon: string; soon?: string };

// The six back-office menus (MST-DEV-PLAN §6). Campaigns and Simulator ship in
// phase 2 — shown, but not linked, so the shape of the product is visible now.
const PRIMARY: Item[] = [
  { href: "/", label: "ภาพรวม", icon: "📊" },
  { href: "/playbook", label: "แผนลงมือ", icon: "🎬" },
  { href: "/members", label: "สมาชิก", icon: "👥" },
  { href: "/import", label: "นำเข้า POS", icon: "📥" },
  { href: "/campaigns", label: "แคมเปญ", icon: "📣", soon: "เฟส 2" },
  { href: "/simulator", label: "ซิมกอล์ฟ", icon: "⛳", soon: "เฟส 2" },
];

// Interim tools: segments become the WHO step of campaigns in phase 2.
const TOOLS: Item[] = [
  { href: "/segments", label: "กลุ่มลูกค้า", icon: "🎯" },
];

const isActive = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);

function NavLink({ item, pathname }: { item: Item; pathname: string }) {
  if (item.soon) {
    return (
      <span className="nav-link soon" aria-disabled="true">
        <span>{item.icon}</span>
        {item.label}
        <em className="nav-soon">{item.soon}</em>
      </span>
    );
  }
  const active = isActive(item.href, pathname);
  return (
    <Link
      href={item.href}
      className={`nav-link${active ? " active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <span>{item.icon}</span>
      {item.label}
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();
  const toolActive = TOOLS.some((t) => isActive(t.href, pathname));
  // Open when the current page lives in here, so the active link is never hidden.
  const [open, setOpen] = useState(toolActive);

  return (
    <nav className="nav">
      <div className="nav-group">
        {PRIMARY.map((l) => (
          <NavLink key={l.href} item={l} pathname={pathname} />
        ))}
      </div>

      <button
        type="button"
        className={`nav-section${open ? " open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="nav-tools"
        aria-label="เครื่องมือ"
      >
        <span className="nav-section-label">เครื่องมือ</span>
        {!open && toolActive && <span className="nav-section-dot" aria-hidden="true" />}
        <span className="nav-caret" aria-hidden="true">
          ⌄
        </span>
      </button>

      {open && (
        <div className="nav-group" id="nav-tools">
          {TOOLS.map((l) => (
            <NavLink key={l.href} item={l} pathname={pathname} />
          ))}
        </div>
      )}
    </nav>
  );
}
