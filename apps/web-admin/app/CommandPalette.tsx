"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface MemberHit {
  id: string;
  name: string;
  tier: string;
  points: number;
}

const PAGES: Array<{ label: string; href: string; icon: string; hint: string }> = [
  { label: "ภาพรวม", href: "/", icon: "📊", hint: "Overview" },
  { label: "แผนลงมือ", href: "/playbook", icon: "🎬", hint: "Playbook" },
  { label: "วิเคราะห์ข้อมูล", href: "/analytics", icon: "📈", hint: "Analytics" },
  { label: "สัญญาณ & การเคลื่อนไหว", href: "/insights", icon: "🧠", hint: "Insights" },
  { label: "เชิงลึกเชิงปฏิบัติการ", href: "/operations", icon: "🔎", hint: "Operations" },
  { label: "สมาชิก", href: "/members", icon: "👥", hint: "Members" },
  { label: "กลุ่มลูกค้า", href: "/segments", icon: "🎯", hint: "Segments" },
  { label: "ใบเสนอราคา & ROI", href: "/quote", icon: "💰", hint: "Quote ROI" },
  { label: "ระบบอัตโนมัติ", href: "/automations", icon: "⚡", hint: "Automations" },
  { label: "ข้อมูลดิบ", href: "/raw", icon: "🧾", hint: "Raw events" },
  { label: "นำเข้า POS", href: "/import", icon: "📥", hint: "Import" },
  { label: "ฟอร์มสมัคร", href: "/join", icon: "📝", hint: "Sign-up" },
  { label: "โครงสร้างข้อมูล", href: "/data-model", icon: "🗄️", hint: "Data model" },
];

const norm = (s: string) => s.toLowerCase().replace(/[\s-]/g, "");

export function CommandPalette() {
  const router = useRouter();
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

  // Lazy-load the member index the first time the palette opens.
  useEffect(() => {
    if (open && members === null) {
      fetch("/api/members")
        .then((r) => r.json())
        .then((d) => setMembers(d.members ?? []))
        .catch(() => setMembers([]));
    }
    if (open) {
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      setQ("");
    }
  }, [open, members]);

  const results = useMemo(() => {
    const nq = norm(q);
    const pages = PAGES.filter((p) => !nq || norm(p.label).includes(nq) || norm(p.hint).includes(nq)).map(
      (p) => ({ kind: "page" as const, ...p }),
    );
    const mem = !nq
      ? []
      : (members ?? [])
          .filter((m) => norm(m.name).includes(nq) || m.id.includes(nq))
          .slice(0, 8)
          .map((m) => ({ kind: "member" as const, ...m }));
    return [...pages.slice(0, nq ? 4 : PAGES.length), ...mem];
  }, [q, members]);

  useEffect(() => {
    if (active >= results.length) setActive(0);
  }, [results.length, active]);

  const go = (r: (typeof results)[number]) => {
    setOpen(false);
    if (r.kind === "page") router.push(r.href);
    else router.push(`/members/${r.id}`);
  };

  if (!open) return null;

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
