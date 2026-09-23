import { NextResponse } from "next/server";
import { audit, requireApi } from "../../../lib/auth";
import { getRepo, type ImportRow } from "../../../lib/repo";

export async function POST(req: Request) {
  const user = await requireApi("import.run");
  if (user instanceof NextResponse) return user;
  let body: { rows?: ImportRow[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }
  if (rows.length > 5000) {
    return NextResponse.json({ error: "Too many rows (max 5000)" }, { status: 400 });
  }
  const repo = await getRepo();
  const result = await repo.importPurchases(rows);
  await audit(user, { action: "import.run", entity: "import", after: result });
  return NextResponse.json({ ...result, source: repo.source }, { status: 200 });
}
