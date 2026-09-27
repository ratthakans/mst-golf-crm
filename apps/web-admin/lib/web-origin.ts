// Where the public website lives, for previews and "open on the website" links
// in the back office. Relative photo paths (/mock/…) are files of the website.
export function webOrigin(siteUrl: string | undefined | null): string | null {
  const raw = siteUrl || process.env.WEB_ORIGIN || (process.env.NODE_ENV !== "production" ? "http://localhost:3200" : null);
  return raw ? raw.replace(/\/$/, "") : null;
}

export function webAsset(src: string, origin: string | null): string {
  return src.startsWith("/") && origin ? `${origin}${src}` : src;
}
