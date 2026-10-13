import type { ReactNode } from "react";
import { SwingArc } from "@/components/SwingArc";

// The head of every public page.
// - `full` (a page with a photo): a full-width hero. The photo runs edge to
//   edge, the title sits on a solid CVI-green panel over its lower-left corner
//   (no gradient over the picture), and the Swing Arc sweeps across it.
// - otherwise: a large roman title, a lede and the page's actions on white.
export function SheetHead({
  full = false,
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
      {kicker && <p className={`sh-kicker${kickerSoon ? " soon" : ""}`}>{kicker}</p>}
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
        <div className="hero-media">
          {media}
          {/* CVI: the green Swing Arc over the photograph */}
          <SwingArc className="hero-arc" />
        </div>
        <div className="wrap hero-row">
          <div className="hero-panel">{copy}</div>
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
