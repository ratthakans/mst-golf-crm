import { formatThaiDate } from "@/lib/format";
import type { PromoItem } from "@/lib/posts";

// How a promotion's end is said on the site, the way a shelf tag says it.

export const daysLeft = (iso: string | null, now: Date): number | null =>
  iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000)) : null;

/** "ถึง 31 ต.ค. 2026", or the countdown once it is a week away. */
export function untilText(endsAt: string | null, now: Date): string {
  const left = daysLeft(endsAt, now);
  if (left === null) return "ไม่มีกำหนดสิ้นสุด";
  if (left === 0) return "วันสุดท้าย";
  if (left <= 7) return `เหลืออีก ${left} วัน`;
  return `ถึง ${formatThaiDate(new Date(endsAt!))}`;
}

/** Three days or less: the date turns red. */
export const endsSoon = (endsAt: string | null, now: Date): boolean => (daysLeft(endsAt, now) ?? 99) <= 3;

/** Where the promotion's button goes: its own link, or its page. */
export function promoHref(p: Pick<PromoItem, "linkUrl" | "slug">): { href: string; external: boolean } {
  if (p.linkUrl) return { href: p.linkUrl, external: /^https:\/\//.test(p.linkUrl) };
  return { href: `/promotions/${p.slug}`, external: false };
}
