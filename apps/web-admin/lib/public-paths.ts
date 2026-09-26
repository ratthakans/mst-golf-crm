// Pages rendered without the back-office shell and reachable without signing in.
const PUBLIC_PAGES = ["/login"];

export function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
