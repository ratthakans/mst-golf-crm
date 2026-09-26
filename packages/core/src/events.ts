import type { EventType, Prisma } from "@mstgolf/database";
import type { Tx } from "./db";

export async function recordEvent(
  tx: Tx,
  orgId: string,
  memberId: string,
  type: EventType,
  payload: Record<string, unknown> = {},
  occurredAt: Date = new Date(),
): Promise<void> {
  await tx.event.create({
    data: { orgId, memberId, type, payload: payload as Prisma.InputJsonValue, occurredAt },
  });
}
