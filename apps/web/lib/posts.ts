import { activePromotions, listPosts } from "@mstgolf/core";
import type { PostItem } from "@/components/PostList";
import { getOrg } from "./org";

export async function publishedPosts(limit = 100): Promise<PostItem[]> {
  const org = await getOrg();
  const rows = await listPosts(org.id, { publishedOnly: true, excludeCategory: "PROMOTION", limit });
  return rows.map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    coverUrl: p.coverUrl,
  }));
}

export interface PromoItem {
  slug: string;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  endsAt: string | null; // last day, ISO
  linkUrl: string | null;
  linkLabel: string | null;
  hasBody: boolean;
}

/** Promotions running now (published and inside their dates). */
export async function currentPromotions(limit = 12): Promise<PromoItem[]> {
  const org = await getOrg();
  const rows = await activePromotions(org.id, new Date(), limit);
  return rows.map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    coverUrl: p.coverUrl,
    endsAt: p.endsAt ? new Date(p.endsAt.getTime() - 1).toISOString() : null,
    linkUrl: p.linkUrl,
    linkLabel: p.linkLabel,
    hasBody: p.body.trim().length > 0,
  }));
}
