import Link from "next/link";
import { formatThaiDate } from "@/lib/format";
import type { PromoItem } from "@/lib/posts";

// Promotions as a row of offers: picture, what it is, until when, one action.
export function PromoList({ promos }: { promos: PromoItem[] }) {
  return (
    <ul className="promo-list">
      {promos.map((p) => {
        const external = !!p.linkUrl && /^https:\/\//.test(p.linkUrl);
        return (
          <li key={p.slug} className="promo-item">
            {p.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- covers live in MST's public Blob store or /mock
              <img className="promo-cover" src={p.coverUrl} alt="" loading="lazy" width={480} height={270} />
            )}
            <div className="promo-text">
              <h3 className="promo-title">
                <Link href={`/promotions/${p.slug}`}>{p.title}</Link>
              </h3>
              {p.excerpt && <p className="promo-excerpt">{p.excerpt}</p>}
              <p className="promo-until">{p.endsAt ? `ถึง ${formatThaiDate(new Date(p.endsAt))}` : "ระยะเวลาจำกัด"}</p>
              <div className="promo-actions">
                {p.linkUrl &&
                  (external ? (
                    <a href={p.linkUrl} className="btn btn-primary btn-sm" target="_blank" rel="noopener">
                      {p.linkLabel || "ดูรายละเอียด"}
                    </a>
                  ) : (
                    <Link href={p.linkUrl} className="btn btn-primary btn-sm">
                      {p.linkLabel || "ดูรายละเอียด"}
                    </Link>
                  ))}
                <Link href={`/promotions/${p.slug}`} className="text-link">
                  {p.hasBody ? "รายละเอียดและเงื่อนไข" : "ดูโปรโมชัน"}
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
