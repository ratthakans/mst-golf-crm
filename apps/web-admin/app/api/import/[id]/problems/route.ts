import { NextResponse } from "next/server";
import { problemRowsCsv } from "@mstgolf/core";
import { requireApi } from "../../../../../lib/auth";
import { fail } from "../../../../../lib/api";
import { currentOrg } from "../../../../../lib/org";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireApi("import.run");
  if (user instanceof NextResponse) return user;
  try {
    const org = await currentOrg();
    const { fileName, csv } = await problemRowsCsv(org.id, params.id);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
