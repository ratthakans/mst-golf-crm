import type { Prisma } from "@mstgolf/database";
import type { OrgSettings, TierSettings } from "@mstgolf/shared";
import { phoneVariants } from "@mstgolf/shared/phone";
import {
  applyTierRate,
  findTier,
  lowestTier,
  resolveTiers,
  reviewTier,
  spendInWindow,
  TIER_WINDOW_DAYS,
  tierRank,
} from "@mstgolf/shared/tiers";
import {
  pointsForAmount,
  type DemoOrg,
  type EventLike,
  type EventTypeName,
  type FieldDefinitionLike,
  type FieldOptionLike,
  type FieldTypeName,
  type MemberLike,
} from "@mstgolf/analytics";
import { DuplicateMemberError, DuplicateUserError } from "./repo";
import type {
  AuditInput,
  AuditRecord,
  NewUserInput,
  UserPatch,
  UserRecord,
  CreateMemberInput,
  CreateMemberResult,
  CreatePurchaseInput,
  CreatePurchaseResult,
  ImportResult,
  ImportRow,
  Repository,
} from "./repo";

const normPhone = (p?: string) => (p ?? "").replace(/[\s-]/g, "");

const ORG_SLUG = "mst-golf";

type OrgClient = ReturnType<typeof import("@mstgolf/database").forOrg>;

// Live Postgres implementation. Every tenant query goes through forOrg(orgId)
// so it is automatically scoped to MST Golf. The runtime client is imported
// lazily so sample-data mode never loads Prisma.
function toUserRecord(u: {
  id: string; email: string; name: string | null; role: string; passwordHash: string | null;
  mustChangePassword: boolean; isActive: boolean; lastLoginAt: Date | null; createdAt: Date;
}): UserRecord {
  return {
    id: u.id, email: u.email, name: u.name, role: u.role as UserRecord["role"],
    passwordHash: u.passwordHash, mustChangePassword: u.mustChangePassword,
    isActive: u.isActive, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
  };
}

const jsonOrNull = (v: unknown) =>
  v === undefined || v === null ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue);

function toMemberLike(m: {
  id: string; displayName: string | null; tier: string | null; points: number;
  lastSeenAt: Date | null; createdAt: Date; phone: string | null; email: string | null;
  pictureUrl: string | null; attributes: unknown;
}): MemberLike {
  return {
    id: m.id,
    displayName: m.displayName,
    tier: m.tier,
    points: m.points,
    lastSeenAt: m.lastSeenAt,
    createdAt: m.createdAt,
    phone: m.phone,
    email: m.email,
    pictureUrl: m.pictureUrl,
    attributes: (m.attributes as Record<string, unknown>) ?? {},
  };
}

export class PrismaRepository implements Repository {
  readonly source = "database" as const;
  private orgIdCache: string | null = null;
  private settingsCache: OrgSettings | null = null;
  private orgNameCache = "";

  private async db() {
    return import("@mstgolf/database");
  }

  private async orgId(): Promise<string> {
    if (this.orgIdCache) return this.orgIdCache;
    const { prisma } = await this.db();
    const org = await prisma.organization.findUnique({
      where: { slug: ORG_SLUG },
    });
    if (!org) throw new Error(`Organization '${ORG_SLUG}' not found — run db:seed`);
    this.orgIdCache = org.id;
    this.settingsCache = org.settings as unknown as OrgSettings;
    this.orgNameCache = org.name;
    return org.id;
  }

  private async tiers(): Promise<TierSettings[]> {
    return resolveTiers((await this.settings()).tiers);
  }

