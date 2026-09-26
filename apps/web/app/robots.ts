import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/org";

export const revalidate = 300;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app/", "/api/"] }],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
