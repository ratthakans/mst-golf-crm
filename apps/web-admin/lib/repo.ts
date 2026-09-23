import { hashPassword } from "@mstgolf/shared/password";
import { normalizeThaiMobile } from "@mstgolf/shared/phone";
import { applyTierRate, findTier, lowestTier, reviewTier, tierRank } from "@mstgolf/shared/tiers";
import type { Role } from "./permissions";
import {
  DEMO_FIELD_DEFINITIONS,
  DEMO_ORG,
  generateDataset,
  pointsForAmount,
  spendByMember,
  type DemoOrg,
  type EventLike,
  type FieldDefinitionLike,
  type MemberLike,
  type PurchaseItemLike,
} from "@mstgolf/analytics";

// A tenant-agnostic data port. The dashboard, the sign-up form, and the API
// all go through this — so the SAME collection logic runs whether we're on the
// bundled sample data or the live Postgres database.

export interface CreateMemberInput {
  displayName: string;
  phone?: string; // canonical Thai mobile (see normalizeThaiMobile)
  email?: string;
  attributes: Record<string, unknown>;
  consent: boolean;
  source: "signup" | "admin"; // the public sign-up link, or staff in the back office
}

/** A member with this phone already exists — sign-up must not create a second one. */
export class DuplicateMemberError extends Error {
  constructor(readonly memberId: string) {
    super("A member with this phone number already exists");
  }
}

export interface CreateMemberResult {
  member: MemberLike;
  pointsAwarded: number;
  tier: string;
}

export interface CreatePurchaseInput {
  memberId: string;
  amount: number;
  channel?: string;
  items?: PurchaseItemLike[];
}

export interface CreatePurchaseResult {
  memberId: string;
  amount: number;
  pointsAwarded: number;
  newPoints: number;
  newTier: string;
}

export interface ImportRow {
  phone?: string;
  name?: string;
  amount: number;
  category?: string;
  brand?: string;
  branch?: string;
  channel?: string;
}

export interface ImportResult {
  imported: number; // purchases written
  matched: number; // rows matched to existing members
  created: number; // new members created
  revenue: number;
  pointsAwarded: number;
  skipped: number; // rows with no amount / no identity
}

const normalizePhone = (p?: string | null) => (p ?? "").replace(/[\s-]/g, "");

// ---------------------------------------------------------------------------
// Back-office users and the audit trail
// ---------------------------------------------------------------------------
export interface UserRecord {
  id: string;
  email: string; // lower-case
  name: string | null;
  role: Role;
  passwordHash: string | null;
  mustChangePassword: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export type UserPatch = Partial<
  Pick<UserRecord, "name" | "role" | "passwordHash" | "mustChangePassword" | "isActive" | "lastLoginAt">
>;

export interface NewUserInput {
  email: string;
  name: string | null;
  role: Role;
  passwordHash: string;
  mustChangePassword: boolean;
}

export class DuplicateUserError extends Error {
  constructor() {
    super("A user with this email already exists");
  }
}

export interface AuditInput {
  userId: string | null;
  action: string; // e.g. "member.create"
  entity: string; // e.g. "member"
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
}

export interface AuditRecord extends AuditInput {
  id: string;
  userName: string | null;
  createdAt: Date;
}

export interface Repository {
  readonly source: "sample" | "database";
  getOrg(): Promise<DemoOrg>;
  getFieldDefinitions(): Promise<FieldDefinitionLike[]>;
  listMembers(): Promise<MemberLike[]>;
  listEvents(): Promise<EventLike[]>;
  createMember(input: CreateMemberInput): Promise<CreateMemberResult>;
  getMember(id: string): Promise<MemberLike | null>;
  setMemberPicture(memberId: string, pictureUrl: string | null): Promise<void>;
  createPurchase(input: CreatePurchaseInput): Promise<CreatePurchaseResult>;
  importPurchases(rows: ImportRow[]): Promise<ImportResult>;

