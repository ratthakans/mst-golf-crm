import { NextResponse } from "next/server";
import { previewImport } from "@mstgolf/core";
import type { PosMapping } from "@mstgolf/shared";
import { actorOf, requireApi } from "../../../lib/auth";
import { fail } from "../../../lib/api";
import { currentOrg } from "../../../lib/org";

export const maxDuration = 60;

// Step 1 of a POS import: upload → preview (nothing is posted yet).
export async function POST(req: Request) {
  const user = await requireApi("import.run");
  if (user instanceof NextResponse) return user;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({ error: "เลือกไฟล์ CSV ก่อน" }, { status: 400 });
    const storeId = String(form.get("storeId") ?? "");
    const mode = form.get("mode") === "HISTORY" ? "HISTORY" : "DAILY";
    let mapping: PosMapping | undefined;
    const rawMapping = form.get("mapping");
    if (typeof rawMapping === "string" && rawMapping) mapping = JSON.parse(rawMapping) as PosMapping;
    const org = await currentOrg();
    const preview = await previewImport(org.id, actorOf(user), {
      storeId,
      fileName: (file as File).name || "pos.csv",
      bytes: new Uint8Array(await file.arrayBuffer()),
      mode,
      mapping,
    });
    return NextResponse.json(preview);
  } catch (e) {
    return fail(e);
  }
}
