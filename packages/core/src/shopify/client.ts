import { CoreError } from "../errors";
import type { ShopifyOrder } from "./orders";

// Read-only Shopify Admin GraphQL client for orders. Needs a custom app on the
// shop with read_orders and protected customer data (email, phone) — see
// docs/th-commerce/INTEGRATION.md. Nothing here writes to the shop.

export const SHOPIFY_API_VERSION = "2025-07";

export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface ShopifyAuth {
  shopDomain: string;
  accessToken: string;
}

const ORDERS_QUERY = /* GraphQL */ `
  query Orders($q: String!, $after: String) {
    orders(first: 10, after: $after, query: $q, sortKey: PROCESSED_AT) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        processedAt
        cancelledAt
        test
        currencyCode
        displayFinancialStatus
        email
        phone
        billingAddress { phone }
        shippingAddress { phone }
        paymentGatewayNames
        lineItems(first: 50) {
          nodes {
            sku
            name
            vendor
            quantity
            isGiftCard
            product { productType }
            originalUnitPriceSet { shopMoney { amount } }
            totalDiscountSet { shopMoney { amount } }
          }
        }
        refunds {
          id
          createdAt
          refundLineItems(first: 20) {
            nodes {
              quantity
              subtotalSet { shopMoney { amount } }
              lineItem { sku name }
            }
          }
        }
      }
    }
  }
`;

interface Money { shopMoney: { amount: string } }
interface OrderNode {
  id: string;
  name: string;
  processedAt: string;
  cancelledAt: string | null;
  test: boolean;
  currencyCode: string;
  displayFinancialStatus: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: { phone: string | null } | null;
  shippingAddress: { phone: string | null } | null;
  paymentGatewayNames: string[];
  lineItems: {
    nodes: Array<{
      sku: string | null;
      name: string;
      vendor: string | null;
      quantity: number;
      isGiftCard: boolean;
      product: { productType: string | null } | null;
      originalUnitPriceSet: Money;
      totalDiscountSet: Money;
    }>;
  };
  refunds: Array<{
    id: string;
    createdAt: string;
    refundLineItems: { nodes: Array<{ quantity: number; subtotalSet: Money; lineItem: { sku: string | null; name: string } }> };
  }>;
}
interface OrdersResponse {
  data?: { orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: OrderNode[] } };
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

const tail = (gid: string) => gid.slice(gid.lastIndexOf("/") + 1);

export function toShopifyOrder(n: OrderNode): ShopifyOrder {
  return {
    id: tail(n.id),
    name: n.name,
    processedAt: n.processedAt,
    cancelledAt: n.cancelledAt,
    test: n.test,
    currencyCode: n.currencyCode,
    financialStatus: n.displayFinancialStatus,
    email: n.email,
    phones: [n.phone, n.billingAddress?.phone, n.shippingAddress?.phone].filter((p): p is string => !!p),
    gateways: n.paymentGatewayNames ?? [],
    lines: n.lineItems.nodes.map((l) => ({
      sku: l.sku,
      name: l.name,
      vendor: l.vendor,
      productType: l.product?.productType ?? null,
      quantity: l.quantity,
      unitPrice: l.originalUnitPriceSet.shopMoney.amount,
      discount: l.totalDiscountSet.shopMoney.amount,
      giftCard: l.isGiftCard,
    })),
    refunds: n.refunds.map((r) => ({
      id: tail(r.id),
      createdAt: r.createdAt,
      lines: r.refundLineItems.nodes.map((x) => ({
        sku: x.lineItem.sku,
        name: x.lineItem.name,
        quantity: x.quantity,
        subtotal: x.subtotalSet.shopMoney.amount,
      })),
    })),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Every order matching a Shopify search query, e.g. "processed_at:>='2026-10-01T00:00:00Z'". */
export async function fetchOrders(auth: ShopifyAuth, query: string, fetchImpl: Fetch = fetch as unknown as Fetch): Promise<ShopifyOrder[]> {
  const url = `https://${auth.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const out: ShopifyOrder[] = [];
  let after: string | null = null;
  for (let page = 0; page < 500; page++) {
    let body: OrdersResponse | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": auth.accessToken },
        body: JSON.stringify({ query: ORDERS_QUERY, variables: { q: query, after } }),
      });
      if (res.status === 401 || res.status === 403) {
        throw new CoreError("SHOPIFY_AUTH", "Shopify ปฏิเสธ token — ตรวจ Admin API token และสิทธิ์ read_orders ของแอป");
      }
      if (res.status === 429 || res.status >= 500) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new CoreError("SHOPIFY_ERROR", `Shopify ตอบกลับ ${res.status}`);
      const json = (await res.json()) as OrdersResponse;
      if (json.errors?.some((e) => e.extensions?.code === "THROTTLED")) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (json.errors?.length) {
        const denied = json.errors.some((e) => e.extensions?.code === "ACCESS_DENIED");
        throw new CoreError(
          denied ? "SHOPIFY_AUTH" : "SHOPIFY_ERROR",
          denied ? "แอปยังไม่ได้สิทธิ์อ่านคำสั่งซื้อหรือข้อมูลลูกค้า (protected customer data)" : `Shopify: ${json.errors[0]!.message}`,
        );
      }
      body = json;
      break;
    }
    if (!body?.data) throw new CoreError("SHOPIFY_ERROR", "Shopify ไม่ตอบสนอง — ลองใหม่ภายหลัง");
    out.push(...body.data.orders.nodes.map(toShopifyOrder));
    if (!body.data.orders.pageInfo.hasNextPage) return out;
    after = body.data.orders.pageInfo.endCursor;
  }
  throw new CoreError("SHOPIFY_ERROR", "คำสั่งซื้อมากเกินไปในรอบเดียว — ลดช่วงเวลา");
}
