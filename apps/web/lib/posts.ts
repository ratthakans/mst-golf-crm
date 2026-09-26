import { listPosts } from "@mstgolf/core";
import type { PostItem } from "@/components/PostList";
import { getOrg } from "./org";

export async function publishedPosts(limit = 100): Promise<PostItem[]> {
  const org = await getOrg();
  const rows = await listPosts(org.id, { publishedOnly: true, limit });
  return rows.map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    coverUrl: p.coverUrl,
  }));
}
