import Link from "next/link";
import type { ReactNode } from "react";
import { SwingArc } from "@/components/SwingArc";

// The head of every public page, set like the top of a printed sheet: a line
// of where-you-are and one live fact over a 1 px ink rule, then the title.
// The home page uses the same head for its lead promotion (design.md).
export function SheetHead({
  crumb,
  place,
  fact,
  kicker,
  kickerSoon = false,
  title,
  titleAs = "h1",
  titleId,
  lede,
  actions,
  aside,
}: {
  /** Page name after "MST Golf /". `null` on the home page, which shows `place` instead. */
  crumb?: string | { text: string; href: string } | null;
  place?: ReactNode;
  fact?: ReactNode;
  kicker?: ReactNode;
  kickerSoon?: boolean;
  title: ReactNode;
  titleAs?: "h1" | "h2";
  titleId?: string;
  lede?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  const Title = titleAs;
  return (
    <section className="sh" aria-labelledby={titleId}>
      <div className="wrap">
        <p className="sh-meta">
          <span className="sh-crumb">
            {crumb === null ? place : (
              <>
                <Link href="/">MST Golf</Link>
                {crumb && (
                  <>
                    <span aria-hidden="true"> / </span>
                    {typeof crumb === "string" ? <span>{crumb}</span> : <Link href={crumb.href}>{crumb.text}</Link>}
                  </>
                )}
              </>
            )}
          </span>
          {fact && <span className="sh-fact">{fact}</span>}
        </p>
        <div className={`sh-grid${aside ? " has-aside" : ""}`}>
          <div className="sh-copy">
            {kicker && <p className={`sh-kicker${kickerSoon ? " soon" : ""}`}>{kicker}</p>}
            <Title id={titleId} className="sh-title">
              {title}
            </Title>
            {lede && <p className="sh-lede">{lede}</p>}
            {actions && <div className="sh-actions">{actions}</div>}
          </div>
          {aside && (
            <div className="sh-aside">
              {aside}
              {/* CVI: the green Swing Arc laid over the photograph's corner */}
              <SwingArc className="sh-arc" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
