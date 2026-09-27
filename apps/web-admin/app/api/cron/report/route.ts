import { NextResponse } from "next/server";
import { recordJobRun } from "@mstgolf/core";
import { cronAuthorized } from "../../../../lib/cron";

// Jobs that run outside this app report here when they finish, so Settings ›
// สถานะระบบ can show them. Today: the nightly backup (.github/workflows/backup.yml).
export async function POST(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const job = new URL(req.url).searchParams.get("job");
  if (job !== "backup") return NextResponse.json({ error: "unknown job" }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as { ok?: boolean; startedAt?: string; file?: string; bytes?: number; error?: string };
  const startedAt = b.startedAt && !Number.isNaN(Date.parse(b.startedAt)) ? new Date(b.startedAt) : new Date();
  await recordJobRun("backup", {
    startedAt,
    ok: b.ok === true,
    detail: { file: typeof b.file === "string" ? b.file.slice(0, 120) : null, bytes: Number(b.bytes) || null },
    error: b.ok === true ? null : String(b.error ?? "backup failed").slice(0, 300),
  });
  return NextResponse.json({ ok: true });
}
