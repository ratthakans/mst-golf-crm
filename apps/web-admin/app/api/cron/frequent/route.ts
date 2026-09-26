import { NextResponse } from "next/server";
import { runFrequent } from "@mstgolf/core";
import { cronAuthorized } from "../../../../lib/cron";

export const maxDuration = 60;

// Every 15 minutes: booking reminders + LINE outbox.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await runFrequent();
  if (result.reminders || result.outbox.sent || result.outbox.failed) console.log("[cron] frequent", JSON.stringify(result));
  return NextResponse.json(result);
}
