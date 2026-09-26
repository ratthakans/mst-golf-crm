"use client";

import type { Liff } from "@line/liff";

// Browser helpers for the customer pages.

export type ApiResult<T> = { ok: true; data: T; serverDate: number | null } | { ok: false; status: number; code: string; error: string };

const OFFLINE = "เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";

/** fetch + JSON with the API's { error, code } contract; never throws. */
export async function api<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    return { ok: false, status: 0, code: "NETWORK", error: OFFLINE };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const b = (body ?? {}) as { error?: string; code?: string };
    return { ok: false, status: res.status, code: b.code ?? `HTTP_${res.status}`, error: b.error ?? "ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง" };
  }
  const date = res.headers.get("date");
  return { ok: true, data: body as T, serverDate: date ? Date.parse(date) : null };
}

let liffReady: Promise<Liff> | null = null;

/** Loads the LIFF SDK on demand (client only) and initialises it once per page. */
export function initLiff(liffId: string): Promise<Liff> {
  if (!liffReady) {
    liffReady = import("@line/liff")
      .then(async (m) => {
        const liff = m.default;
        await liff.init({ liffId });
        return liff;
      })
      .catch((e: unknown) => {
        liffReady = null;
        throw e;
      });
  }
  return liffReady;
}

/** LINE's in-app browser (LIFF) identifies itself in the user agent. */
export function looksLikeLineApp(): boolean {
  return typeof navigator !== "undefined" && /\bLine\//i.test(navigator.userAgent);
}

/** Drops the OAuth parameters LINE Login appends on the way back. */
export function cleanLoginParams(): void {
  const url = new URL(window.location.href);
  let changed = false;
  for (const k of ["code", "state", "liffClientId", "liffRedirectUri", "error", "error_description"]) {
    if (url.searchParams.has(k)) {
      url.searchParams.delete(k);
      changed = true;
    }
  }
  if (changed) window.history.replaceState(null, "", url);
}
