import { forOrg, table, type Prisma } from "@mstgolf/database";

// Every core query goes through forOrg(orgId): reads are constrained to the
// tenant and creates are stamped with it. Unique lookups (findUnique/update by
// id) are NOT scoped by the extension, so core code looks rows up with
// findFirst first and only then updates them by id.

export type Tx = Prisma.TransactionClient;

export function db(orgId: string): Tx {
  return forOrg(orgId) as unknown as Tx;
}

export async function inTx<T>(orgId: string, fn: (tx: Tx) => Promise<T>, opts: { timeout?: number } = {}): Promise<T> {
  return forOrg(orgId).$transaction((tx) => fn(tx as unknown as Tx), {
    maxWait: 10_000,
    timeout: opts.timeout ?? 20_000,
  });
}

/**
 * Row locks for read → check → write sequences on members (merge, adjust,
 * holds, birthday bonus): `SELECT … FOR UPDATE` inside the caller's
 * transaction, ids sorted so two transactions never lock in opposite order.
 */
export async function lockMembers(tx: Tx, orgId: string, ids: string[]): Promise<void> {
  const sorted = [...new Set(ids)].sort();
  if (!sorted.length) return;
  // One statement, rows taken in id order (an import may lock thousands).
  await tx.$queryRaw`SELECT "id" FROM ${table("members")} WHERE "id" = ANY(${sorted}::text[]) AND "orgId" = ${orgId} ORDER BY "id" FOR UPDATE`;
}

/** Serializes the writers that must agree on a lane's blocks and bookings (block vs. confirm). */
export async function lockLane(tx: Tx, orgId: string, laneId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM ${table("lanes")} WHERE "id" = ${laneId} AND "orgId" = ${orgId} FOR UPDATE`;
}

/** One writer at a time per org for a named job (imports, settings): a transaction-scoped advisory lock. */
export async function lockOrgJob(tx: Tx, orgId: string, job: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${orgId}:${job}`}))`;
}

/** Inserts in chunks — Postgres caps a statement at 65,535 bind parameters. */
export async function createManyChunked<T>(rows: T[], size: number, write: (chunk: T[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < rows.length; i += size) await write(rows.slice(i, i + size));
}
