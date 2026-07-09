"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const LINKS = [
  { href: "/", label: "ภาพรวม", icon: "📊" },
  { href: "/playbook", label: "แผนลงมือ", icon: "🎬" },
  { href: "/analytics", label: "วิเคราะห์ข้อมูล", icon: "📈" },
  { href: "/insights", label: "สัญญาณ & เคลื่อนไหว", icon: "🧠" },
  { href: "/operations", label: "เชิงลึก", icon: "🔎" },
  { href: "/members", label: "สมาชิก", icon: "👥" },
  { href: "/segments", label: "กลุ่มลูกค้า", icon: "🎯" },
  { href: "/automations", label: "ระบบอัตโนมัติ", icon: "⚡" },
  { href: "/raw", label: "ข้อมูลดิบ", icon: "🧾" },
  { href: "/import", label: "นำเข้า POS", icon: "📥" },
  { href: "/join", label: "ฟอร์มสมัคร", icon: "📝" },
  { href: "/data-model", label: "โครงสร้างข้อมูล", icon: "🗄️" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link${active ? " active" : ""}`}
          >
            <span>{l.icon}</span>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
