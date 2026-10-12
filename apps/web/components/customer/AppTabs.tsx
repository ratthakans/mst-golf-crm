"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBell } from "@/components/icons";

const LINKS = [
  { href: "/app/member", label: "บัตรสมาชิก" },
  { href: "/app/rewards", label: "รางวัล" },
  { href: "/app/booking", label: "จองซิม" },
];

export function AppTabs({ unread, signedIn }: { unread: number; signedIn: boolean }) {
  const path = usePathname() ?? "";
  return (
    <nav className="app-tabs-wrap" aria-label="เมนูสมาชิก">
      <div className="app-tabs">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="app-tab" aria-current={path.startsWith(l.href) ? "page" : undefined}>
            {l.label}
          </Link>
        ))}
      </div>
      {signedIn && (
        <Link
          href="/app/inbox"
          className="inbox-link"
          aria-current={path.startsWith("/app/inbox") ? "page" : undefined}
          aria-label={unread ? `การแจ้งเตือน ${unread} รายการใหม่` : "การแจ้งเตือน"}
        >
          <IconBell size={20} />
          {unread > 0 && <span className="inbox-dot num">{unread > 9 ? "9+" : unread}</span>}
        </Link>
      )}
    </nav>
  );
}
