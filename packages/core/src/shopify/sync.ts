import { createHash } from "node:crypto";
import type { Prisma } from "@mstgolf/database";
import { decrypt, encrypt } from "@mstgolf/shared";
import { writeAudit } from "../audit";
import { SYSTEM, type Actor } from "../context";
import { db, inTx } from "../db";
import { CoreError } from "../errors";
import { commitImport, stageBatch, type ImportCounts } from "../pos/import";
import { getOrg } from "../settings";
import { localDateKey } from "../time";
import { fetchOrders, type Fetch } from "./client";
import { orderEmail, orderPhone, orderToBills, type ShopifyOrder, type SkipReason } from "./orders";

// Nightly pull of online orders into Sales (docs/th-commerce/INTEGRATION.md).
// Each run books every order whose return window closed since the last run,
// plus refunds on older orders, through the POS import engine — so online
// orders get the same duplicate checks, points, tier upgrades, LINE message,
// audit trail and 7-day rollback as a POS file.

export const ONLINE_STORE_CODE = "ONLINE";
const DAY_MS = 24 * 60 * 60_000;
const OVERLAP_MS = 2 * DAY_MS; // re-read a little of the last window; duplicates are skipped
const FIRST_RUN_DAYS = 30; // how far back the first sync looks

export interface ShopifyConnectionInput {
  shopDomain: string;
  accessToken?: string; // blank = keep the stored token
  windowDays: number;
  isActive: boolean;
}

export interface SyncResult {
  orders: number;
  booked: number; // orders that produced a SALE this run (new or duplicate)
  returns: number;
  matched: number; // orders tied to a member
  skipped: Partial<Record<SkipReason, number>>;
  batchId: string | null;
  counts: ImportCounts | null;
  window: { from: string; to: string };
}

export function normalizeShopDomain(raw: string): string | null {
  const d = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(d) ? d : null;
}

export async function saveShopifyConnection(orgId: string, actor: Actor, input: ShopifyConnectionInput): Promise<void> {
  const shopDomain = normalizeShopDomain(input.shopDomain);
  if (!shopDomain) throw new CoreError("INVALID_INPUT", "ใส่โดเมน .myshopify.com ของร้าน เช่น mst-golf-thailand.myshopify.com");
  const windowDays = Math.trunc(Number(input.windowDays));
  if (!Number.isFinite(windowDays) || windowDays < 0 || windowDays > 60) throw new CoreError("INVALID_INPUT", "ระยะคืนสินค้าต้องอยู่ระหว่าง 0–60 วัน");
  const token = input.accessToken?.trim();
  if (token && !/^shpat_[A-Za-z0-9]+$/.test(token)) throw new CoreError("INVALID_INPUT", "Admin API token ของ Shopify ขึ้นต้นด้วย shpat_");
  const { settings } = await getOrg(orgId);
  const siteHost = settings.site.siteUrl?.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  await inTx(orgId, async (tx) => {
    const existing = await tx.shopifyConnection.findFirst({ orderBy: { createdAt: "asc" } });
    if (!existing && !token) throw new CoreError("INVALID_INPUT", "ครั้งแรกต้องใส่ Admin API token");
    // Online sales are booked to their own store, kept out of the store pickers
    // (isActive false) because customers never visit it.
    let store = await tx.store.findFirst({ where: { code: ONLINE_STORE_CODE } });
    if (!store) {
      store = await tx.store.create({
        data: { orgId, code: ONLINE_STORE_CODE, name: `ร้านออนไลน์ ${siteHost || shopDomain}`, isActive: false, openHours: {} },
      });
    }
    const data = { shopDomain, windowDays, isActive: input.isActive, storeId: store.id, ...(token ? { accessTokenEnc: encrypt(token) } : {}) };
    if (existing) await tx.shopifyConnection.update({ where: { id: existing.id }, data });
    else await tx.shopifyConnection.create({ data: { orgId, ...data, accessTokenEnc: encrypt(token!) } });
    await writeAudit(tx, orgId, actor, {
      action: "shopify.save",
      entity: "shopify_connection",
      entityId: shopDomain,
      before: existing ? { shopDomain: existing.shopDomain, windowDays: existing.windowDays, isActive: existing.isActive } : null,
      after: { shopDomain, windowDays, isActive: input.isActive, tokenChanged: !!token },
    });
  });
}

export async function shopifyStatus(orgId: string) {
  const c = await db(orgId).shopifyConnection.findFirst({ orderBy: { createdAt: "asc" }, include: { store: { select: { name: true } } } });
  if (!c) return null;
  return {
    shopDomain: c.shopDomain,
    windowDays: c.windowDays,
    isActive: c.isActive,
    storeName: c.store.name,
    syncedTo: c.syncedTo,
    lastSyncAt: c.lastSyncAt,
    lastResult: (c.lastResult ?? {}) as Partial<SyncResult>,
    lastError: c.lastError,
  };
}

