// Where to send someone after signing in. Pure — no node imports.

/**
 * Only same-site paths. Browsers read "/\evil.com" and "/<tab>/evil.com" as
 * "//evil.com", so backslashes and control characters are refused outright,
 * and the result must still resolve to this origin.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return "/";
  if (/[\\\x00-\x1f\x7f]/.test(next)) return "/";
  const base = "https://same-site.invalid";
  try {
    const u = new URL(next, base);
    return u.origin === base ? u.pathname + u.search + u.hash : "/";
  } catch {
    return "/";
  }
}
