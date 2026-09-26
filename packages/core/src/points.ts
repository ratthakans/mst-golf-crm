import type { PointTxType, UserRole } from "@mstgolf/database";
import { writeAudit } from "./audit";
import type { Actor } from "./context";
import { db, inTx, type Tx } from "./db";
import { CoreError } from "./errors";
import type { ResolvedSettings } from "./settings";

// Points change only here. Every change is a PointTransaction row and the
// Member.points cache moves by the same delta inside the same transaction.

export interface PointEntry {
  memberId: string;
  type: PointTxType;
  delta: number;
  reason: PointReason;
  note?: string | null;
  saleId?: string | null;
  batchId?: string | null;
  createdById?: string | null;
}

export type PointReason =
  | "WELCOME"
  | "PURCHASE"
  | "BIRTHDAY"
  | "RETURN"
  | "VOID"
  | "ROLLBACK"
  | "ADJUST"
  | "MERGE_IN"
  | "MERGE_OUT"
  | "OPENING";

export const POINT_REASON_LABEL: Record<PointReason, string> = {
  WELCOME: "แต้มต้อนรับสมาชิกใหม่",
  PURCHASE: "ซื้อสินค้าที่ร้าน",
  BIRTHDAY: "โบนัสเดือนเกิด",
  RETURN: "คืนสินค้า",
  VOID: "ยกเลิกบิล",
  ROLLBACK: "ยกเลิกการนำเข้ายอด",
  ADJUST: "ปรับโดยพนักงาน",
  MERGE_IN: "รวมบัญชี",
  MERGE_OUT: "ย้ายไปบัญชีหลัก",
  OPENING: "แต้มยกมาจากระบบเดิม",
};

export async function postPoints(tx: Tx, orgId: string, e: PointEntry): Promise<void> {
  if (!Number.isInteger(e.delta)) throw new CoreError("INVALID_INPUT", "แต้มต้องเป็นจำนวนเต็ม");
  if (e.delta === 0) return;
  await tx.pointTransaction.create({
    data: {
      orgId,
      memberId: e.memberId,
      type: e.type,
      delta: e.delta,
      reason: e.reason,
      note: e.note ?? null,
      saleId: e.saleId ?? null,
      batchId: e.batchId ?? null,
      createdById: e.createdById ?? null,
    },
  });
  await tx.member.update({ where: { id: e.memberId }, data: { points: { increment: e.delta } } });
}

/** Base points for an amount: floor(baht × perBaht × tier rate). */
export function pointsForSatang(eligibleSatang: number, perBaht: number, rate: number): number {
  if (eligibleSatang <= 0) return 0;
  return Math.floor((eligibleSatang * perBaht * rate) / 100 + 1e-9);
}

/** Pays the welcome bonus once per member. Returns the points awarded (0 if already paid). */
export async function awardWelcome(tx: Tx, orgId: string, memberId: string, settings: ResolvedSettings): Promise<number> {
  if (settings.welcomeBonus <= 0) return 0;
  const paid = await tx.pointTransaction.findFirst({ where: { memberId, reason: "WELCOME" }, select: { id: true } });
  if (paid) return 0;
  await postPoints(tx, orgId, { memberId, type: "BONUS", delta: settings.welcomeBonus, reason: "WELCOME" });
  return settings.welcomeBonus;
}

/** Largest single adjustment each role may make; null = no limit, 0 = not allowed. */
export const ADJUST_LIMIT: Record<UserRole, number | null> = {
  SUPER_ADMIN: null,
  STORE_MANAGER: 1000,
  CUSTOMER_SERVICE: 1000,
  MARKETING: 0,
  STORE_STAFF: 0,
};

export async function adjustPoints(
  orgId: string,
  actor: Actor,
  input: { memberId: string; delta: number; note: string },
): Promise<{ points: number }> {
  if (actor.kind !== "staff") throw new CoreError("FORBIDDEN", "เฉพาะพนักงานเท่านั้น");
  const delta = Math.trunc(input.delta);
  const note = input.note.trim();
  if (!delta) throw new CoreError("INVALID_INPUT", "ใส่จำนวนแต้มที่ต้องการปรับ");
  if (!note) throw new CoreError("INVALID_INPUT", "ต้องใส่เหตุผลทุกครั้งที่ปรับแต้ม");
  const limit = ADJUST_LIMIT[actor.role];
  if (limit === 0) throw new CoreError("FORBIDDEN", "ตำแหน่งนี้ปรับแต้มไม่ได้");
  if (limit !== null && Math.abs(delta) > limit) {
    throw new CoreError("LIMIT_EXCEEDED", `ตำแหน่งนี้ปรับได้ครั้งละไม่เกิน ±${limit.toLocaleString("en-US")} แต้ม`);
  }
  return inTx(orgId, async (tx) => {
    const m = await tx.member.findFirst({ where: { id: input.memberId, status: "ACTIVE" } });
    if (!m) throw new CoreError("NOT_FOUND", "ไม่พบสมาชิก");
    await postPoints(tx, orgId, {
      memberId: m.id,
      type: "ADJUST",
      delta,
      reason: "ADJUST",
      note,
      createdById: actor.userId,
    });
    await writeAudit(tx, orgId, actor, {
      action: "points.adjust",
      entity: "member",
      entityId: m.id,
      before: { points: m.points },
      after: { points: m.points + delta },
      reason: note,
    });
    return { points: m.points + delta };
  });
}

export interface PointHistoryItem {
  id: string;
  at: Date;
  delta: number;
  reason: PointReason;
  label: string;
  note: string | null;
  invoiceNo: string | null;
  storeName: string | null;
}

export async function pointHistory(orgId: string, memberId: string, limit = 50): Promise<PointHistoryItem[]> {
  const rows = await db(orgId).pointTransaction.findMany({
    where: { memberId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { sale: { select: { invoiceNo: true, store: { select: { name: true } } } } },
  });
  return rows.map((r) => ({
    id: r.id,
    at: r.createdAt,
    delta: r.delta,
    reason: r.reason as PointReason,
    label: POINT_REASON_LABEL[r.reason as PointReason] ?? r.reason,
    note: r.note,
    invoiceNo: r.sale?.invoiceNo ?? null,
    storeName: r.sale?.store.name ?? null,
  }));
}

/** Ledger sum vs cache — used by tests and the nightly consistency check. */
export async function ledgerDrift(orgId: string): Promise<Array<{ memberId: string; cached: number; ledger: number }>> {
  const client = db(orgId);
  const sums = await client.pointTransaction.groupBy({ by: ["memberId"], _sum: { delta: true } });
  const members = await client.member.findMany({ select: { id: true, points: true } });
  const ledger = new Map(sums.map((s) => [s.memberId, s._sum.delta ?? 0]));
  return members
    .map((m) => ({ memberId: m.id, cached: m.points, ledger: ledger.get(m.id) ?? 0 }))
    .filter((d) => d.cached !== d.ledger);
}
