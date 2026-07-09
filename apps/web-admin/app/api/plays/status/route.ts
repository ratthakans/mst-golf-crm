import { NextResponse } from "next/server";
import { setTask, type TaskStatus } from "../../../../lib/tasks";

const VALID: TaskStatus[] = ["pending", "contacted", "won", "lost"];

export async function POST(req: Request) {
  let body: { id?: string; status?: string; recovered?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = (body.id ?? "").trim();
  const status = body.status as TaskStatus;
  if (!id || !VALID.includes(status)) {
    return NextResponse.json({ error: "Invalid id or status" }, { status: 400 });
  }
  const task = setTask(id, status, Number(body.recovered) || 0);
  return NextResponse.json({ id, ...task }, { status: 200 });
}
