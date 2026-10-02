import { beforeAll, describe, expect, it } from "vitest";
import { db, ledgerDrift, saveShopifyConnection, shopifyStatus, signUp, staffUpdateMember, syncShopify, type Fetch } from "../src";
import { makeOrg } from "./fixtures";

// Online orders from a fake Shopify: matching by phone and email, the return
// window, idempotent re-runs, and a refund after the window.

let t: Awaited<ReturnType<typeof makeOrg>>;
let byPhone = "";
let byEmail = "";

interface FakeOrder {
  name: string;
  processedAt: string;
  phone?: string;
  email?: string;
  total: number; // baht, one line
  refunds?: Array<{ id: string; createdAt: string; amount: number }>;
}
const shop: FakeOrder[] = [];
let calls = 0;

const money = (baht: number) => ({ shopMoney: { amount: baht.toFixed(2) } });
const node = (o: FakeOrder, i: number) => ({
  id: `gid://shopify/Order/${1000 + i}`,
  name: o.name,
  processedAt: o.processedAt,
  cancelledAt: null,
  test: false,
  currencyCode: "THB",
  displayFinancialStatus: o.refunds?.length ? "PARTIALLY_REFUNDED" : "PAID",
  email: o.email ?? null,
  phone: o.phone ?? null,
  billingAddress: null,
  shippingAddress: null,
  paymentGatewayNames: ["2c2p"],
  lineItems: { nodes: [{ sku: "SKU-" + o.name, name: "Item " + o.name, vendor: "PING", quantity: 1, isGiftCard: false, product: { productType: "DRIVER" }, originalUnitPriceSet: money(o.total), totalDiscountSet: money(0) }] },
  refunds: (o.refunds ?? []).map((r) => ({
    id: `gid://shopify/Refund/${r.id}`,
    createdAt: r.createdAt,
    refundLineItems: { nodes: [{ quantity: 1, subtotalSet: money(r.amount), lineItem: { sku: "SKU-" + o.name, name: "Item " + o.name } }] },
  })),
});

// Understands the two queries the sync sends.
const fakeFetch: Fetch = async (_url, init) => {
  calls++;
  const q = (JSON.parse(init.body) as { variables: { q: string } }).variables.q;
  const bound = (key: string) => {
    const m = new RegExp(`${key}'([^']+)'`).exec(q);
    return m ? new Date(m[1]!).getTime() : null;
  };
  const at = (o: FakeOrder) => new Date(o.processedAt).getTime();
  let hits: FakeOrder[];
  if (q.startsWith("processed_at:")) {
    const from = bound("processed_at:>=")!;
    const to = bound("processed_at:<=")!;
    hits = shop.filter((o) => at(o) >= from && at(o) <= to);
  } else {
    const since = bound("updated_at:>=")!;
    const before = bound("processed_at:<")!;
    hits = shop.filter((o) => at(o) < before && (o.refunds ?? []).some((r) => new Date(r.createdAt).getTime() >= since));
  }
  const nodes = hits.map((o) => node(o, shop.indexOf(o)));
  return { ok: true, status: 200, json: async () => ({ data: { orders: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } } }) };
};

const points = async (id: string) => (await db(t.orgId).member.findFirst({ where: { id } }))!.points;

beforeAll(async () => {
  t = await makeOrg("shopify");
  const a = await signUp(t.orgId, { lineUserId: "U-shop-a", channel: "LINE", fullName: "Phone Buyer", phone: "0891112233", acceptTerms: true, marketing: false });
  byPhone = a.member.id;
  const b = await signUp(t.orgId, { lineUserId: "U-shop-b", channel: "LINE", fullName: "Email Buyer", phone: "0822223333", acceptTerms: true, marketing: false });
  byEmail = b.member.id;
  await staffUpdateMember(t.orgId, t.actor, byEmail, { email: "buyer@example.com" });
  shop.push(
    { name: "#TH1001", processedAt: "2026-11-01T05:00:00Z", phone: "+66 89 111 2233", total: 20_000 },
    { name: "#TH1002", processedAt: "2026-11-02T05:00:00Z", email: "Buyer@Example.com", total: 1_000 },
    { name: "#TH1003", processedAt: "2026-11-03T05:00:00Z", phone: "0861234567", total: 500 }, // not a member
    { name: "#TH1004", processedAt: "2026-11-15T05:00:00Z", phone: "0891112233", total: 3_000 }, // settles 29 Nov
  );
});

