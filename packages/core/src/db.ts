import { forOrg, type Prisma } from "@mstgolf/database";

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

/** Inserts in chunks — Postgres caps a statement at 65,535 bind parameters. */
export async function createManyChunked<T>(rows: T[], size: number, write: (chunk: T[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < rows.length; i += size) await write(rows.slice(i, i + size));
}
