"use client";

// Sidebar launcher for the ⌘K command palette (also shows the shortcut).
export function CommandHint() {
  return (
    <button
      className="cmd-hint"
      onClick={() => window.dispatchEvent(new Event("open-cmdk"))}
      aria-label="เปิดค้นหา"
    >
      <span className="cmd-hint-ic">⌕</span>
      <span>ค้นหา…</span>
      <kbd className="cmd-hint-kbd">⌘K</kbd>
    </button>
  );
}
