"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBell, IconCalendar, IconCard, IconGift } from "@/components/icons";

// Member navigation. Phones: a bottom bar within thumb reach (card · booking ·
// rewards · notifications). Wider screens: the same links as tabs in the header.

const LINKS = [
  { href: "/app/member", label: "บัตรสมาชิก", icon: IconCard },
  { href: "/app/booking", label: "จองซิม", icon: IconCalendar },
  { href: "/app/rewards", label: "รางวัล", icon: IconGift },
];

export function AppTabs({ unread, signedIn }: { unread: number; signedIn: boolean }) {
  const path = usePathname() ?? "";
  const here = (href: string) => (path.startsWith(href) ? "page" : undefined);
  const dot = unread > 0 && <span className="inbox-dot num">{unread > 9 ? "9+" : unread}</span>;
  const inboxLabel = unread ? `การแจ้งเตือน ${unread} รายการใหม่` : "การแจ้งเตือน";
  return (
    <>
      <nav className="app-tabs-wrap" aria-label="เมนูสมาชิก">
        <div className="app-tabs">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="app-tab" aria-current={here(l.href)}>
              {l.label}
            </Link>
          ))}
        </div>
        {signedIn && (
          <Link href="/app/inbox" className="inbox-link" aria-current={here("/app/inbox")} aria-label={inboxLabel}>
            <IconBell size={20} />
            {dot}
          </Link>
        )}
      </nav>
    </>
  );
}

/** The phone bottom bar. Rendered outside the sticky header: the header's
 *  backdrop-filter would otherwise become the bar's containing block. */
export function AppBar({ unread, signedIn }: { unread: number; signedIn: boolean }) {
  const path = usePathname() ?? "";
  const here = (href: string) => (path.startsWith(href) ? "page" : undefined);
  const dot = unread > 0 && <span className="inbox-dot num">{unread > 9 ? "9+" : unread}</span>;
  const inboxLabel = unread ? `การแจ้งเตือน ${unread} รายการใหม่` : "การแจ้งเตือน";
  return (
    <nav className="capp-bar" aria-label="เมนูสมาชิก">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="bar-item" aria-current={here(l.href)}>
          <l.icon size={22} />
          <span>{l.label}</span>
        </Link>
      ))}
      {signedIn && (
        <Link href="/app/inbox" className="bar-item" aria-current={here("/app/inbox")} aria-label={inboxLabel}>
          <span className="bar-icon">
            <IconBell size={22} />
            {dot}
          </span>
          <span aria-hidden="true">แจ้งเตือน</span>
        </Link>
      )}
    </nav>
  );
}
