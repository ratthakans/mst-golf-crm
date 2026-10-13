import Link from "next/link";
import type { ReactNode } from "react";

// One section head for the whole site: a small tracked label, the section
// title, and an optional "see all" link on the right. Every section uses it,
// so the page reads as one system.
export function SectionHead({ id, label, title, lede, link }: { id: string; label: string; title: ReactNode; lede?: ReactNode; link?: { href: string; text: string } }) {
  return (
    <div className="q-head">
      <div className="q-head-copy">
        <p className="q-label" lang="en">
          {label}
        </p>
        <h2 id={id} className="q-title">
          {title}
        </h2>
        {lede && <p className="q-lede">{lede}</p>}
      </div>
      {link && (
        <Link href={link.href} className="q-more">
          {link.text}
          <span aria-hidden="true"> →</span>
        </Link>
      )}
    </div>
  );
}
