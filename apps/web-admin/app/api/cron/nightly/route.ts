import { NextResponse } from "next/server";
import { runNightlyAll } from "@mstgolf/core";
import { cronAuthorized } from "../../../../lib/cron";

export const maxDuration = 300;

// 02:00 Bangkok (19:00 UTC) — see vercel.json.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Each org's run is recorded on that org (runNightlyAll); a failed org shows as failed in its status page.
  const reports = await runNightlyAll();
  console.log("[cron] nightly", JSON.stringify(reports));
  const failed = reports.filter((r) => "error" in r).length;
  return NextResponse.json({ reports }, { status: failed ? 500 : 200 });
}
