"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/nav";

export function NavLinks() {
  const path = usePathname() ?? "/";
  return (
    <ul className="nav-list">
      {NAV.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <li key={n.href}>
            <Link href={n.href} className="nav-link" aria-current={active ? "page" : undefined}>
              {n.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
