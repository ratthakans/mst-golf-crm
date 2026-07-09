import { PrismaClient, Prisma } from "@prisma/client";

/**
 * Base Prisma client singleton.
 *
 * Prefer `forOrg(orgId)` for anything that touches tenant data — it injects
 * `orgId` automatically so a query can never accidentally leak across tenants.
 * Only use the raw client for org-level bootstrap (creating orgs, auth lookups
 * by unique keys) and migrations/seed.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Models that are scoped to a tenant (everything except Organization).
 * Keep this in sync with schema.prisma.
 */
const TENANT_MODELS = new Set<string>([
  "User",
  "Member",
  "Event",
  "PointTransaction",
  "FieldDefinition",
  "LineChannel",
  "Consent",
]);

// Operations whose `where` clause should be constrained to the tenant.
const WHERE_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "updateMany",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
]);

// Operations that write `data` and should have `orgId` stamped in.
const CREATE_OPS = new Set(["create", "createMany"]);

/**
 * Returns a Prisma client bound to a single organization.
 *
 * Guarantees:
 *   - READS (findMany/findFirst/count/aggregate/groupBy/updateMany/deleteMany)
 *     are automatically constrained to `orgId` — you cannot leak another
 *     tenant's rows, even if you forget the filter.
 *   - WRITES (create/createMany) have `orgId` stamped in, OVERRIDING any value
 *     the caller passes — a wrong orgId is corrected to this tenant's.
 *
 * Limitations (M0 starter):
 *   - Prisma's generated types still require `orgId` on create inputs; the
 *     override is a runtime safety net, not a compile-time one.
 *   - Nested writes and `upsert`/`findUnique` by compound key still need an
 *     explicit `orgId` in the query (guarded by `@@unique([orgId, ...])`).
 *   - Postgres Row-Level Security is planned for M4 as a second, DB-enforced
 *     layer that closes these gaps.
 */
export function forOrg(orgId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) {
            return query(args);
          }

          const a = (args ?? {}) as Record<string, unknown>;

          if (WHERE_OPS.has(operation)) {
            a.where = { ...(a.where as object | undefined), orgId };
          }

          if (CREATE_OPS.has(operation)) {
            if (operation === "createMany") {
              const data = a.data;
              a.data = Array.isArray(data)
                ? data.map((d) => ({ ...(d as object), orgId }))
                : { ...(data as object), orgId };
            } else {
              a.data = { ...(a.data as object), orgId };
            }
          }

          return query(a);
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof forOrg>;

export { Prisma, PrismaClient };
export * from "@prisma/client";
