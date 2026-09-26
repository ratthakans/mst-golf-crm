import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/org";
import { publishedPosts } from "@/lib/posts";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const pages: MetadataRoute.Sitemap = [
    { url: `${origin}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/services`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${origin}/golf-simulator`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${origin}/blog`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${origin}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${origin}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
  let posts: Awaited<ReturnType<typeof publishedPosts>> = [];
  try {
    posts = await publishedPosts(500);
  } catch (e) {
    console.error("[sitemap] posts", e instanceof Error ? e.message : e);
  }
  return [
    ...pages,
    ...posts.map((p) => ({
      url: `${origin}/blog/${p.slug}`,
      lastModified: p.publishedAt ? new Date(p.publishedAt) : undefined,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
