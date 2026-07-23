"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

type Item = { href: string; label: string; icon: string };

// The four pages that carry the day-to-day CRM work. Everything else lives
// under TOOLS so the sidebar reads as a short list instead of a wall of links.
const PRIMARY: Item[] = [
  { href: "/", label: "ภาพรวม", icon: "📊" },
  { href: "/playbook", label: "แผนลงมือ", icon: "🎬" },
  { href: "/members", label: "สมาชิก", icon: "👥" },
  { href: "/segments", label: "กลุ่มลูกค้า", icon: "🎯" },
];

// Still fully routable — just collapsed by default.
const TOOLS: Item[] = [
  { href: "/analytics", label: "วิเคราะห์ข้อมูล", icon: "📈" },
  { href: "/insights", label: "สัญญาณ & เคลื่อนไหว", icon: "🧠" },
  { href: "/operations", label: "เชิงลึก", icon: "🔎" },
  { href: "/automations", label: "ระบบอัตโนมัติ", icon: "⚡" },
  { href: "/quote", label: "ใบเสนอราคา & ROI", icon: "💰" },
  { href: "/import", label: "นำเข้า POS", icon: "📥" },
  { href: "/raw", label: "ข้อมูลดิบ", icon: "🧾" },
  { href: "/join", label: "ฟอร์มสมัคร", icon: "📝" },
  { href: "/data-model", label: "โครงสร้างข้อมูล", icon: "🗄️" },
];

const isActive = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);

function NavLink({ item, pathname }: { item: Item; pathname: string }) {
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
