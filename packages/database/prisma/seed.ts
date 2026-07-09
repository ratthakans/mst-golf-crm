import { PrismaClient, Prisma } from "@prisma/client";
import { encrypt, type OrgSettings } from "@mstgolf/shared";
import { DEFAULT_AUTOMATIONS } from "@mstgolf/analytics";

const prisma = new PrismaClient();

// Helper: a date N days ago (for realistic RFM recency spread).
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function main() {
  // -------------------------------------------------------------------------
  // First customer: MST Golf (Bangkok, Thailand) — pro shop + academy + fitting + arena
  // -------------------------------------------------------------------------
  const settings: OrgSettings = {
    logoUrl: "https://mstgolf.com/logo.png",
    brandColor: "#0a5c36",
    locale: "th",
    currency: "THB",
    timezone: "Asia/Bangkok",
    businessType: "pro_shop",
    points: { perBaht: 0.01, signupBonus: 1600, birthdayBonus: 2400, expiryMonths: 12 },
    tiers: [
      { name: "Silver", minPoints: 0 },
      { name: "Gold", minPoints: 16000 },
      { name: "Platinum", minPoints: 40000 },
    ],
    rewards: [
      { name: "Titleist Pro V1 (1 dozen)", costPoints: 4000 },
      { name: "฿400 store voucher", costPoints: 8000 },
      { name: "1-hour fitting session", costPoints: 12000 },
    ],
    features: {
      fitting: true,
      tradeIn: false,
      referral: false,
      events: true,
      coupons: true,
      lessons: true,
      arena: true,
      teeTime: false,
    },
    messaging: {
      welcome:
        "Welcome to MST Golf! 🏌️ You've earned 1,600 bonus points. Show your member QR at any store for exclusive deals.",
      birthday: "Happy birthday from MST Golf! Enjoy 2,400 bonus points this month. 🎉",
      winBack: "We miss you at MST Golf! Here's a special offer to get you back on the course.",
      consentText:
        "I consent to MST Golf collecting and processing my personal data for membership, marketing and service purposes in accordance with the PDPA.",
    },
    crm: { churnDays: 90, welcomeDiscountPercent: 15 },
    richMenu: [
      { label: "Membership", action: "liff", target: "register" },
      { label: "Rewards", action: "liff", target: "rewards" },
      { label: "Book Fitting", action: "liff", target: "fitting" },
      { label: "Academy", action: "uri", target: "https://mstgolf.com/academy" },
    ],
  };

  const org = await prisma.organization.upsert({
    where: { slug: "mst-golf" },
    update: { settings: settings as unknown as Prisma.InputJsonValue },
    create: {
      name: "MST Golf",
      slug: "mst-golf",
      plan: "GROWTH",
      settings: settings as unknown as Prisma.InputJsonValue,
    },
  });

  // -------------------------------------------------------------------------
  // Admin user (OWNER)
  // -------------------------------------------------------------------------
  await prisma.user.upsert({
    where: { orgId_email: { orgId: org.id, email: "admin@mstgolf.com" } },
    update: {},
    create: {
      orgId: org.id,
      email: "admin@mstgolf.com",
      name: "MST Golf Admin",
      role: "OWNER",
      // NOTE: real password hashing lands in M1 (auth module). Placeholder only.
      passwordHash: null,
    },
  });

  // -------------------------------------------------------------------------
  // LINE channel (per-org credentials — secrets encrypted at rest)
  // -------------------------------------------------------------------------
  await prisma.lineChannel.upsert({
    where: { orgId_channelId: { orgId: org.id, channelId: "0000000000" } },
    update: {},
    create: {
      orgId: org.id,
      channelId: "0000000000",
      channelSecretEnc: encrypt("dev-channel-secret-placeholder"),
      channelAccessTokenEnc: encrypt("dev-channel-access-token-placeholder"),
      liffId: "0000000000-abcdefgh",
    },
  });

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

  // -------------------------------------------------------------------------
  // Members — 5 profiles covering different RFM segments
  // -------------------------------------------------------------------------
  const memberSpecs = [
    {
      lineUserId: "U_champion_001",
      displayName: "Somchai Rattanakul",
      phone: "+66811112201",
      tier: "Platinum",
      points: 43200,
      lastSeenDays: 2,
      attributes: {
        handicap: 6,
        dominantHand: "right",
        skillLevel: "advanced",
        preferredBrands: ["titleist", "taylormade"],
        interests: ["clubs", "fitting"],
        homeCourse: "Alpine Golf & Sports Club",
        playFrequency: "weekly",
      },
      // Champion: recent, frequent, high spend
      purchases: [
        { daysAgo: 2, amount: 15192 },
        { daysAgo: 20, amount: 5120 },
        { daysAgo: 55, amount: 17600 },
      ],
    },
    {
      lineUserId: "U_loyal_002",
      displayName: "Nattaya Phongsak",
      phone: "+66811112202",
      tier: "Gold",
      points: 20800,
      lastSeenDays: 10,
      attributes: {
        handicap: 14,
        dominantHand: "right",
        skillLevel: "intermediate",
        preferredBrands: ["callaway", "footjoy"],
        interests: ["apparel", "footwear", "lessons"],
        homeCourse: "Thana City Country Club",
        playFrequency: "monthly",
      },
      purchases: [
        { daysAgo: 10, amount: 3600 },
        { daysAgo: 70, amount: 6240 },
      ],
    },
    {
      lineUserId: "U_new_003",
      displayName: "Anucha Meesap",
      phone: "+66811112203",
      tier: "Silver",
      points: 1600,
      lastSeenDays: 1,
      attributes: {
        handicap: 24,
        dominantHand: "left",
        skillLevel: "beginner",
        preferredBrands: ["honma"],
        interests: ["clubs", "lessons"],
        playFrequency: "occasionally",
      },
      // New: just signed up, no purchase yet
      purchases: [],
    },
    {
      lineUserId: "U_atrisk_004",
      displayName: "Prasit Chaiyaphon",
      phone: "+66811112204",
      tier: "Gold",
      points: 16800,
      lastSeenDays: 120, // past churnDays (90) → at-risk / win-back
      attributes: {
        handicap: 11,
        dominantHand: "right",
        skillLevel: "advanced",
        preferredBrands: ["mizuno", "titleist"],
        interests: ["clubs", "fitting"],
        homeCourse: "Riverdale Golf Club",
        playFrequency: "monthly",
      },
      purchases: [
        { daysAgo: 120, amount: 2560 },
        { daysAgo: 200, amount: 12000 },
      ],
    },
    {
      lineUserId: "U_dormant_005",
      displayName: "Wanida Srisuk",
      phone: "+66811112205",
      tier: "Silver",
      points: 2800,
      lastSeenDays: 260, // long dormant
      attributes: {
        handicap: 20,
        dominantHand: "right",
        skillLevel: "beginner",
        preferredBrands: ["callaway"],
        interests: ["apparel"],
        playFrequency: "occasionally",
      },
      purchases: [{ daysAgo: 260, amount: 1680 }],
    },
  ];

  for (const spec of memberSpecs) {
    const member = await prisma.member.upsert({
      where: { orgId_lineUserId: { orgId: org.id, lineUserId: spec.lineUserId } },
      update: {},
      create: {
        orgId: org.id,
        lineUserId: spec.lineUserId,
        displayName: spec.displayName,
        phone: spec.phone,
        tier: spec.tier,
        points: spec.points,
        lastSeenAt: daysAgo(spec.lastSeenDays),
        consentAt: daysAgo(spec.lastSeenDays + 1),
        attributes: spec.attributes as unknown as Prisma.InputJsonValue,
      },
    });

    // consent history (versioned) + REGISTER event + signup bonus ledger
    await prisma.consent.create({
      data: {
        orgId: org.id,
        memberId: member.id,
        purpose: "data_processing",
        version: "v1",
        granted: true,
        textSnapshot: settings.messaging.consentText,
        createdAt: daysAgo(spec.lastSeenDays + 1),
      },
    });

    await prisma.event.create({
      data: {
        orgId: org.id,
        memberId: member.id,
        type: "REGISTER",
        payload: {},
        occurredAt: daysAgo(spec.lastSeenDays + 1),
      },
    });

    await prisma.pointTransaction.create({
      data: {
        orgId: org.id,
        memberId: member.id,
        delta: settings.points.signupBonus,
        reason: "signup_bonus",
        createdAt: daysAgo(spec.lastSeenDays + 1),
      },
    });

    // purchases → PURCHASE event (typed payload) + EARN_POINTS ledger
    for (const p of spec.purchases) {
      await prisma.event.create({
        data: {
          orgId: org.id,
          memberId: member.id,
          type: "PURCHASE",
          payload: {
            amount: p.amount,
            currency: settings.currency,
            channel: "store",
          } as unknown as Prisma.InputJsonValue,
          occurredAt: daysAgo(p.daysAgo),
        },
      });

      const earned = Math.round(p.amount * settings.points.perBaht * 100);
      await prisma.pointTransaction.create({
        data: {
          orgId: org.id,
          memberId: member.id,
          delta: earned,
          reason: "purchase",
          createdAt: daysAgo(p.daysAgo),
        },
      });
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  const counts = {
    organizations: await prisma.organization.count(),
    users: await prisma.user.count(),
    members: await prisma.member.count(),
    fieldDefinitions: await prisma.fieldDefinition.count(),
    events: await prisma.event.count(),
    pointTransactions: await prisma.pointTransaction.count(),
    consents: await prisma.consent.count(),
    lineChannels: await prisma.lineChannel.count(),
    segments: await prisma.segment.count(),
    automations: await prisma.automation.count(),
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
