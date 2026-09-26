import "server-only";
import { waitUntil } from "@vercel/functions";
import { processOutbox } from "@mstgolf/core";

/**
 * Delivers queued LINE messages right after the action that queued them,
 * without making staff wait. The 15-minute cron picks up anything left over.
 */
export function flushOutbox(): void {
  const run = processOutbox({ limit: 25 }).catch((e) => console.error("[outbox] flush failed", e));
  try {
    waitUntil(run);
  } catch {
    void run; // outside Vercel (local dev) the promise simply runs on
  }
}
