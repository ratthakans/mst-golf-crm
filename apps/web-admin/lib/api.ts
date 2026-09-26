import "server-only";
import { NextResponse } from "next/server";
import { CoreError, isCoreError } from "@mstgolf/core";

// Route handlers only parse input, check permission and call @mstgolf/core.
// This turns whatever core throws into a response the UI can show.

export function fail(e: unknown): NextResponse {
  if (isCoreError(e)) {
    return NextResponse.json({ error: e.message, code: e.code, detail: e.detail ?? null }, { status: e.status });
  }
  console.error("[api] unexpected error", e);
  return NextResponse.json({ error: "เกิดข้อผิดพลาด กรุณาลองใหม่" }, { status: 500 });
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const body = (await req.json()) as unknown;
    if (!body || typeof body !== "object") throw new Error();
    return body as T;
  } catch {
    throw new CoreError("INVALID_INPUT", "ข้อมูลที่ส่งมาไม่ถูกต้อง");
  }
}

export const str = (v: unknown): string => (typeof v === "string" ? v : "");
export const optStr = (v: unknown): string | null | undefined => (v === null ? null : typeof v === "string" ? v : undefined);
