import type { UserRole } from "@mstgolf/database";

/** Who is acting: a staff user in the back office, a member in LINE/web, or the system (cron, import). */
export type Actor =
  | { kind: "staff"; userId: string; role: UserRole; ip?: string | null }
  | { kind: "member"; memberId: string }
  | { kind: "system" };

export const SYSTEM: Actor = { kind: "system" };

export function actorUserId(actor: Actor): string | null {
  return actor.kind === "staff" ? actor.userId : null;
}