describe("Shopify sync", () => {
  it("does nothing until a connection is saved and switched on", async () => {
    expect(await syncShopify(t.orgId, undefined, { now: new Date("2026-11-20T00:00:00Z"), fetchImpl: fakeFetch })).toBeNull();
    await expect(saveShopifyConnection(t.orgId, t.actor, { shopDomain: "mstgolf.co.th", accessToken: "shpat_x", windowDays: 14, isActive: true })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(saveShopifyConnection(t.orgId, t.actor, { shopDomain: "mst-test.myshopify.com", windowDays: 14, isActive: true })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await saveShopifyConnection(t.orgId, t.actor, { shopDomain: "https://MST-Test.myshopify.com", accessToken: "shpat_abc123", windowDays: 14, isActive: true });
    const s = await shopifyStatus(t.orgId);
    expect(s).toMatchObject({ shopDomain: "mst-test.myshopify.com", windowDays: 14, isActive: true });
    const store = await db(t.orgId).store.findFirst({ where: { code: "ONLINE" } });
    expect(store?.isActive).toBe(false); // kept out of the store pickers
    const row = await db(t.orgId).shopifyConnection.findFirst({});
    expect(row?.accessTokenEnc).not.toContain("shpat_abc123");
  });

  it("books settled orders to members by phone or email, never creating members", async () => {
    const membersBefore = await db(t.orgId).member.count();
    const r = await syncShopify(t.orgId, undefined, { now: new Date("2026-11-20T00:00:00Z"), fetchImpl: fakeFetch });
    expect(r).toMatchObject({ booked: 3, matched: 2, returns: 0 });
    expect(r?.counts).toMatchObject({ pointsAwarded: 21_000, membersCreated: 0 });
    expect(await db(t.orgId).member.count()).toBe(membersBefore);
    expect(await points(byPhone)).toBe(1600 + 20_000);
    expect(await points(byEmail)).toBe(1600 + 1_000);
    const sales = await db(t.orgId).sale.findMany({ where: { store: { code: "ONLINE" } }, orderBy: { invoiceNo: "asc" } });
    expect(sales.map((s) => s.invoiceNo)).toEqual(["#TH1001", "#TH1002", "#TH1003"]); // #TH1004 still inside its window
    expect(sales[2]!.memberId).toBeNull();
    const note = await db(t.orgId).notification.findFirst({ where: { kind: "POINTS", memberId: byPhone } });
    expect((note?.payload as { storeName?: string }).storeName).toContain("ร้านออนไลน์");
  });

  it("running again books nothing twice and leaves no empty batch", async () => {
    const batches = await db(t.orgId).importBatch.count();
    const r = await syncShopify(t.orgId, undefined, { now: new Date("2026-11-20T06:00:00Z"), fetchImpl: fakeFetch });
    expect(r?.batchId).toBeNull();
    expect(await db(t.orgId).importBatch.count()).toBe(batches);
    expect(await points(byPhone)).toBe(1600 + 20_000);
  });

  it("books orders as their window closes and reverses points for a later refund", async () => {
    shop[0]!.refunds = [{ id: "501", createdAt: "2026-11-25T03:00:00Z", amount: 10_000 }];
    const r = await syncShopify(t.orgId, undefined, { now: new Date("2026-12-01T00:00:00Z"), fetchImpl: fakeFetch });
    expect(r).toMatchObject({ booked: 1, returns: 1 });
    // +3,000 for #TH1004, −10,000 for the refund on #TH1001
    expect(await points(byPhone)).toBe(1600 + 20_000 + 3_000 - 10_000);
    const ret = await db(t.orgId).sale.findFirst({ where: { invoiceNo: "#TH1001-R501" } });
    expect(ret).toMatchObject({ type: "RETURN", refInvoiceNo: "#TH1001", netSatang: -1_000_000 });
    expect(await ledgerDrift(t.orgId)).toEqual([]);
    const s = await shopifyStatus(t.orgId);
    expect(s?.lastError).toBeNull();
    expect(s?.syncedTo?.toISOString()).toBe("2026-11-17T00:00:00.000Z");
  });

  it("records a failed run on the connection", async () => {
    const denied: Fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
    await expect(syncShopify(t.orgId, undefined, { now: new Date("2026-12-02T00:00:00Z"), fetchImpl: denied })).rejects.toMatchObject({ code: "SHOPIFY_AUTH" });
    expect((await shopifyStatus(t.orgId))?.lastError).toContain("token");
    expect(calls).toBeGreaterThan(0);
  });
});
