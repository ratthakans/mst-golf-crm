// The Swing Arc from the MST Golf CVI — the curve in the logo and the favicon,
// used on its own as the site's one decorative mark (design.md). Colour comes
// from `currentColor`, so the arc takes the CVI green from its parent.
export function SwingArc({ className = "", title }: { className?: string; title?: string }) {
  return (
    <svg className={`swing-arc ${className}`} viewBox="8 19.6 50 22.4" aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path fill="currentColor" d="M9 42c9-12 24-21 39-22 7-.4 11 2.2 9.6 7.4-.7 2.7-3 5.2-6.4 7.4 1.6-2.4 1.9-4.6.2-6-2-1.7-6.4-1.9-12-1.1C28 29.3 17.7 34 9 42z" />
    </svg>
  );
}
