// Client-side fetch helper: JSON in, JSON out, the server's Thai error message on failure.

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly detail?: Record<string, unknown> | null,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
    headers: opts.form ? undefined : { "Content-Type": "application/json" },
    body: opts.form ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; code?: string; detail?: Record<string, unknown> | null };
    throw new ApiError(d.error ?? `เกิดข้อผิดพลาด (${res.status})`, res.status, d.code, d.detail);
  }
  return data as T;
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
