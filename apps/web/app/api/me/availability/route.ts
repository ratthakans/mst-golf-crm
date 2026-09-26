import type { NextRequest } from "next/server";
import { availability } from "@mstgolf/core";
import { ApiError, handle, json, requireMember } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET ?date=YYYY-MM-DD — the lane grid for one day. States only
// (free / taken / blocked / past); it never says who booked.
export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const { orgId } = await requireMember();
    const date = req.nextUrl.searchParams.get("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, "INVALID_INPUT", "วันที่ไม่ถูกต้อง");
    return json(await availability(orgId, date));
  });
}