  /** Purchase spend in the trailing 12 months, straight from the event log. */
  private async spend12m(client: OrgClient, memberId: string, now: Date): Promise<number> {
    const since = new Date(now.getTime() - TIER_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const rows = await client.event.findMany({
      where: { memberId, type: "PURCHASE", occurredAt: { gte: since } },
      select: { payload: true, occurredAt: true },
    });
    return spendInWindow(
      rows.map((r) => ({ amount: Number((r.payload as { amount?: number } | null)?.amount ?? 0), at: r.occurredAt })),
      now,
    );
  }

  /** Upgrade-only review after a purchase; downgrades wait for the nightly monthly review. */
  private async reviewMemberTier(
    client: OrgClient,
    orgId: string,
    member: { id: string; tier: string | null },
    spend12m: number,
  ): Promise<string> {
    const tiers = await this.tiers();
    const next = reviewTier(member.tier, spend12m, tiers, { allowDowngrade: false });
    if (next.name === member.tier) return next.name;
    await client.member.update({ where: { id: member.id }, data: { tier: next.name } });
    const from = tierRank(member.tier, tiers);
    if (from >= 0 && tierRank(next.name, tiers) > from) {
      await client.event.create({
        data: { orgId, memberId: member.id, type: "TIER_UP", payload: { from: member.tier, to: next.name } },
      });
    }
    return next.name;
  }

  private async settings(): Promise<OrgSettings> {
    await this.orgId();
    if (!this.settingsCache) throw new Error("Org settings missing");
    return this.settingsCache;
  }

  async getOrg(): Promise<DemoOrg> {
    const s = await this.settings();
    return {
      name: this.orgNameCache,
      productName: s.productName ?? `${this.orgNameCache} Platform`,
      slug: ORG_SLUG,
      currency: s.currency,
      brandColor: s.brandColor ?? "#0a5c36",
      churnDays: s.crm.churnDays,
      signupBonus: s.points.signupBonus,
      perCurrencyUnit: s.points.perBaht,
      consentText: s.messaging.consentText,
      tiers: await this.tiers(),
    };
  }

  async getFieldDefinitions(): Promise<FieldDefinitionLike[]> {
    const orgId = await this.orgId();
    const { forOrg } = await this.db();
    const rows = await forOrg(orgId).fieldDefinition.findMany({
      where: { entity: "MEMBER", isActive: true },
      orderBy: { order: "asc" },
    });
    return rows.map((r) => ({
      key: r.key,
      label: r.label,
      type: r.type as FieldTypeName,
      required: r.required,
      options: (r.options as unknown as FieldOptionLike[]) ?? [],
      group: r.group ?? undefined,
      order: r.order,
    }));
  }

  async listMembers(): Promise<MemberLike[]> {
    const orgId = await this.orgId();
    const { forOrg } = await this.db();
    const rows = await forOrg(orgId).member.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toMemberLike);
  }

  async getMember(id: string): Promise<MemberLike | null> {
    const orgId = await this.orgId();
    const { forOrg } = await this.db();
    const m = await forOrg(orgId).member.findFirst({ where: { id } });
    return m ? toMemberLike(m) : null;
  }

  async setMemberPicture(memberId: string, pictureUrl: string | null): Promise<void> {
    const orgId = await this.orgId();
    const { forOrg } = await this.db();
    const client = forOrg(orgId);
    const updated = await client.member.updateMany({ where: { id: memberId }, data: { pictureUrl } });
    if (updated.count === 0) throw new Error("Member not found");
    await client.event.create({
      data: {
        orgId, memberId, type: "PROFILE_UPDATE",
        payload: { field: "picture", action: pictureUrl ? "set" : "removed" },
      },
    });
  }

  async listEvents(): Promise<EventLike[]> {
    const orgId = await this.orgId();
    const { forOrg } = await this.db();
    const rows = await forOrg(orgId).event.findMany();
    return rows.map((e) => ({
      memberId: e.memberId,
      type: e.type as EventTypeName,
      occurredAt: e.occurredAt,
      payload: (e.payload as EventLike["payload"]) ?? {},
    }));
  }

