import { NextResponse, type NextRequest } from "next/server";
import { findMemberByLine, isCoreError, processEmails, processOutbox, type MemberSummary } from "@mstgolf/core";
import { waitUntil } from "@vercel/functions";
import { getOrg } from "./org";
import { currentLineUser, type LineUser } from "./session";

// Customer API plumbing. Route handlers only parse input and call
// @mstgolf/core; every rule lives in the core and fails with a CoreError whose
// Thai message is safe to show the customer.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const GENERIC = "ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function handle(req: NextRequest, fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") assertSameOrigin(req);
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) return json({ error: e.message, code: e.code }, e.status);
    if (isCoreError(e)) return json({ error: e.message, code: e.code }, e.status);
    console.error(`[api] ${req.method} ${req.nextUrl.pathname}`, e instanceof Error ? e.message : e);
    return json({ error: GENERIC, code: "INTERNAL" }, 500);
  }
}

/** The session cookie is SameSite=Lax; a mismatched Origin on a write is refused as well. */
function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return; // curl, server-to-server — the cookie is still required
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = null;
  }
  if (!host || originHost !== host) throw new ApiError(403, "FORBIDDEN", "คำขอไม่ถูกต้อง");
}

export async function readJson<T extends object>(req: NextRequest): Promise<Partial<T>> {
  try {
    const body: unknown = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Partial<T>) : {};
  } catch {
    return {};
  }
}

export async function requireLineUser(): Promise<LineUser> {
  const user = await currentLineUser();
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบด้วย LINE");
  return user;
}

/** The org, the signed-in LINE user and their member record — or 401 / 403 NOT_MEMBER. */
export async function requireMember(): Promise<{ orgId: string; user: LineUser; member: MemberSummary }> {
  const user = await requireLineUser();
  const org = await getOrg();
  const member = await findMemberByLine(org.id, user.sub);
  if (!member) throw new ApiError(403, "NOT_MEMBER", "กรุณาสมัครสมาชิกก่อน");
  return { orgId: org.id, user, member };
}

/** LINE's in-app browser identifies itself in the user agent. */
export function isLineClient(req: NextRequest): boolean {
  return /\bLine\//i.test(req.headers.get("user-agent") ?? "");
}

/**
 * Delivers queued LINE messages after a mutation without delaying the response.
 * On Vercel waitUntil keeps the function alive; locally the promise just runs.
 */
export function kickOutbox(): void {
  const run = Promise.all([processOutbox({ limit: 20 }), processEmails({ limit: 10 })]).catch((e: unknown) => {
    console.error("[outbox]", e instanceof Error ? e.message : e);
  });
  try {
    waitUntil(run);
  } catch {
    void run;
  }
}

export function str(v: unknown, max = 200): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}