/** Tie orders to members: a Thai mobile on the order, else an email that belongs to exactly one member. */
async function matchMembers(orgId: string, orders: ShopifyOrder[]): Promise<Map<string, string>> {
  const client = db(orgId);
  const phones = [...new Set(orders.map(orderPhone).filter((p): p is string => !!p))];
  const emails = [...new Set(orders.map(orderEmail).filter((e): e is string => !!e))];
  const [ids, byEmail] = await Promise.all([
    phones.length ? client.memberIdentity.findMany({ where: { type: "PHONE", value: { in: phones } }, select: { value: true, memberId: true } }) : [],
    emails.length
      ? client.member.findMany({ where: { status: "ACTIVE", email: { in: emails, mode: "insensitive" } }, select: { code: true, email: true } })
      : [],
  ]);
  const phoneMembers = ids.length
    ? await client.member.findMany({ where: { id: { in: ids.map((i) => i.memberId) }, status: "ACTIVE" }, select: { id: true, code: true } })
    : [];
  const codeOfId = new Map(phoneMembers.map((m) => [m.id, m.code]));
  const codeByPhone = new Map(ids.flatMap((i) => (codeOfId.has(i.memberId) ? [[i.value, codeOfId.get(i.memberId)!] as const] : [])));
  const emailCount = new Map<string, string[]>();
  for (const m of byEmail) {
    const e = m.email!.toLowerCase();
    emailCount.set(e, [...(emailCount.get(e) ?? []), m.code]);
  }
  const out = new Map<string, string>(); // order id → member code
  for (const o of orders) {
    const phone = orderPhone(o);
    const email = orderEmail(o);
    const code = (phone && codeByPhone.get(phone)) || (email && emailCount.get(email)?.length === 1 ? emailCount.get(email)![0] : null);
    if (code) out.set(o.id, code);
  }
  return out;
}

const iso = (d: Date) => `'${d.toISOString().replace(/\.\d{3}Z$/, "Z")}'`;

/**
 * One sync run. Safe to repeat: bills already booked are skipped as duplicates.
 * `fetchImpl` is for tests.
 */
export async function syncShopify(
  orgId: string,
  actor: Actor = SYSTEM,
  opts: { now?: Date; fetchImpl?: Fetch } = {},
): Promise<SyncResult | null> {
  const now = opts.now ?? new Date();
  const conn = await db(orgId).shopifyConnection.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  if (!conn) return null;
  const { settings } = await getOrg(orgId);

  const to = new Date(now.getTime() - conn.windowDays * DAY_MS); // orders processed up to here have settled
  const from = new Date((conn.syncedTo?.getTime() ?? to.getTime() - FIRST_RUN_DAYS * DAY_MS) - OVERLAP_MS);
  const refundsSince = new Date((conn.lastSyncAt?.getTime() ?? now.getTime() - FIRST_RUN_DAYS * DAY_MS) - OVERLAP_MS);

  try {
    const auth = { shopDomain: conn.shopDomain, accessToken: decrypt(conn.accessTokenEnc) };
    const [settled, refunded] = await Promise.all([
      fetchOrders(auth, `processed_at:>=${iso(from)} processed_at:<=${iso(to)}`, opts.fetchImpl),
      fetchOrders(auth, `updated_at:>=${iso(refundsSince)} processed_at:<${iso(from)}`, opts.fetchImpl),
    ]);
    // Older orders only contribute refunds: their SALE was booked by an earlier run
    // (or predates the first sync, and then the refund has nothing to reverse).
    const inWindow = new Set(settled.map((o) => o.id));
    const orders = [...new Map([...refunded, ...settled].map((o) => [o.id, o])).values()];
    const members = await matchMembers(orgId, orders);

    const result: SyncResult = {
      orders: orders.length,
      booked: 0,
      returns: 0,
      matched: 0,
      skipped: {},
      batchId: null,
      counts: null,
      window: { from: from.toISOString(), to: to.toISOString() },
    };
    const bills = [];
    for (const o of orders) {
      const r = orderToBills(o, { now, windowDays: conn.windowDays, memberCode: members.get(o.id) ?? null, pos: settings.pos });
      if (r.skipped) {
        result.skipped[r.skipped] = (result.skipped[r.skipped] ?? 0) + 1;
        continue;
      }
      const mine = inWindow.has(o.id) ? r.bills : r.bills.filter((b) => b.type === "RETURN");
      if (mine.some((b) => b.type === "SALE")) {
        result.booked++;
        if (members.has(o.id)) result.matched++;
      }
      result.returns += mine.filter((b) => b.type === "RETURN").length;
      bills.push(...mine);
    }

    if (bills.length) {
      const staged = await stageBatch(orgId, actor, {
        storeId: conn.storeId,
        fileName: `${conn.shopDomain} · คำสั่งซื้อถึง ${localDateKey(to)}`,
        fileHash: createHash("sha256").update(`shopify:${conn.shopDomain}:${to.toISOString()}:${now.toISOString()}`).digest("hex"),
        mode: "DAILY",
        bills,
        errors: [],
        lineCount: bills.length,
        extra: { source: "shopify", shopDomain: conn.shopDomain },
      });
      if (staged.counts.ok + staged.counts.unmatched > 0) {
        result.batchId = staged.batchId;
        result.counts = await commitImport(orgId, actor, staged.batchId);
      } else {
        // Everything was booked by an earlier run — leave no empty batch behind.
        await db(orgId).importBatch.deleteMany({ where: { id: staged.batchId, status: "PREVIEW" } });
      }
    }

    await db(orgId).shopifyConnection.updateMany({
      where: { id: conn.id },
      data: { syncedTo: to, lastSyncAt: now, lastResult: result as unknown as Prisma.InputJsonValue, lastError: null },
    });
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db(orgId).shopifyConnection.updateMany({ where: { id: conn.id }, data: { lastSyncAt: now, lastError: message.slice(0, 500) } });
    throw e;
  }
}