  async createMember(input: CreateMemberInput): Promise<CreateMemberResult> {
    const orgId = await this.orgId();
    const s = await this.settings();
    const { forOrg } = await this.db();
    const client = forOrg(orgId);

    if (input.phone) {
      const existing = await client.member.findFirst({
        where: { phone: { in: phoneVariants(input.phone) } },
        select: { id: true },
      });
      if (existing) throw new DuplicateMemberError(existing.id);
    }

    const now = new Date();
    const points = s.points.signupBonus;
    const tier = lowestTier(await this.tiers()).name;
    // Non-LINE web signup — synthesize a stable lineUserId until LINE is wired.
    const lineUserId = `web:${input.phone ?? input.email ?? input.displayName}:${now.getTime()}`;

    const member = await client.member.create({
      data: {
        orgId,
        lineUserId,
        displayName: input.displayName,
        phone: input.phone ?? null,
        email: input.email ?? null,
        attributes: input.attributes as unknown as Prisma.InputJsonValue,
        points,
        tier,
        lastSeenAt: now,
        consentAt: input.consent ? now : null,
      },
    });

    // Event-driven + ledger + versioned consent — the real collection path.
    await client.event.create({
      data: { orgId, memberId: member.id, type: "REGISTER", payload: { source: input.source } },
    });
    await client.pointTransaction.create({
      data: { orgId, memberId: member.id, delta: points, reason: "signup_bonus" },
    });
    if (input.consent) {
      await client.consent.create({
        data: {
          orgId,
          memberId: member.id,
          purpose: "data_processing",
          version: "v1",
          granted: true,
          textSnapshot: s.messaging.consentText,
        },
      });
    }

    return {
      member: toMemberLike(member),
      pointsAwarded: points,
      tier,
    };
  }

  async createPurchase(input: CreatePurchaseInput): Promise<CreatePurchaseResult> {
    const orgId = await this.orgId();
    const s = await this.settings();
    const { forOrg } = await this.db();
    const client = forOrg(orgId);

    const now = new Date();
    const member = await client.member.findFirst({ where: { id: input.memberId } });
    if (!member) throw new Error("Member not found");
    const tiers = await this.tiers();
    const current = findTier(member.tier, tiers) ?? lowestTier(tiers);
    const pointsAwarded = applyTierRate(pointsForAmount(input.amount, s.points.perBaht), current);

    await client.event.create({
      data: {
        orgId,
        memberId: input.memberId,
        type: "PURCHASE",
        payload: {
          amount: input.amount,
          currency: s.currency,
          channel: input.channel ?? "store",
          items: input.items ?? [],
        } as unknown as Prisma.InputJsonValue,
      },
    });
    await client.pointTransaction.create({
      data: { orgId, memberId: input.memberId, delta: pointsAwarded, reason: "purchase" },
    });

    // Keep the Member.points cache in sync with the ledger, then review the tier
    // against 12-month spend (this purchase included).
    const updated = await client.member.update({
      where: { id: input.memberId },
      data: { points: { increment: pointsAwarded }, lastSeenAt: now },
    });
    const newTier = await this.reviewMemberTier(client, orgId, updated, await this.spend12m(client, input.memberId, now));

    return {
      memberId: input.memberId,
      amount: input.amount,
      pointsAwarded,
      newPoints: updated.points,
      newTier,
    };
  }

