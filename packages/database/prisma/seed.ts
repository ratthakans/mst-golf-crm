import { PrismaClient, Prisma } from "@prisma/client";
import type { OrgSettings } from "@mstgolf/shared";
import { hashPassword } from "@mstgolf/shared/password";
import { DEFAULT_TIERS } from "@mstgolf/shared/tiers";
import { DEFAULT_AUTOMATIONS } from "@mstgolf/analytics";
import { databaseUrl } from "../src/index";

// Seeds the MST Golf org with its Phase 1 configuration: settings, the Charn
// Issara Tower 1 store, three simulator lanes, PDPA consent texts, profile
// fields and the first Super Admin. Safe to re-run: settings MST has changed in
// the back office are kept (defaults only fill gaps).
//
// Demo members, sales and bookings are NOT created here — run
//   pnpm --filter @mstgolf/core demo
// against a dev/preview schema for that.

const prisma = new PrismaClient({ datasourceUrl: databaseUrl() });

async function main() {
  const defaults: OrgSettings = {
    productName: "MST Golf Platform",
    brandColor: "#0a5c36",
    locale: "th",
    currency: "THB",
    timezone: "Asia/Bangkok",
    businessType: "pro_shop",
    // 1 point per baht before the tier's rate; 1,600 welcome points (flow page 07).
    points: { perBaht: 1, signupBonus: 1600, birthdayBonus: 0, expiryMonths: 12 },
    tiers: DEFAULT_TIERS,
    rewards: [],
    features: {
      intelligence: false, // Action Plan, Segments, Automations, AI brief — outside the Phase 1 contract
      booking: true,
      fitting: true,
      tradeIn: false,
      referral: false,
      events: false,
      coupons: false,
    },
    messaging: {
      welcome: "ยินดีต้อนรับสู่ MST Golf",
      consentText: "",
    },
    crm: { churnDays: 90, welcomeDiscountPercent: 0 },
    booking: {
      slotMinutes: 60,
      holdMinutes: 5,
      maxSlotsPerDay: 2,
      maxUpcoming: 4,
      cancelHoursBefore: 2,
      noShowGraceMinutes: 15,
      reminderHoursBefore: 2,
    },
    notifications: {
      WELCOME: true,
      POINTS: true,
      TIER_UP: true,
      BOOKING_CONFIRMED: true,
      BOOKING_REMINDER: true,
      BOOKING_CANCELLED: true,
      BOOKING_MOVED: true,
    },
    pos: { memberTag: "MSTMEMBER", pointExcludedSkus: [], pointExcludedCategories: [] },
    site: { address: "ชาญอิสสระ ทาวเวอร์ 1 ถนนพระราม 4 กรุงเทพฯ" },
  };

  const existing = await prisma.organization.findUnique({ where: { slug: "mst-golf" } });
  const current = (existing?.settings ?? {}) as Partial<OrgSettings>;
  // Stored values win; the old pre-v2 point rule (0.01/baht) is replaced.
  const merged: OrgSettings = {
    ...defaults,
    ...current,
    points: current.points && current.points.perBaht >= 0.5 ? current.points : defaults.points,
    features: { ...defaults.features, ...(current.features ?? {}) },
    booking: { ...defaults.booking!, ...(current.booking ?? {}) },
    notifications: { ...defaults.notifications!, ...(current.notifications ?? {}) },
    pos: { ...defaults.pos!, ...(current.pos ?? {}) },
    site: { ...defaults.site, ...(current.site ?? {}) },
  };
  delete (merged as Partial<OrgSettings>).richMenu; // one Rich Menu, owned by the LINE agency

  const org = await prisma.organization.upsert({
    where: { slug: "mst-golf" },
    update: { settings: merged as unknown as Prisma.InputJsonValue },
    create: { name: "MST Golf", slug: "mst-golf", plan: "GROWTH", settings: merged as unknown as Prisma.InputJsonValue },
  });

  // -------------------------------------------------------------------------
  // Store and simulator lanes. Opening hours are a placeholder until MST
  // confirms them (docs/PRODUCT.md §6 #3) — editable in Settings.
  // -------------------------------------------------------------------------
  const hours: [string, string] = ["10:00", "22:00"];
  const store = await prisma.store.upsert({
    where: { orgId_code: { orgId: org.id, code: "CIT1" } },
    update: {},
    create: {
      orgId: org.id,
      code: "CIT1",
      name: "MST Golf ชาญอิสสระ ทาวเวอร์ 1",
      address: "ชาญอิสสระ ทาวเวอร์ 1 ถนนพระราม 4 กรุงเทพฯ",
      openHours: { mon: hours, tue: hours, wed: hours, thu: hours, fri: hours, sat: hours, sun: hours },
    },
  });
  if ((await prisma.lane.count({ where: { orgId: org.id } })) === 0) {
    await prisma.lane.createMany({
      data: [1, 2, 3].map((n) => ({
        orgId: org.id,
        storeId: store.id,
        name: `Lane ${n}`,
        capacity: 3,
        hourlyPriceSatang: 100_000, // ฿1,000 / hour
        sortOrder: n,
      })),
    });
  }

  // -------------------------------------------------------------------------
  // PDPA consent wording, version 1 (a template for MST's legal review).
  // -------------------------------------------------------------------------
  const consentV1 = [
    {
      purpose: "TERMS" as const,
      title: "ข้อกำหนดสมาชิกและนโยบายความเป็นส่วนตัว",
      body:
        "ข้าพเจ้ายอมรับข้อกำหนดการเป็นสมาชิก MST Golf และยินยอมให้ MST Golf Thailand เก็บ ใช้ และประมวลผลข้อมูลส่วนบุคคลของข้าพเจ้า ได้แก่ ชื่อ เบอร์โทรศัพท์ วันเกิด อีเมล บัญชี LINE ประวัติการซื้อและการจอง เพื่อให้บริการสมาชิก สะสมแต้ม จัดระดับสมาชิก แจ้งแต้มและการจองผ่าน LINE ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ข้าพเจ้าขอเข้าถึง แก้ไข หรือลบข้อมูลได้โดยติดต่อร้าน",
    },
    {
      purpose: "MARKETING" as const,
      title: "รับข่าวสารและโปรโมชั่น",
      body: "ข้าพเจ้ายินยอมรับข่าวสาร โปรโมชั่น และข้อเสนอพิเศษจาก MST Golf ผ่าน LINE และช่องทางอื่น ยกเลิกได้ทุกเมื่อในหน้าโปรไฟล์สมาชิก",
    },
  ];
  for (const c of consentV1) {
    await prisma.consentText.upsert({
      where: { orgId_purpose_version: { orgId: org.id, purpose: c.purpose, version: "v1" } },
      update: {},
      create: { orgId: org.id, purpose: c.purpose, version: "v1", title: c.title, body: c.body, effectiveAt: new Date("2026-09-01T00:00:00+07:00") },
    });
  }

  // Member codes start at MST00000001.
  await prisma.counter.upsert({
    where: { orgId_key: { orgId: org.id, key: "member_code" } },
    update: {},
    create: { orgId: org.id, key: "member_code", value: 0 },
  });

  // -------------------------------------------------------------------------
  // First Super Admin — from ADMIN_EMAIL / ADMIN_PASSWORD. Never a default
  // password: without the env vars the step is skipped (use admin:create).
  // -------------------------------------------------------------------------
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    await prisma.user.upsert({
      where: { orgId_email: { orgId: org.id, email: adminEmail } },
      update: {},
      create: { orgId: org.id, email: adminEmail, name: "ผู้ดูแลระบบ", role: "SUPER_ADMIN", passwordHash: await hashPassword(adminPassword) },
    });
  } else {
    console.warn("[seed] ADMIN_EMAIL / ADMIN_PASSWORD not set — no admin created. Run: pnpm --filter @mstgolf/database admin:create <email>");
  }

  // -------------------------------------------------------------------------
  // Field definitions (golf_profile group — drives the dynamic signup form)
  // -------------------------------------------------------------------------
  const fields: Array<{
    key: string;
    label: string;
    type: "TEXT" | "NUMBER" | "SELECT" | "MULTISELECT" | "BOOLEAN" | "DATE";
    required?: boolean;
    options?: Array<{ value: string; label: string }>;
    order: number;
  }> = [
    { key: "handicap", label: "Handicap", type: "NUMBER", order: 1 },
    {
      key: "dominantHand",
      label: "Dominant Hand",
      type: "SELECT",
      required: true,
      options: [
        { value: "right", label: "Right" },
        { value: "left", label: "Left" },
      ],
      order: 2,
    },
    {
      key: "skillLevel",
      label: "Skill Level",
      type: "SELECT",
      options: [
        { value: "beginner", label: "Beginner" },
        { value: "intermediate", label: "Intermediate" },
        { value: "advanced", label: "Advanced" },
        { value: "pro", label: "Pro" },
      ],
      order: 3,
    },
    {
      key: "preferredBrands",
      label: "Preferred Brands",
      type: "MULTISELECT",
      options: [
        { value: "taylormade", label: "TaylorMade" },
        { value: "callaway", label: "Callaway" },
        { value: "titleist", label: "Titleist" },
        { value: "honma", label: "Honma" },
        { value: "mizuno", label: "Mizuno" },
        { value: "footjoy", label: "FootJoy" },
      ],
      order: 4,
    },
    {
      key: "interests",
      label: "Interests",
      type: "MULTISELECT",
      options: [
        { value: "clubs", label: "Clubs" },
        { value: "apparel", label: "Apparel" },
        { value: "footwear", label: "Footwear" },
        { value: "lessons", label: "Lessons" },
        { value: "fitting", label: "Fitting" },
      ],
      order: 5,
    },
    { key: "homeCourse", label: "Home Course", type: "TEXT", order: 6 },
    {
      key: "playFrequency",
      label: "Play Frequency",
      type: "SELECT",
      options: [
        { value: "weekly", label: "Weekly" },
        { value: "monthly", label: "Monthly" },
        { value: "occasionally", label: "Occasionally" },
      ],
      order: 7,
    },
  ];

  for (const f of fields) {
    await prisma.fieldDefinition.upsert({
      where: { orgId_entity_key: { orgId: org.id, entity: "MEMBER", key: f.key } },
      update: {
        label: f.label,
        type: f.type,
        required: f.required ?? false,
        options: (f.options ?? []) as unknown as Prisma.InputJsonValue,
        group: "golf_profile",
        order: f.order,
      },
      create: {
        orgId: org.id,
        entity: "MEMBER",
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required ?? false,
        options: (f.options ?? []) as unknown as Prisma.InputJsonValue,
        group: "golf_profile",
        order: f.order,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Dynamic segments (rule-based audiences — resolved by the segment engine)
  // -------------------------------------------------------------------------
  const segments: Array<{ name: string; description: string; rules: Prisma.InputJsonValue }> = [
    {
      name: "Champions",
      description: "Best customers — recent, frequent, high spend",
      rules: { all: [{ field: "rfmSegment", op: "eq", value: "Champion" }] },
    },
    {
      name: "High churn risk",
      description: "Likely to lapse — prioritise win-back",
      rules: { all: [{ field: "churnProbability", op: "gte", value: 0.7 }] },
    },
    {
      name: "Titleist fans",
      description: "Prefer Titleist — target with brand drops",
      rules: { all: [{ field: "attributes.preferredBrands", op: "contains", value: "titleist" }] },
    },
  ];
  for (const s of segments) {
    await prisma.segment.upsert({
      where: { orgId_name: { orgId: org.id, name: s.name } },
      update: { description: s.description, rules: s.rules },
      create: { orgId: org.id, name: s.name, description: s.description, rules: s.rules },
    });
  }

  // -------------------------------------------------------------------------
  // Automations (behavioural/statistical triggers — run nightly by workers/jobs)
  // -------------------------------------------------------------------------
  for (const a of DEFAULT_AUTOMATIONS) {
    await prisma.automation.upsert({
      where: { orgId_name: { orgId: org.id, name: a.name } },
      update: {
        trigger: a.trigger as unknown as Prisma.InputJsonValue,
        action: a.action as unknown as Prisma.InputJsonValue,
        enabled: a.enabled,
      },
      create: {
        orgId: org.id,
        name: a.name,
        trigger: a.trigger as unknown as Prisma.InputJsonValue,
        action: a.action as unknown as Prisma.InputJsonValue,
        enabled: a.enabled,
      },
    });
  }

  const counts = {
    organizations: await prisma.organization.count(),
    stores: await prisma.store.count(),
    lanes: await prisma.lane.count(),
    consentTexts: await prisma.consentText.count(),
    users: await prisma.user.count(),
    members: await prisma.member.count(),
    fieldDefinitions: await prisma.fieldDefinition.count(),
  };
  console.log("✅ Seed complete for MST Golf:", counts);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
