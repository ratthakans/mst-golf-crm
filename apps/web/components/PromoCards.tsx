import Link from "next/link";
import { endsSoon, untilText } from "@/lib/promo";
import type { PromoItem } from "@/lib/posts";

// Promotions as photo cards, the whole card a link to the promotion. The
// layout follows the count: one wide card, two halves, or (home) one large
// card with two stacked beside it; the full list falls into columns.
export function PromoCards({ promos, now, list = false, label }: { promos: PromoItem[]; now: Date; list?: boolean; label: string }) {
  const layout = list && promos.length > 3 ? "many" : String(Math.min(promos.length, 3));
  return (
    <ul className={`n-promos n-promos-${layout}${list ? " n-promos-list" : ""}`} aria-label={label}>
      {promos.map((p) => (
        <li key={p.slug}>
          <Link href={`/promotions/${p.slug}`} className="n-promo">
            <span className="n-promo-img">
              {/* eslint-disable-next-line @next/next/no-img-element -- promotion covers come from MST's uploads */}
              {p.coverUrl ? <img src={p.coverUrl} alt="" loading="lazy" /> : null}
            </span>
            <span className="n-promo-copy">
              <span className={`n-promo-until${endsSoon(p.endsAt, now) ? " soon" : ""}`}>{untilText(p.endsAt, now)}</span>
              <span className="n-promo-title">{p.title}</span>
              {p.excerpt && <span className="n-promo-text">{p.excerpt}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
