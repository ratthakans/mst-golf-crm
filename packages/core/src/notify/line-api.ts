import { createHash } from "node:crypto";

// Thin client for the two LINE endpoints the platform uses. No SDK: fetch is
// enough and keeps the core free of framework dependencies.

export interface LineMessage {
  type: string;
  [key: string]: unknown;
}

export type PushResult =
  | { ok: true }
  | { ok: false; retry: boolean; unreachable: boolean; status: number; error: string };

/** LINE wants X-Line-Retry-Key as a UUID; derive a stable one from our id. */
export function retryKeyFor(id: string): string {
  const h = createHash("sha256").update(id).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export async function pushMessage(
  accessToken: string,
  to: string,
  messages: LineMessage[],
  retryKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PushResult> {
  let res: Response;
  try {
    res = await fetchImpl("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Line-Retry-Key": retryKey,
      },
      body: JSON.stringify({ to, messages }),
    });
  } catch (e) {
    return { ok: false, retry: true, unreachable: false, status: 0, error: String(e) };
  }
  // 409 = this retry key was already accepted: the message went out earlier.
  if (res.ok || res.status === 409) return { ok: true };
  const body = await res.text().catch(() => "");
  const retry = res.status === 429 || res.status >= 500;
  // A user who blocked the OA (or never added it) cannot receive pushes.
  const unreachable = res.status === 400 && /friend|block|not found|invalid.*user/i.test(body);
  return { ok: false, retry, unreachable, status: res.status, error: body.slice(0, 500) || `HTTP ${res.status}` };
}

export interface LineProfileFromToken {
  sub: string; // LINE user id
  name?: string;
  picture?: string;
  email?: string;
}

/**
 * Verifies a LIFF / LINE Login ID token with LINE and returns the user.
 * `clientId` is the LINE Login channel id the token was issued for.
 */
export async function verifyIdToken(
  idToken: string,
  clientId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LineProfileFromToken | null> {
  const res = await fetchImpl("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: clientId }).toString(),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Partial<LineProfileFromToken> & { aud?: string; exp?: number };
  if (!data.sub || (data.aud && data.aud !== clientId)) return null;
  if (data.exp && data.exp * 1000 < Date.now()) return null;
  return { sub: data.sub, name: data.name, picture: data.picture, email: data.email };
}

/** Messaging API quota used this month (null when LINE is not configured or unreachable). */
export async function quotaConsumption(accessToken: string, fetchImpl: typeof fetch = fetch): Promise<number | null> {
  try {
    const res = await fetchImpl("https://api.line.me/v2/bot/message/quota/consumption", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { totalUsage?: number };
    return typeof data.totalUsage === "number" ? data.totalUsage : null;
  } catch {
    return null;
  }
}
