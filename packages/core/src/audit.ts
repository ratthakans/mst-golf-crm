import type { Prisma } from "@mstgolf/database";
import type { Actor } from "./context";
import type { Tx } from "./db";

export interface AuditEntry {
  action: string; // "member.update", "points.adjust", "booking.check_in" …
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

const json = (v: unknown) => (v === undefined ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue));

/** Records a staff or system action. Member self-service is recorded as Events instead. */
export async function writeAudit(tx: Tx, orgId: string, actor: Actor, e: AuditEntry): Promise<void> {
  if (actor.kind === "member") return;
  await tx.auditLog.create({
    data: {
      orgId,
      userId: actor.kind === "staff" ? actor.userId : null,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId ?? null,
      before: json(e.before),
      after: json(e.after),
      reason: e.reason ?? null,
      ip: actor.kind === "staff" ? actor.ip ?? null : null,
    },
  });
}