  findUserByEmail(email: string): Promise<UserRecord | null>;
  getUser(id: string): Promise<UserRecord | null>;
  listUsers(): Promise<UserRecord[]>;
  createUser(input: NewUserInput): Promise<UserRecord>;
  updateUser(id: string, patch: UserPatch): Promise<UserRecord>;
  writeAudit(entry: AuditInput): Promise<void>;
  listAudit(limit: number): Promise<AuditRecord[]>;
}

// ---------------------------------------------------------------------------
// In-memory repository (no infrastructure) — persists new sign-ups for the
// lifetime of the dev server so the collect → CRM → segment loop is real.
// ---------------------------------------------------------------------------
interface Store {
  members: MemberLike[];
  events: EventLike[];
  users: UserRecord[] | null; // seeded lazily (hashing is async)
  audit: AuditRecord[];
}

function getStore(): Store {
  const g = globalThis as unknown as { __mstStore?: Store };
  if (!g.__mstStore) {
    // Full synthetic base (~1,240 members) so every page computes from one
    // consistent dataset at realistic scale.
    const seed = generateDataset(new Date());
    g.__mstStore = { members: [...seed.members], events: [...seed.events], users: null, audit: [] };
  }
  return g.__mstStore;
}

/** Tier the member's current points are earned at. */
function currentTier(member: MemberLike) {
  return findTier(member.tier, DEMO_ORG.tiers) ?? lowestTier(DEMO_ORG.tiers);
}

/**
 * Upgrade-only review after a purchase (downgrades wait for the monthly review
 * in the nightly job). Writes TIER_UP when the member climbs a tier.
 */
function reviewAfterPurchase(store: Store, member: MemberLike, spend12m: number, now: Date) {
  const next = reviewTier(member.tier, spend12m, DEMO_ORG.tiers, { allowDowngrade: false });
  if (next.name === member.tier) return;
  const from = tierRank(member.tier, DEMO_ORG.tiers);
  if (from >= 0 && tierRank(next.name, DEMO_ORG.tiers) > from) {
    store.events.push({ memberId: member.id, type: "TIER_UP", occurredAt: now, payload: { from: member.tier, to: next.name } });
  }
  member.tier = next.name;
}

/**
 * Sample mode has one Super Admin: ADMIN_EMAIL / ADMIN_PASSWORD when set, or a
 * fixed local account in development only. A deployed sample build without
 * those env vars has no users, so nobody can sign in.
 */
export const DEV_ADMIN = { email: "admin@mstgolf.local", password: "mstgolf-dev-admin" };

async function sampleUsers(store: Store): Promise<UserRecord[]> {
  if (store.users) return store.users;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const creds =
    email && password ? { email, password }
      : process.env.NODE_ENV !== "production" ? DEV_ADMIN
        : null;
  store.users = creds
    ? [{
        id: "user_admin", email: creds.email, name: "ผู้ดูแลระบบ", role: "SUPER_ADMIN",
        passwordHash: await hashPassword(creds.password), mustChangePassword: false,
        isActive: true, lastLoginAt: null, createdAt: new Date(),
      }]
    : [];
  return store.users;
}

class MemoryRepository implements Repository {
  readonly source = "sample" as const;

  async getOrg(): Promise<DemoOrg> {
    return DEMO_ORG;
  }
  async getFieldDefinitions(): Promise<FieldDefinitionLike[]> {
    return DEMO_FIELD_DEFINITIONS;
  }
  async listMembers(): Promise<MemberLike[]> {
    return [...getStore().members].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }
  async listEvents(): Promise<EventLike[]> {
    return getStore().events;
  }
  async createMember(input: CreateMemberInput): Promise<CreateMemberResult> {
    const store = getStore();
    if (input.phone) {
      const existing = store.members.find((m) => normalizeThaiMobile(m.phone) === input.phone);
      if (existing) throw new DuplicateMemberError(existing.id);
    }
    const now = new Date();
    const points = DEMO_ORG.signupBonus;
    const tier = lowestTier(DEMO_ORG.tiers).name;
    const id = `web_${store.members.length + 1}_${now.getTime()}`;

    const member: MemberLike = {
      id,
      displayName: input.displayName,
      phone: input.phone ?? null,
      email: input.email ?? null,
      tier,
      points,
      lastSeenAt: now,
      createdAt: now,
      attributes: input.attributes,
    };
    // Every behaviour is an Event — signup writes REGISTER (basis for funnel/RFM).
    store.members.push(member);
    store.events.push({ memberId: id, type: "REGISTER", occurredAt: now, payload: { source: input.source } });

    return { member, pointsAwarded: points, tier };
  }

  async getMember(id: string): Promise<MemberLike | null> {
    return getStore().members.find((m) => m.id === id) ?? null;
  }

  async setMemberPicture(memberId: string, pictureUrl: string | null): Promise<void> {
    const store = getStore();
    const member = store.members.find((m) => m.id === memberId);
    if (!member) throw new Error("Member not found");
    member.pictureUrl = pictureUrl;
    store.events.push({
      memberId, type: "PROFILE_UPDATE", occurredAt: new Date(),
      payload: { field: "picture", action: pictureUrl ? "set" : "removed" },
    });
  }

  async createPurchase(input: CreatePurchaseInput): Promise<CreatePurchaseResult> {
    const store = getStore();
    const member = store.members.find((m) => m.id === input.memberId);
    if (!member) throw new Error("Member not found");

    const now = new Date();
    const pointsAwarded = applyTierRate(pointsForAmount(input.amount, DEMO_ORG.perCurrencyUnit), currentTier(member));

    // PURCHASE event (feeds RFM/CLV/affinity) + points cache + tier + recency.
    store.events.push({
      memberId: member.id,
      type: "PURCHASE",
      occurredAt: now,
      payload: {
        amount: input.amount,
        currency: DEMO_ORG.currency,
        channel: input.channel ?? "store",
        items: input.items,
      },
    });
    member.points += pointsAwarded;
    member.lastSeenAt = now;
    const own = store.events.filter((e) => e.memberId === member.id);
    reviewAfterPurchase(store, member, spendByMember(own, now).get(member.id) ?? 0, now);

    return {
      memberId: member.id,
      amount: input.amount,
      pointsAwarded,
      newPoints: member.points,
      newTier: currentTier(member).name,
    };
  }

