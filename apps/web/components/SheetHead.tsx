import type { ReactNode } from "react";

// The head of every public page.
// - `full` (a page with a photo): a full-bleed hero — the photo edge to edge
//   under an even dark veil, white type set low on the left, one light button.
// - otherwise: a small tracked label, a large title and a lede on white.
export function SheetHead({
  full = false,
  label,
  kicker,
  kickerSoon = false,
  title,
  titleAs = "h1",
  titleId,
  lede,
  actions,
  media,
}: {
  full?: boolean;
  /** Small tracked English label above the title ("Promotion", "Services"). */
  label?: string;
  kicker?: ReactNode;
  kickerSoon?: boolean;
  title: ReactNode;
  titleAs?: "h1" | "h2";
  titleId?: string;
  lede?: ReactNode;
  actions?: ReactNode;
  /** The photo for a `full` hero: an <img> or <Photo>, stretched to cover. */
  media?: ReactNode;
}) {
  const Title = titleAs;
  const copy = (
    <>
      {/* the tracked label only over a photo hero; plain heads start with the title */}
      {((full && label) || kicker) && (
        <p className="sh-label">
          {full && label && <span lang="en">{label}</span>}
          {kicker && <span className={`sh-kicker${kickerSoon ? " soon" : ""}`}>{kicker}</span>}
        </p>
      )}
      <Title id={titleId} className="sh-title">
        {title}
      </Title>
      {lede && <p className="sh-lede">{lede}</p>}
      {actions && <div className="sh-actions">{actions}</div>}
    </>
  );

  if (full && media) {
    return (
      <section className="hero" aria-labelledby={titleId}>
        <div className="hero-media">{media}</div>
        <div className="wrap hero-row">
          <div className="hero-copy">{copy}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="sh" aria-labelledby={titleId}>
      <div className="wrap">
        <div className="sh-copy">{copy}</div>
      </div>
    </section>
  );
}
