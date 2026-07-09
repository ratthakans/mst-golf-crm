import type { Prisma } from "@mstgolf/database";
import type { OrgSettings } from "@mstgolf/shared";
import {
  pointsForAmount,
  tierForPoints,
  type DemoOrg,
  type EventLike,
  type EventTypeName,
  type FieldDefinitionLike,
  type FieldOptionLike,
  type FieldTypeName,
  type MemberLike,
} from "@mstgolf/analytics";
import type {
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

// Live Postgres implementation. Every tenant query goes through forOrg(orgId)
// so it is automatically scoped to MST Golf. The runtime client is imported
// lazily so sample-data mode never loads Prisma.
export class PrismaRepository implements Repository {
  readonly source = "database" as const;
  private orgIdCache: string | null = null;
  private settingsCache: OrgSettings | null = null;

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
    return org.id;
  }

  private async settings(): Promise<OrgSettings> {
    await this.orgId();
    if (!this.settingsCache) throw new Error("Org settings missing");
    return this.settingsCache;
  }

  async getOrg(): Promise<DemoOrg> {
    const s = await this.settings();
    return {
      name: "MST Golf",
      slug: ORG_SLUG,
      currency: s.currency,
      brandColor: s.brandColor ?? "#0a5c36",
      churnDays: s.crm.churnDays,
      signupBonus: s.points.signupBonus,
      perCurrencyUnit: s.points.perBaht,
      consentText: s.messaging.consentText,
      tiers: s.tiers,
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
    return rows.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      tier: m.tier,
      points: m.points,
      lastSeenAt: m.lastSeenAt,
      createdAt: m.createdAt,
      phone: m.phone,
      email: m.email,
      attributes: (m.attributes as Record<string, unknown>) ?? {},
    }));
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

    const now = new Date();
    const points = s.points.signupBonus;
    const tier = tierForPoints(points, s.tiers);
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
      data: { orgId, memberId: member.id, type: "REGISTER", payload: {} },
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
      member: {
        id: member.id,
        displayName: member.displayName,
        tier: member.tier,
        points: member.points,
        lastSeenAt: member.lastSeenAt,
        createdAt: member.createdAt,
        phone: member.phone,
        email: member.email,
        attributes: input.attributes,
      },
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
    const pointsAwarded = pointsForAmount(input.amount, s.points.perBaht);

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

    // Keep the Member.points cache in sync with the ledger, then recompute tier.
    const updated = await client.member.update({
      where: { id: input.memberId },
      data: { points: { increment: pointsAwarded }, lastSeenAt: now },
    });
    const newTier = tierForPoints(updated.points, s.tiers);
    if (newTier !== updated.tier) {
      await client.member.update({ where: { id: input.memberId }, data: { tier: newTier } });
    }

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
            tier: "Silver",
            lastSeenAt: now,
          },
        });
        await client.event.create({ data: { orgId, memberId: member.id, type: "REGISTER", payload: {} } });
        res.created += 1;
      } else {
        res.matched += 1;
      }

      const pointsAwarded = pointsForAmount(amount, s.points.perBaht);
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
      const tier = tierForPoints(updated.points, s.tiers);
      if (tier !== updated.tier) await client.member.update({ where: { id: member.id }, data: { tier } });

      res.imported += 1;
      res.revenue += amount;
      res.pointsAwarded += pointsAwarded;
    }

    return res;
  }
}