  async importPurchases(rows: ImportRow[]): Promise<ImportResult> {
    const orgId = await this.orgId();
    const s = await this.settings();
    const { forOrg } = await this.db();
    const client = forOrg(orgId);
    const now = new Date();
    const res: ImportResult = { imported: 0, matched: 0, created: 0, revenue: 0, pointsAwarded: 0, skipped: 0 };
    const tiers = await this.tiers();
    // 12-month spend per member, loaded once per member and then kept current
    // as this file's rows are written.
    const spendCache = new Map<string, number>();

    for (const row of rows) {
      const amount = Number(row.amount);
      const phone = normPhone(row.phone);
      const name = (row.name ?? "").trim();
      if (!Number.isFinite(amount) || amount <= 0 || (!phone && !name)) {
        res.skipped += 1;
        continue;
      }

      let member = phone
        ? await client.member.findFirst({ where: { phone } })
        : await client.member.findFirst({ where: { displayName: name } });

      if (!member) {
        member = await client.member.create({
          data: {
            orgId,
            lineUserId: `pos:${phone || name}:${now.getTime()}:${res.imported}`,
            displayName: name || phone || "ลูกค้า POS",
            phone: phone || null,
            points: 0,
            tier: lowestTier(tiers).name,
            lastSeenAt: now,
          },
        });
        await client.event.create({ data: { orgId, memberId: member.id, type: "REGISTER", payload: {} } });
        res.created += 1;
      } else {
        res.matched += 1;
      }

      if (!spendCache.has(member.id)) spendCache.set(member.id, await this.spend12m(client, member.id, now));
      const current = findTier(member.tier, tiers) ?? lowestTier(tiers);
      const pointsAwarded = applyTierRate(pointsForAmount(amount, s.points.perBaht), current);
      const item = {
        name: row.category ? `${row.category}${row.brand ? ` (${row.brand})` : ""}` : "สินค้า",
        category: row.category ?? "other",
        brand: row.brand,
        qty: 1,
        unitPrice: amount,
      };
      await client.event.create({
        data: {
          orgId, memberId: member.id, type: "PURCHASE",
          payload: { amount, currency: s.currency, channel: row.channel ?? "store", branch: row.branch, items: [item] } as unknown as Prisma.InputJsonValue,
        },
      });
      await client.pointTransaction.create({ data: { orgId, memberId: member.id, delta: pointsAwarded, reason: "pos_import" } });
      const updated = await client.member.update({
        where: { id: member.id },
        data: { points: { increment: pointsAwarded }, lastSeenAt: now },
      });
      const spend12m = (spendCache.get(member.id) ?? 0) + amount;
      spendCache.set(member.id, spend12m);
      await this.reviewMemberTier(client, orgId, updated, spend12m);

      res.imported += 1;
      res.revenue += amount;
      res.pointsAwarded += pointsAwarded;
    }

    return res;
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const orgId = await this.orgId();
    const { forOrg } = await this.db();
    const u = await forOrg(orgId).user.findFirst({ where: { email: email.trim().toLowerCase() } });
    return u ? toUserRecord(u) : null;
  }

  async getUser(id: string): Promise<UserRecord | null> {
    const orgId = await this.orgId();
    const { forOrg } = await this.db();
    const u = await forOrg(orgId).user.findFirst({ where: { id } });
    return u ? toUserRecord(u) : null;
  }

  async listUsers(): Promise<UserRecord[]> {
    const orgId = await this.orgId();
    const { forOrg } = await this.db();
    const rows = await forOrg(orgId).user.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(toUserRecord);
  }

  async createUser(input: NewUserInput): Promise<UserRecord> {
    const orgId = await this.orgId();
    const { forOrg } = await this.db();
    const client = forOrg(orgId);
    const email = input.email.trim().toLowerCase();
    if (await client.user.findFirst({ where: { email }, select: { id: true } })) throw new DuplicateUserError();
    const u = await client.user.create({
      data: {
        orgId, email, name: input.name, role: input.role,
        passwordHash: input.passwordHash, mustChangePassword: input.mustChangePassword,
      },
    });
    return toUserRecord(u);
  }

  async updateUser(id: string, patch: UserPatch): Promise<UserRecord> {
    const orgId = await this.orgId();
    const { forOrg } = await this.db();
    const client = forOrg(orgId);
    // updateMany keeps the write inside this tenant (update-by-id is not scoped).
    const res = await client.user.updateMany({ where: { id }, data: patch });
    if (res.count === 0) throw new Error("User not found");
    const u = await client.user.findFirst({ where: { id } });
    return toUserRecord(u!);
  }

  async writeAudit(entry: AuditInput): Promise<void> {
    const orgId = await this.orgId();
    const { forOrg } = await this.db();
    await forOrg(orgId).auditLog.create({
      data: {
        orgId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        before: jsonOrNull(entry.before),
        after: jsonOrNull(entry.after),
        reason: entry.reason ?? null,
        ip: entry.ip ?? null,
      },
    });
  }

  async listAudit(limit: number): Promise<AuditRecord[]> {
    const orgId = await this.orgId();
    const { forOrg } = await this.db();
    const rows = await forOrg(orgId).auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { name: true, email: true } } },
    });
    return rows.map((r) => ({
      id: r.id, userId: r.userId, action: r.action, entity: r.entity, entityId: r.entityId,
      before: r.before, after: r.after, reason: r.reason, ip: r.ip, createdAt: r.createdAt,
      userName: r.user?.name ?? r.user?.email ?? null,
    }));
  }
}
