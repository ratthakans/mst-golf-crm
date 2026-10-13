"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconClose, IconMenu } from "./icons";
import { NAV } from "@/lib/nav";

// Desktop: the page links in the header row. Phone: a menu button that opens
// the same links full-screen (plus booking and membership).
export function SiteMenu({ shopUrl, store }: { shopUrl: string | null; store?: { name: string; address: string | null; hours: string[]; phone: string | null; mapsUrl: string | null } }) {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <>
      <nav className="site-nav" aria-label="เมนูหลัก">
        {NAV.filter((n) => n.href !== "/").map((n) => (
          <Link key={n.href} href={n.href} className="site-nav-link" aria-current={active(n.href) ? "page" : undefined}>
            {n.label}
          </Link>
        ))}
      </nav>
      <button type="button" className="menu-btn" aria-label="เปิดเมนู" aria-expanded={open} onClick={() => setOpen(true)}>
        <IconMenu size={24} />
      </button>
      {open && (
        <div className="menu-sheet" role="dialog" aria-modal="true" aria-label="เมนู">
          <div className="menu-sheet-head">
            <span className="menu-sheet-title">เมนู</span>
            <button type="button" className="menu-btn" aria-label="ปิดเมนู" onClick={() => setOpen(false)} autoFocus>
              <IconClose size={24} />
            </button>
          </div>
          <nav className="menu-sheet-links" aria-label="เมนูหลัก">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
            {shopUrl && (
              <a href={shopUrl} target="_blank" rel="noopener">
                ร้านออนไลน์ ↗
              </a>
            )}
          </nav>
          {store && (
            <div className="menu-sheet-info">
              <p className="menu-sheet-store">{store.name}</p>
              {store.address && <p>{store.address}</p>}
              {store.hours.map((h) => (
                <p key={h}>{h}</p>
              ))}
              <p className="menu-sheet-links-inline">
                {store.phone && <a href={`tel:${store.phone.replace(/[^\d+]/g, "")}`}>โทร {store.phone}</a>}
                {store.mapsUrl && (
                  <a href={store.mapsUrl} target="_blank" rel="noopener">
                    เปิดแผนที่ ↗
                  </a>
                )}
              </p>
            </div>
          )}
          <div className="menu-sheet-cta">
            <Link href="/app/booking" className="btn btn-primary btn-block">
              จองซิมกอล์ฟ
            </Link>
            <Link href="/app/member" className="btn btn-outline btn-block">
              บัตรสมาชิก · เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
