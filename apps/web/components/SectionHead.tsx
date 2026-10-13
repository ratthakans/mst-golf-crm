import Link from "next/link";
import type { ReactNode } from "react";

// One section head for the whole site: the title, an optional lede, and an
// optional "see all" link on the right. No eyebrow label above the title
// (13 Oct 2026): a tracked English label on every section read as a template.
// `label` is kept so call sites name their section, but it is not rendered.
export function SectionHead({ id, title, lede, link }: { id: string; label?: string; title: ReactNode; lede?: ReactNode; link?: { href: string; text: string } }) {
  return (
    <div className="q-head">
      <div className="q-head-copy">
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
