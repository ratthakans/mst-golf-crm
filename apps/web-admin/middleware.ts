import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "./lib/public-paths";
import { SESSION_COOKIE, verifySession } from "./lib/session-token";

// Everything in the back office requires a signed-in staff member. Open: the
// login page and its endpoints, and the cron routes (they check CRON_SECRET).
const PUBLIC_API: Array<[method: string, path: string]> = [
  ["POST", "/api/auth/login"],
  ["POST", "/api/auth/logout"],
];

const PASSWORD_PAGE = "/account/password";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();
  if (PUBLIC_API.some(([m, p]) => req.method === m && pathname === p)) return NextResponse.next();
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");
  const claims = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!claims) {
    if (isApi) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // A temporary password must be replaced before anything else.
  if (claims.mustChangePassword && pathname !== PASSWORD_PAGE && pathname !== "/api/account/password") {
    if (isApi) return NextResponse.json({ error: "กรุณาเปลี่ยนรหัสผ่านก่อน" }, { status: 403 });
    const url = req.nextUrl.clone();
    url.pathname = PASSWORD_PAGE;
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|mst-logo.png|fonts/).*)"],
};
