import { NextResponse } from "next/server";
import { audit, requireApi } from "../../../../../lib/auth";
import { getRepo } from "../../../../../lib/repo";
import type { PurchaseItemLike } from "@mstgolf/analytics";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await requireApi("sales.record");
  if (user instanceof NextResponse) return user;
  let body: { amount?: number; channel?: string; items?: PurchaseItemLike[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  const repo = await getRepo();
  try {
    const result = await repo.createPurchase({
      memberId: params.id,
      amount,
      channel: body.channel,
      items: body.items,
    });
    await audit(user, {
      action: "sale.record", entity: "member", entityId: params.id,
      after: { amount, pointsAwarded: result.pointsAwarded, tier: result.newTier },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to record purchase" },
      { status: 400 },
    );
  }
}
