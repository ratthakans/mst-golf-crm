"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/app/member", label: "บัตรสมาชิก" },
  { href: "/app/booking", label: "จองซิม" },
];

export function AppTabs() {
  const path = usePathname() ?? "";
  return (
    <nav className="app-tabs" aria-label="เมนูสมาชิก">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="app-tab" aria-current={path.startsWith(l.href) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
