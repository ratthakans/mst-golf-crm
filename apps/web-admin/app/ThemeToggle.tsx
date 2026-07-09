"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

// Toggle between light/dark, persisted to localStorage. The initial attribute is
// set by an inline script in the layout (before paint) to avoid a flash, so here
// we just read the current state and flip it.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  const flip = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("mst-theme", next);
    } catch {
      /* ignore */
    }
  };

  return (
    <button className="theme-toggle" onClick={flip} aria-label="สลับโหมดสว่าง/มืด">
      <span className="tt-track">
        <span className="tt-thumb">{theme === "dark" ? "🌙" : "☀️"}</span>
      </span>
      <span className="tt-label">{theme === "dark" ? "โหมดมืด" : "โหมดสว่าง"}</span>
    </button>
  );
}
