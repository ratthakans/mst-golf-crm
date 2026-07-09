import type { EventLike, FieldDefinitionLike, MemberLike } from "./types";

// MST Golf demo dataset (Bangkok, Thailand) — mirrors the seed so the app can
// render a realistic picture and accept new sign-ups WITHOUT a database.
// The same shapes come out of the live DB via Prisma. Amounts are in THB.

export interface DemoOrg {
  name: string;
  slug: string;
  currency: string;
  brandColor: string;
  churnDays: number;
  signupBonus: number;
  perCurrencyUnit: number; // points earned per 1 unit spent
  consentText: string;
  tiers: Array<{ name: string; minPoints: number }>;
}

export interface DemoDataset {
  org: DemoOrg;
  members: MemberLike[];
  events: EventLike[];
}

export const DEMO_ORG: DemoOrg = {
  name: "MST Golf",
  slug: "mst-golf",
  currency: "THB",
  brandColor: "#0a5c36",
  churnDays: 90,
  signupBonus: 1600,
  perCurrencyUnit: 0.01,
  consentText:
    "ข้าพเจ้ายินยอมให้ MST Golf เก็บและใช้ข้อมูลส่วนบุคคลของข้าพเจ้าเพื่อการเป็นสมาชิก การตลาด และการให้บริการ ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)",
  tiers: [
    { name: "Silver", minPoints: 0 },
    { name: "Gold", minPoints: 16000 },
    { name: "Platinum", minPoints: 40000 },
  ],
};

// The 7 golf-profile fields collected on sign-up (mirror of seed FieldDefinition).
export const DEMO_FIELD_DEFINITIONS: FieldDefinitionLike[] = [
  { key: "handicap", label: "แฮนดิแคป", type: "NUMBER", required: false, options: [], group: "golf_profile", order: 1 },
  {
    key: "dominantHand", label: "มือถนัด", type: "SELECT", required: true, group: "golf_profile", order: 2,
    options: [ { value: "right", label: "ขวา" }, { value: "left", label: "ซ้าย" } ],
  },
  {
    key: "skillLevel", label: "ระดับฝีมือ", type: "SELECT", required: false, group: "golf_profile", order: 3,
    options: [
      { value: "beginner", label: "มือใหม่" }, { value: "intermediate", label: "ปานกลาง" },
      { value: "advanced", label: "ขั้นสูง" }, { value: "pro", label: "มืออาชีพ" },
    ],
  },
  {
    key: "preferredBrands", label: "แบรนด์ที่ชอบ", type: "MULTISELECT", required: false, group: "golf_profile", order: 4,
    options: [
      { value: "taylormade", label: "TaylorMade" }, { value: "callaway", label: "Callaway" },
      { value: "titleist", label: "Titleist" }, { value: "honma", label: "Honma" },
      { value: "mizuno", label: "Mizuno" }, { value: "footjoy", label: "FootJoy" },
    ],
  },
  {
    key: "interests", label: "ความสนใจ", type: "MULTISELECT", required: false, group: "golf_profile", order: 5,
    options: [
      { value: "clubs", label: "ไม้กอล์ฟ" }, { value: "apparel", label: "เสื้อผ้า" },
      { value: "footwear", label: "รองเท้า" }, { value: "lessons", label: "เรียนกอล์ฟ" },
      { value: "fitting", label: "ฟิตติ้ง" },
    ],
  },
  { key: "homeCourse", label: "สนามประจำ", type: "TEXT", required: false, options: [], group: "golf_profile", order: 6 },
  {
    key: "playFrequency", label: "ความถี่ในการเล่น", type: "SELECT", required: false, group: "golf_profile", order: 7,
    options: [
      { value: "weekly", label: "ทุกสัปดาห์" }, { value: "monthly", label: "ทุกเดือน" },
      { value: "occasionally", label: "นานๆ ครั้ง" },
    ],
  },
];

export function tierForPoints(points: number, tiers: DemoOrg["tiers"]): string {
  let name = tiers[0]?.name ?? "Silver";
  for (const t of tiers) if (points >= t.minPoints) name = t.name;
  return name;
}

/** Points earned for a purchase amount, per the org's points config. */
export function pointsForAmount(amount: number, perCurrencyUnit: number): number {
  // perCurrencyUnit is "points per 1 currency unit" scaled ×100 (config convention).
  return Math.round(amount * perCurrencyUnit * 100);
}

interface PurchaseSpec {
  daysAgo: number;
  amount: number;
  items: Array<{ name: string; category: string; brand?: string; qty: number; unitPrice: number }>;
}

interface MemberSpec {
  id: string;
  displayName: string;
  phone: string;
  tier: string;
  points: number;
  lastSeenDays: number;
  attributes: Record<string, unknown>;
  purchases: PurchaseSpec[];
  visits: number[];
  fittings: number[];
  redeems: Array<{ daysAgo: number; delta: number; reward: string }>;
  clicks: number[];
}

