import { spendInWindow, tierForSpend } from "@mstgolf/shared/tiers";
import { DEMO_ORG } from "./fixture";
import type { DemoDataset } from "./fixture";
import type { EventLike, MemberLike, PurchaseItemLike } from "./types";

// Deterministic synthetic data generator. Produces ~1,240 realistic MST Golf
// members with 18 months of behavioural history from a fixed seed, so every
// page (and the Playbook) computes from ONE consistent dataset at real scale.
// Seeded PRNG (mulberry32) → identical output every run, no Math.random.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type RNG = () => number;
const pick = <T>(rng: RNG, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;
const int = (rng: RNG, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const chance = (rng: RNG, p: number) => rng() < p;
function sample<T>(rng: RNG, arr: readonly T[], n: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
  return out;
}
// Stamp a plausible shop hour onto a day, so time-of-day analytics are real.
function stamp(rng: RNG, day: Date): Date {
  const d = new Date(day);
  d.setHours(HOURS[Math.floor(rng() * HOURS.length)]!, int(rng, 0, 59), 0, 0);
  return d;
}

const FIRST = [
  "สมชาย", "ณัฐญา", "อนุชา", "ประสิทธิ์", "วนิดา", "ธนวัฒน์", "พลอย", "กิตติพงษ์", "รัชฎา", "อนันต์",
  "สิริน", "วิชัย", "อารยา", "เดชา", "อริยา", "กันตพงศ์", "สุดารัตน์", "ภาณุพงศ์", "ชนิกานต์", "ธีรภัทร",
  "ปิยะ", "มณีรัตน์", "วรพล", "ศิริพร", "อภิชาติ", "จิราพร", "นพดล", "กมลชนก", "สุรชัย", "พิมพ์ชนก",
  "เอกชัย", "รุ่งนภา", "ชัยวัฒน์", "ปวีณา", "ธนกฤต", "อรทัย", "วีรยุทธ", "นันทนา", "สมพงษ์", "เบญจวรรณ",
];
const LAST = [
  "รัตนกุล", "พงษ์ศักดิ์", "มีทรัพย์", "ชัยพร", "ศรีสุข", "บุญมี", "สุขสวัสดิ์", "ธานี", "วงศ์วิวัฒน์", "แซ่ลิ้ม",
  "เจริญพร", "ทองดี", "อินทรีย์", "สุวรรณ", "ภักดี", "ประเสริฐ", "ชูเกียรติ", "วัฒนา", "แสงทอง", "กิจเจริญ",
  "พูนสวัสดิ์", "ธนโชติ", "ไกรสร", "มงคล", "อุดมสุข", "เลิศวิไล", "ศักดิ์สิทธิ์", "จันทร์เพ็ญ", "รุ่งเรือง", "ตันติกุล",
];
const COURSES = [
  "Alpine Golf & Sports Club", "Thana City Country Club", "Riverdale Golf Club", "Nikanti Golf Club",
  "Summit Windmill Golf Club", "Bangkok Golf Club", "Thai Country Club", "Muang Kaew Golf Course",
  "Legacy Golf Club", "Royal Gems Golf City", "Panya Indra Golf Club", "Krung Kavee Golf Course",
];
const BRANDS = ["titleist", "taylormade", "callaway", "mizuno", "honma", "footjoy"] as const;
const INTERESTS = ["clubs", "apparel", "footwear", "lessons", "fitting"] as const;
const BRANCHES = ["MST สยามพารากอน", "MST เมกาบางนา", "MST ทองหล่อ", "MST เซ็นทรัลลาดพร้าว", "MST อารีนา รัชโยธิน"] as const;
const CHANNELS = ["store", "store", "store", "online", "online", "arena"] as const; // weighted toward in-store
const REWARDS = ["Pro V1 ฟรี 1 โหล", "ส่วนลด ฿400", "ฟิตติ้งฟรี 1 ชม.", "หมวก MST", "ถุงมือ FootJoy"] as const;
// Plausible shop hours (10:00–20:00), busier late morning & evening.
const HOURS = [10, 10, 11, 11, 12, 13, 14, 15, 16, 17, 17, 18, 18, 19, 19, 20] as const;

interface CatalogItem { name: string; category: string; brand?: string; price: number; }
const CATALOG: CatalogItem[] = [
  { name: "Qi10 Driver", category: "clubs", brand: "taylormade", price: 15900 },
  { name: "T100 Irons", category: "clubs", brand: "titleist", price: 18000 },
  { name: "JPX Irons", category: "clubs", brand: "mizuno", price: 14500 },
  { name: "Paradym Driver", category: "clubs", brand: "callaway", price: 15200 },
  { name: "Pro V1 (1 dozen)", category: "balls", brand: "titleist", price: 1800 },
  { name: "Chrome Soft (1 dozen)", category: "balls", brand: "callaway", price: 1600 },
  { name: "Performance Polo", category: "apparel", brand: "callaway", price: 1290 },
  { name: "Tour Jacket", category: "apparel", brand: "taylormade", price: 3800 },
  { name: "Pro/SL Shoes", category: "footwear", brand: "footjoy", price: 4800 },
  { name: "Sta-Sof Glove", category: "accessories", brand: "footjoy", price: 590 },
  { name: "Tour Bag", category: "accessories", brand: "titleist", price: 8900 },
];

type ProfileName = "champion" | "loyal" | "potential" | "new" | "at_risk" | "dormant" | "regular";
interface ProfileSpec {
  name: ProfileName;
  weight: number;
  lastSeen: [number, number]; // days ago
  orders: [number, number];
  aov: [number, number]; // avg order value THB
  tenure: [number, number]; // months as member
  visits: [number, number];
}
const PROFILES: ProfileSpec[] = [
  { name: "champion", weight: 20, lastSeen: [0, 14], orders: [4, 9], aov: [8000, 20000], tenure: [8, 18], visits: [4, 12] },
  { name: "loyal", weight: 120, lastSeen: [5, 45], orders: [2, 5], aov: [3000, 8000], tenure: [6, 18], visits: [2, 8] },
  { name: "potential", weight: 100, lastSeen: [15, 70], orders: [1, 3], aov: [2000, 6000], tenure: [3, 14], visits: [1, 5] },
  { name: "new", weight: 80, lastSeen: [0, 25], orders: [0, 1], aov: [1500, 4000], tenure: [0, 2], visits: [1, 3] },
  { name: "at_risk", weight: 120, lastSeen: [95, 165], orders: [1, 4], aov: [2500, 9000], tenure: [6, 18], visits: [0, 3] },
  { name: "dormant", weight: 250, lastSeen: [190, 520], orders: [0, 2], aov: [1500, 5000], tenure: [8, 18], visits: [0, 2] },
  { name: "regular", weight: 310, lastSeen: [30, 120], orders: [0, 2], aov: [1500, 5000], tenure: [2, 16], visits: [0, 4] },
];

// Profiles that represent an actively-engaged customer — these keep purchasing
// into the recent window so month-over-month revenue stays healthy.
const ACTIVE_PROFILES = new Set<ProfileName>(["champion", "loyal", "potential", "new"]);

const TARGET = 1240;
const DAY = 24 * 60 * 60 * 1000;
const MONTH = 30 * DAY;

/**
 * Generates the full synthetic dataset (deterministic). Members carry a golf
 * profile (incl. birthdayMonth) and 18 months of PURCHASE/VISIT/FITTING/CLICK
 * events, so RFM, CLV, churn, cohort, affinity, segments, and the Playbook all
 * resolve to consistent, real numbers.
 */
export function generateDataset(now: Date, seed = 42): DemoDataset {
  const rng = mulberry32(seed);
  const members: MemberLike[] = [];
  const events: EventLike[] = [];

  // Build a weighted profile bag.
  const bag: ProfileSpec[] = [];
  const totalWeight = PROFILES.reduce((s, p) => s + p.weight, 0);
  for (const p of PROFILES) {
    const n = Math.round((p.weight / totalWeight) * TARGET);
    for (let i = 0; i < n; i++) bag.push(p);
  }

  for (let i = 0; i < bag.length; i++) {
    const spec = bag[i]!;
    const id = `m_${String(i + 1).padStart(4, "0")}`;
    const displayName = `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
    const tenureMonths = int(rng, spec.tenure[0], spec.tenure[1]);
    const createdAt = new Date(now.getTime() - tenureMonths * MONTH - int(rng, 0, 28) * DAY);
    const lastSeenDays = int(rng, spec.lastSeen[0], spec.lastSeen[1]);
    const lastSeenAt = new Date(now.getTime() - lastSeenDays * DAY);

    const skill = pick(rng, ["beginner", "intermediate", "advanced", "pro"] as const);
    const brands = sample(rng, BRANDS, int(rng, 1, 3));
    const interests = sample(rng, INTERESTS, int(rng, 1, 3));
    const attributes: Record<string, unknown> = {
      handicap: int(rng, 2, 30),
      dominantHand: chance(rng, 0.12) ? "left" : "right",
      skillLevel: skill,
      preferredBrands: brands,
      interests,
      playFrequency: pick(rng, ["weekly", "monthly", "occasionally"] as const),
      birthdayMonth: int(rng, 1, 12),
    };
    if (chance(rng, 0.7)) attributes.homeCourse = pick(rng, COURSES);

    // Purchases → spend → points → tier.
    let totalSpend = 0;
    const memberEvents: EventLike[] = [];
    // One order stamped at a given time: builds a realistic basket, nudges to
    // the profile's AOV, and writes PURCHASE + matching EARN_POINTS ledger rows.
    const pushOrder = (at: Date) => {
      const nItems = int(rng, 1, 3);
      const items: PurchaseItemLike[] = [];
      let amount = 0;
      for (let k = 0; k < nItems; k++) {
        // bias toward the member's preferred brands
        const pool = CATALOG.filter((c) => !c.brand || brands.includes(c.brand as (typeof BRANDS)[number]));
        const cat = pick(rng, pool.length ? pool : CATALOG);
        const qty = cat.category === "balls" || cat.category === "accessories" ? int(rng, 1, 3) : 1;
        const line = cat.price * qty;
        amount += line;
        items.push({ name: cat.name, category: cat.category, brand: cat.brand, qty, unitPrice: cat.price });
      }
      const target = int(rng, spec.aov[0], spec.aov[1]);
      amount = Math.round((amount + target) / 2);
      totalSpend += amount;
      const branch = pick(rng, BRANCHES);
      const channel = pick(rng, CHANNELS);
      const when = stamp(rng, at);
      memberEvents.push({
        memberId: id, type: "PURCHASE", occurredAt: when,
        payload: { amount, currency: DEMO_ORG.currency, channel, branch, items },
      });
      memberEvents.push({
        memberId: id, type: "EARN_POINTS", occurredAt: when,
        payload: { delta: Math.round(amount * DEMO_ORG.perCurrencyUnit * 100), branch },
      });
    };

    const nOrders = int(rng, spec.orders[0], spec.orders[1]);
    for (let o = 0; o < nOrders; o++) {
      // spread historical orders between signup and last seen
      const span = Math.max(1, lastSeenAt.getTime() - createdAt.getTime());
      pushOrder(new Date(createdAt.getTime() + rng() * span));
    }

    // Steady recent demand: still-engaged customers keep buying right up to now,
    // so the trailing months reflect an ongoing healthy shop instead of decaying
    // to zero. Churned/dormant profiles are intentionally excluded — their
    // silence is the signal the CRM is meant to surface.
    if (ACTIVE_PROFILES.has(spec.name)) {
      const extra = int(rng, 1, spec.name === "champion" ? 4 : spec.name === "loyal" ? 3 : 2);
      for (let o = 0; o < extra; o++) {
        const maxBack = Math.min(80, Math.floor((now.getTime() - createdAt.getTime()) / DAY));
        if (maxBack < 1) break;
        pushOrder(new Date(now.getTime() - int(rng, 0, maxBack) * DAY));
      }
    }

    const points = Math.round(totalSpend + (spec.name === "new" ? DEMO_ORG.signupBonus : int(rng, 0, 800)));
    // Tier follows the last 12 months of spend, not the points balance.
    const spend12m = spendInWindow(
      memberEvents
        .filter((e) => e.type === "PURCHASE")
        .map((e) => ({ amount: Number(e.payload?.amount ?? 0), at: e.occurredAt })),
      now,
    );
    const tier = tierForSpend(spend12m, DEMO_ORG.tiers).name;

    members.push({ id, displayName, tier, points, lastSeenAt, createdAt, attributes, phone: `+66${int(rng, 810000000, 899999999)}` });

    // Behavioural events.
    events.push({ memberId: id, type: "REGISTER", occurredAt: stamp(rng, createdAt) });
    events.push(...memberEvents);
    const homeBranch = pick(rng, BRANCHES);
    const nVisits = int(rng, spec.visits[0], spec.visits[1]);
    for (let v = 0; v < nVisits; v++) {
      const at = stamp(rng, new Date(lastSeenAt.getTime() - int(rng, 0, 40) * DAY));
      events.push({ memberId: id, type: "VISIT", occurredAt: at, payload: { branch: homeBranch } });
    }
    // QR check-ins at the counter.
    if (chance(rng, 0.4)) {
      for (let s = 0, ns = int(rng, 1, 3); s < ns; s++) {
        events.push({ memberId: id, type: "SCAN_QR", occurredAt: stamp(rng, new Date(lastSeenAt.getTime() - int(rng, 0, 50) * DAY)), payload: { branch: homeBranch } });
      }
    }
    // Rich-menu opens in LINE.
    if (chance(rng, 0.55)) {
      for (let o = 0, no = int(rng, 1, 4); o < no; o++) {
        events.push({ memberId: id, type: "OPEN_MENU", occurredAt: stamp(rng, new Date(lastSeenAt.getTime() - int(rng, 0, 30) * DAY)) });
      }
    }
    // Reward redemptions for members with enough points.
    if (points > 4000 && chance(rng, 0.22)) {
      events.push({
        memberId: id, type: "REDEEM_POINTS",
        occurredAt: stamp(rng, new Date(lastSeenAt.getTime() - int(rng, 0, 40) * DAY)),
        payload: { reward: pick(rng, REWARDS), delta: -int(rng, 4, 12) * 1000, branch: homeBranch },
      });
    }
    if (chance(rng, 0.14)) {
      events.push({ memberId: id, type: "FITTING_BOOKING", occurredAt: stamp(rng, new Date(lastSeenAt.getTime() - int(rng, 0, 60) * DAY)), payload: { branch: homeBranch } });
    }
    if (chance(rng, 0.3)) {
      events.push({ memberId: id, type: "CLICK_PROMO", occurredAt: stamp(rng, new Date(lastSeenAt.getTime() - int(rng, 0, 20) * DAY)) });
    }
  }

  return { org: DEMO_ORG, members, events };
}
