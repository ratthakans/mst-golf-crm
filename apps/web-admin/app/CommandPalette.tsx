"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isPublicPath } from "../lib/public-paths";
import type { Permission } from "../lib/permissions";

interface MemberHit {
  id: string;
  code: string;
  name: string;
  tier: string;
  points: number;
}

const ALL_PAGES: Array<{ label: string; href: string; icon: string; hint: string; perm: Permission }> = [
  { label: "ภาพรวม", href: "/", icon: "📊", hint: "Dashboard", perm: "dashboard.view" },
  { label: "สมาชิก", href: "/members", icon: "👥", hint: "Members", perm: "members.view" },
  { label: "เพิ่มสมาชิก", href: "/members/new", icon: "➕", hint: "New member", perm: "members.create" },
  { label: "นำเข้า POS", href: "/import", icon: "📥", hint: "Import", perm: "import.run" },
  { label: "ซิมกอล์ฟ", href: "/simulator", icon: "⛳", hint: "Simulator booking", perm: "booking.view" },
  { label: "คิวตรวจสอบ", href: "/reviews", icon: "🗂", hint: "Review queue", perm: "reviews.request" },
  { label: "บทความเว็บไซต์", href: "/website", icon: "📝", hint: "Website posts", perm: "posts.manage" },
  { label: "ตั้งค่า", href: "/settings", icon: "⚙️", hint: "Settings", perm: "settings.manage" },
  { label: "ผู้ใช้และสิทธิ์", href: "/settings/users", icon: "🔑", hint: "Users", perm: "users.manage" },
  { label: "บันทึกการใช้งาน", href: "/settings/audit", icon: "🧾", hint: "Audit log", perm: "audit.view" },
  { label: "แผนลงมือ", href: "/playbook", icon: "🎬", hint: "Playbook", perm: "playbook.view" },
  { label: "กลุ่มลูกค้า", href: "/segments", icon: "🎯", hint: "Segments", perm: "segments.view" },
];

const norm = (s: string) => s.toLowerCase().replace(/[\s-]/g, "");

export function CommandPalette({ permissions }: { permissions: Permission[] }) {
  const permKey = permissions.join(",");
  const PAGES = useMemo(() => ALL_PAGES.filter((p) => permKey.split(",").includes(p.perm)), [permKey]);
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [members, setMembers] = useState<MemberHit[] | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl-K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-cmdk", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-cmdk", onOpen);
    };
  }, []);

  // Members are searched on the server as you type (name, phone or code).
  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2 || !permKey.split(",").includes("members.view")) {
      setMembers(term.length < 2 ? [] : null);
      return;
    }
    setMembers(null);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/members/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d) => setMembers(d.rows ?? []))
        .catch(() => undefined);
    }, 200);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, open, permKey]);

  useEffect(() => {
    if (open) {
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      setQ("");
    }
  }, [open]);

  const results = useMemo(() => {
    const nq = norm(q);
    const pages = PAGES.filter((p) => !nq || norm(p.label).includes(nq) || norm(p.hint).includes(nq)).map(
      (p) => ({ kind: "page" as const, ...p }),
    );
    const mem = !nq
      ? []
      : (members ?? []).slice(0, 8).map((m) => ({ kind: "member" as const, ...m }));
    return [...pages.slice(0, nq ? 4 : PAGES.length), ...mem];
  }, [q, members, PAGES]);

  useEffect(() => {
    if (active >= results.length) setActive(0);
  }, [results.length, active]);

  const go = (r: (typeof results)[number]) => {
    setOpen(false);
    if (r.kind === "page") router.push(r.href);
    else router.push(`/members/${r.id}`);
  };

  if (!open || isPublicPath(pathname)) return null;

  return (
    <div className="cmdk-overlay" onMouseDown={() => setOpen(false)}>
      <div className="cmdk" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmdk-input-wrap">
          <span className="cmdk-search-icon">⌕</span>
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="ค้นหาหน้า หรือ ชื่อ/เบอร์สมาชิก…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter" && results[active]) { e.preventDefault(); go(results[active]!); }
            }}
          />
          <kbd className="cmdk-esc">esc</kbd>
        </div>
        <div className="cmdk-list">
          {results.length === 0 && (
            <div className="cmdk-empty">
              {members === null ? "กำลังโหลด…" : "ไม่พบผลลัพธ์"}
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={r.kind === "page" ? r.href : r.id}
              className={`cmdk-item${i === active ? " active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r)}
            >
              <span className="cmdk-ic">{r.kind === "page" ? r.icon : "👤"}</span>
              <span className="cmdk-label">{r.kind === "page" ? r.label : r.name}</span>
              <span className="cmdk-meta">
                {r.kind === "page" ? r.hint : `${r.tier} · ${r.points.toLocaleString("en-TH")} แต้ม`}
              </span>
            </button>
          ))}
        </div>
        <div className="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> เลื่อน</span>
          <span><kbd>↵</kbd> เปิด</span>
          <span><kbd>⌘</kbd><kbd>K</kbd> สลับ</span>
        </div>
      </div>
    </div>
  );
}
