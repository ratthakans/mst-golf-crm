import type { NotificationKind } from "@mstgolf/shared";
import type { Prisma } from "@mstgolf/database";
import type { Tx } from "../db";

// Every LINE message the platform sends is first written to the Notification
// outbox inside the same transaction as the change that caused it. A sender
// (processOutbox) delivers them afterwards — so a failed push never rolls back
// a sale or a booking, and a retried request never sends the same message twice
// (dedupeKey is unique per org).

export interface OutboxItem {
  memberId: string;
  kind: NotificationKind;
  dedupeKey: string;
  payload: Record<string, unknown>;
}

export async function enqueue(tx: Tx, orgId: string, items: OutboxItem[]): Promise<void> {
  if (items.length === 0) return;
  for (let i = 0; i < items.length; i += 500) {
    await tx.notification.createMany({
      data: items.slice(i, i + 500).map((n) => ({
        orgId,
        memberId: n.memberId,
        kind: n.kind,
        dedupeKey: n.dedupeKey,
        payload: n.payload as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    });
  }
}
