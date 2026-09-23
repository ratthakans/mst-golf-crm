// Customer-facing pages rendered without the back-office shell or ⌘K palette.
export function isPublicPath(pathname: string | null): boolean {
  return pathname === "/register" || (pathname?.startsWith("/register/") ?? false);
}
