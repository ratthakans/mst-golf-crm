import "server-only";
import { db } from "@mstgolf/core";
import type { Role } from "./permissions";
import { currentOrg } from "./org";

// Back-office user accounts. Staff log in with email (or their optional
// username) + password (scrypt); the
// session cookie only carries the id, so every request re-reads the row.

export interface UserRecord {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  role: Role;
  passwordHash: string | null;
  mustChangePassword: boolean;
  sessionVersion: number;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export type UserPatch = Partial<Pick<UserRecord, "name" | "username" | "role" | "passwordHash" | "mustChangePassword" | "sessionVersion" | "isActive" | "lastLoginAt">>;

export class DuplicateUserError extends Error {
  constructor() {
    super("A user with this email or username already exists");
  }
}

async function client() {
  const org = await currentOrg();
  return { orgId: org.id, db: db(org.id) };
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const { db } = await client();
  return (await db.user.findFirst({ where: { email: email.trim().toLowerCase() } })) as UserRecord | null;
}

/** A sign-in name: lower-case letters, digits, dot, dash, underscore; 3–32 long, no @. */
export const USERNAME = /^[a-z0-9._-]{3,32}$/;

/** Sign-in lookup: an email when it has an @, otherwise a username. */
export async function findUserByLogin(login: string): Promise<UserRecord | null> {
  const key = login.trim().toLowerCase();
  if (key.includes("@")) return findUserByEmail(key);
  if (!USERNAME.test(key)) return null;
  const { db } = await client();
  return (await db.user.findFirst({ where: { username: key } })) as UserRecord | null;
}

export async function getUser(id: string): Promise<UserRecord | null> {
  const { db } = await client();
  return (await db.user.findFirst({ where: { id } })) as UserRecord | null;
}

export async function listUsers(): Promise<UserRecord[]> {
  const { db } = await client();
  return (await db.user.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] })) as UserRecord[];
}

export async function createUser(input: { email: string; username?: string | null; name: string | null; role: Role; passwordHash: string; mustChangePassword: boolean }): Promise<UserRecord> {
  const { orgId, db } = await client();
  const email = input.email.trim().toLowerCase();
  if (await db.user.findFirst({ where: { email } })) throw new DuplicateUserError();
  if (input.username && (await db.user.findFirst({ where: { username: input.username } }))) throw new DuplicateUserError();
  return (await db.user.create({ data: { orgId, ...input, email } })) as UserRecord;
}

export async function updateUser(id: string, patch: UserPatch): Promise<UserRecord> {
  const { db } = await client();
  const found = await db.user.findFirst({ where: { id } });
  if (!found) throw new Error("User not found");
  return (await db.user.update({ where: { id }, data: patch })) as UserRecord;
}

export interface AuditRecord {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  ip: string | null;
  userName: string | null;
  createdAt: Date;
}

export async function listAudit(opts: { limit?: number; entity?: string; entityId?: string } = {}): Promise<AuditRecord[]> {
  const { db } = await client();
  const rows = await db.auditLog.findMany({
    where: { ...(opts.entity ? { entity: opts.entity } : {}), ...(opts.entityId ? { entityId: opts.entityId } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 200,
    include: { user: { select: { name: true, email: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    before: r.before,
    after: r.after,
    reason: r.reason,
    ip: r.ip,
    userName: r.user ? r.user.name ?? r.user.email : null,
    createdAt: r.createdAt,
  }));
}