const MEMBER_SPECS: MemberSpec[] = [
  {
    id: "U_champion_001", displayName: "Somchai Rattanakul", phone: "+66811112201",
    tier: "Platinum", points: 43200, lastSeenDays: 2,
    attributes: {
      handicap: 6, dominantHand: "right", skillLevel: "advanced",
      preferredBrands: ["titleist", "taylormade"], interests: ["clubs", "fitting"],
      homeCourse: "Alpine Golf & Sports Club", playFrequency: "weekly",
    },
    purchases: [
      { daysAgo: 2, amount: 15192, items: [{ name: "Qi10 Driver", category: "clubs", brand: "TaylorMade", qty: 1, unitPrice: 15192 }] },
      { daysAgo: 20, amount: 5120, items: [
        { name: "Pro V1 (2 dozen)", category: "balls", brand: "Titleist", qty: 1, unitPrice: 3200 },
        { name: "Sta-Sof Glove", category: "accessories", brand: "FootJoy", qty: 2, unitPrice: 960 },
      ] },
      { daysAgo: 55, amount: 17600, items: [
        { name: "T100 Irons", category: "clubs", brand: "Titleist", qty: 1, unitPrice: 14400 },
        { name: "Tour Glove", category: "accessories", brand: "FootJoy", qty: 2, unitPrice: 1600 },
      ] },
    ],
    visits: [5, 15, 40], fittings: [3], redeems: [{ daysAgo: 30, delta: -4000, reward: "Pro V1 (1 dozen)" }], clicks: [8, 25],
  },
  {
    id: "U_loyal_002", displayName: "Nattaya Phongsak", phone: "+66811112202",
    tier: "Gold", points: 20800, lastSeenDays: 10,
    attributes: {
      handicap: 14, dominantHand: "right", skillLevel: "intermediate",
      preferredBrands: ["callaway", "footjoy"], interests: ["apparel", "footwear", "lessons"],
      homeCourse: "Thana City Country Club", playFrequency: "monthly",
    },
    purchases: [
      { daysAgo: 10, amount: 3600, items: [
        { name: "Pro/SL Shoes", category: "footwear", brand: "FootJoy", qty: 1, unitPrice: 2400 },
        { name: "Performance Polo", category: "apparel", brand: "Callaway", qty: 1, unitPrice: 1200 },
      ] },
      { daysAgo: 70, amount: 6240, items: [
        { name: "Rain Jacket", category: "apparel", brand: "Callaway", qty: 1, unitPrice: 3840 },
        { name: "Golf Shoes", category: "footwear", brand: "FootJoy", qty: 1, unitPrice: 2400 },
      ] },
    ],
    visits: [12, 45], fittings: [], redeems: [], clicks: [11],
  },
  {
    id: "U_new_003", displayName: "Anucha Meesap", phone: "+66811112203",
    tier: "Silver", points: 1600, lastSeenDays: 1,
    attributes: {
      handicap: 24, dominantHand: "left", skillLevel: "beginner",
      preferredBrands: ["honma"], interests: ["clubs", "lessons"], playFrequency: "occasionally",
    },
    purchases: [],
    visits: [1], fittings: [], redeems: [], clicks: [1],
  },
  {
    id: "U_atrisk_004", displayName: "Prasit Chaiyaphon", phone: "+66811112204",
    tier: "Gold", points: 16800, lastSeenDays: 120,
    attributes: {
      handicap: 11, dominantHand: "right", skillLevel: "advanced",
      preferredBrands: ["mizuno", "titleist"], interests: ["clubs", "fitting"],
      homeCourse: "Riverdale Golf Club", playFrequency: "monthly",
    },
    purchases: [
      { daysAgo: 120, amount: 2560, items: [
        { name: "Sta-Sof Glove", category: "accessories", brand: "FootJoy", qty: 2, unitPrice: 480 },
        { name: "Pro V1 (1 dozen)", category: "balls", brand: "Titleist", qty: 2, unitPrice: 800 },
      ] },
      { daysAgo: 200, amount: 12000, items: [{ name: "JPX Irons", category: "clubs", brand: "Mizuno", qty: 1, unitPrice: 12000 }] },
    ],
    visits: [125], fittings: [130], redeems: [], clicks: [],
  },
  {
    id: "U_dormant_005", displayName: "Wanida Srisuk", phone: "+66811112205",
    tier: "Silver", points: 2800, lastSeenDays: 260,
    attributes: {
      handicap: 20, dominantHand: "right", skillLevel: "beginner",
      preferredBrands: ["callaway"], interests: ["apparel"], playFrequency: "occasionally",
    },
    purchases: [
      { daysAgo: 260, amount: 1680, items: [{ name: "Ladies Polo", category: "apparel", brand: "Callaway", qty: 1, unitPrice: 1680 }] },
    ],
    visits: [265], fittings: [], redeems: [], clicks: [],
  },
];

export function buildDemoDataset(now: Date): DemoDataset {
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  const members: MemberLike[] = [];
  const events: EventLike[] = [];

  for (const spec of MEMBER_SPECS) {
    const createdAt = daysAgo(spec.lastSeenDays + 1);
    members.push({
      id: spec.id,
      displayName: spec.displayName,
      phone: spec.phone,
      tier: spec.tier,
      points: spec.points,
      lastSeenAt: daysAgo(spec.lastSeenDays),
      createdAt,
      attributes: spec.attributes,
    });

    events.push({ memberId: spec.id, type: "REGISTER", occurredAt: createdAt });
    for (const p of spec.purchases) {
      events.push({
        memberId: spec.id,
        type: "PURCHASE",
        occurredAt: daysAgo(p.daysAgo),
        payload: { amount: p.amount, currency: DEMO_ORG.currency, channel: "store", items: p.items },
      });
    }
    for (const d of spec.visits) {
      events.push({ memberId: spec.id, type: "VISIT", occurredAt: daysAgo(d) });
    }
    for (const d of spec.fittings) {
      events.push({ memberId: spec.id, type: "FITTING_BOOKING", occurredAt: daysAgo(d) });
    }
    for (const r of spec.redeems) {
      events.push({
        memberId: spec.id, type: "REDEEM_POINTS", occurredAt: daysAgo(r.daysAgo),
        payload: { delta: r.delta, reward: r.reward },
      });
    }
    for (const d of spec.clicks) {
      events.push({ memberId: spec.id, type: "CLICK_PROMO", occurredAt: daysAgo(d) });
    }
  }

  return { org: DEMO_ORG, members, events };
}
