// Pages rendered without the back-office shell or ⌘K palette, and reachable
// without signing in.
const PUBLIC_PAGES = ["/register", "/login"];

export function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
