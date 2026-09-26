"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

// A dialog rendered into <body> (a transformed ancestor would otherwise trap a
// fixed overlay). Escape and the backdrop close it.
export function Modal({
  title,
  sub,
  wide,
  onClose,
  children,
}: {
  title: string;
  sub?: string;
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {sub && <p>{sub}</p>}
          </div>
          <button type="button" className="link-dialog-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
