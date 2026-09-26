import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Vercel Cron (and our GitHub Actions fallback) send `Authorization: Bearer $CRON_SECRET`. */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}
