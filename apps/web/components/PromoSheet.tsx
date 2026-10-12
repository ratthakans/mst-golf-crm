import Link from "next/link";
import { endsSoon, promoHref, untilText } from "@/lib/promo";
import type { PromoItem } from "@/lib/posts";

// Running promotions as a ruled list, end date on the right — the same list on
// the home page (compact: the whole row is a link) and on /promotions (full:
// bigger picture, the promotion's own button, and a link to its conditions).
export function PromoSheet({ promos, now, full = false, label }: { promos: PromoItem[]; now: Date; full?: boolean; label: string }) {
  return (
    <ol className={`ps${full ? " ps-full" : ""}`} aria-label={label}>
      {promos.map((p) => {
        const until = (
          <span className={`ps-until${endsSoon(p.endsAt, now) ? " soon" : ""}`}>{untilText(p.endsAt, now)}</span>
        );
        const thumb = (
          <span className="ps-thumb" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- promotion covers come from MST's uploads */}
            {p.coverUrl ? <img src={p.coverUrl} alt="" loading="lazy" /> : null}
          </span>
        );
        if (!full) {
          return (
            <li key={p.slug}>
              <Link href={`/promotions/${p.slug}`} className="ps-row">
                {thumb}
                <span className="ps-main">
                  <span className="ps-title">{p.title}</span>
                  {p.excerpt && <span className="ps-text">{p.excerpt}</span>}
                </span>
                {until}
              </Link>
            </li>
          );
        }
        const cta = promoHref(p);
        return (
          <li key={p.slug} className="ps-row">
            <Link href={`/promotions/${p.slug}`} className="ps-thumb-link" tabIndex={-1} aria-hidden="true">
              {thumb}
            </Link>
            <span className="ps-main">
              <h2 className="ps-title">
                <Link href={`/promotions/${p.slug}`}>{p.title}</Link>
              </h2>
              {p.excerpt && <span className="ps-text">{p.excerpt}</span>}
              <span className="ps-actions">
                {p.linkUrl &&
                  (cta.external ? (
                    <a href={cta.href} className="btn btn-primary btn-sm" target="_blank" rel="noopener">
                      {p.linkLabel || "ดูรายละเอียด"}
                    </a>
                  ) : (
                    <Link href={cta.href} className="btn btn-primary btn-sm">
                      {p.linkLabel || "ดูรายละเอียด"}
                    </Link>
                  ))}
                <Link href={`/promotions/${p.slug}`} className="text-link">
                  {p.hasBody ? "รายละเอียดและเงื่อนไข" : "ดูโปรโมชัน"}
                </Link>
              </span>
            </span>
            {until}
          </li>
        );
      })}
    </ol>
  );
}