  async importPurchases(rows: ImportRow[]): Promise<ImportResult> {
    const store = getStore();
    const now = new Date();
    const res: ImportResult = { imported: 0, matched: 0, created: 0, revenue: 0, pointsAwarded: 0, skipped: 0 };
    // One pass over the log up front; kept current as rows are written.
    const spend12m = spendByMember(store.events, now);

    for (const row of rows) {
      const amount = Number(row.amount);
      const phone = normalizePhone(row.phone);
      const name = (row.name ?? "").trim();
      if (!Number.isFinite(amount) || amount <= 0 || (!phone && !name)) {
        res.skipped += 1;
        continue;
      }

      let member =
        (phone && store.members.find((m) => normalizePhone(m.phone) === phone)) ||
        (name && store.members.find((m) => m.displayName === name)) ||
        undefined;

      if (!member) {
        member = {
          id: `pos_${store.members.length + 1}_${now.getTime()}_${res.imported}`,
          displayName: name || phone || "ลูกค้า POS",
          phone: phone || null,
          email: null,
          tier: lowestTier(DEMO_ORG.tiers).name,
          points: 0,
          lastSeenAt: now,
          createdAt: now,
          attributes: {},
        };
        store.members.push(member);
        store.events.push({ memberId: member.id, type: "REGISTER", occurredAt: now });
        res.created += 1;
      } else {
        res.matched += 1;
      }

      const pointsAwarded = applyTierRate(pointsForAmount(amount, DEMO_ORG.perCurrencyUnit), currentTier(member));
      const item: PurchaseItemLike = {
        name: row.category ? `${row.category}${row.brand ? ` (${row.brand})` : ""}` : "สินค้า",
        category: row.category ?? "other",
        brand: row.brand,
        qty: 1,
        unitPrice: amount,
      };
      store.events.push({
        memberId: member.id, type: "PURCHASE", occurredAt: now,
        payload: { amount, currency: DEMO_ORG.currency, channel: row.channel ?? "store", branch: row.branch, items: [item] },
      });
      store.events.push({ memberId: member.id, type: "EARN_POINTS", occurredAt: now, payload: { delta: pointsAwarded, branch: row.branch } });
      member.points += pointsAwarded;
      member.lastSeenAt = now;
      const spend = (spend12m.get(member.id) ?? 0) + amount;
      spend12m.set(member.id, spend);
      reviewAfterPurchase(store, member, spend, now);

      res.imported += 1;
      res.revenue += amount;
      res.pointsAwarded += pointsAwarded;
    }

    return res;
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const users = await sampleUsers(getStore());
    return users.find((u) => u.email === email.trim().toLowerCase()) ?? null;
  }

  async getUser(id: string): Promise<UserRecord | null> {
    return (await sampleUsers(getStore())).find((u) => u.id === id) ?? null;
  }

  async listUsers(): Promise<UserRecord[]> {
    return [...(await sampleUsers(getStore()))];
  }

  async createUser(input: NewUserInput): Promise<UserRecord> {
    const users = await sampleUsers(getStore());
    const email = input.email.trim().toLowerCase();
    if (users.some((u) => u.email === email)) throw new DuplicateUserError();
    const user: UserRecord = {
      id: `user_${users.length + 1}_${Date.now()}`, email, name: input.name, role: input.role,
      passwordHash: input.passwordHash, mustChangePassword: input.mustChangePassword,
      isActive: true, lastLoginAt: null, createdAt: new Date(),
    };
    users.push(user);
    return user;
  }

  async updateUser(id: string, patch: UserPatch): Promise<UserRecord> {
    const user = (await sampleUsers(getStore())).find((u) => u.id === id);
    if (!user) throw new Error("User not found");
    Object.assign(user, patch);
    return user;
  }

  async writeAudit(entry: AuditInput): Promise<void> {
    const store = getStore();
    const users = await sampleUsers(store);
    store.audit.unshift({
      ...entry,
      id: `audit_${store.audit.length + 1}`,
      userName: users.find((u) => u.id === entry.userId)?.name ?? null,
      createdAt: new Date(),
    });
  }

  async listAudit(limit: number): Promise<AuditRecord[]> {
    return getStore().audit.slice(0, limit);
  }
}

// ---------------------------------------------------------------------------
// Factory — DATA_SOURCE=database uses live Postgres via @mstgolf/database.
// ---------------------------------------------------------------------------
let cached: Repository | null = null;

export async function getRepo(): Promise<Repository> {
  if (cached) return cached;
  if (process.env.DATA_SOURCE === "database") {
    const { PrismaRepository } = await import("./prisma-repo");
    cached = new PrismaRepository();
  } else {
    cached = new MemoryRepository();
  }
  return cached;
}
