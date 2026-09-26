import type { MemberSource, Prisma } from "@mstgolf/database";
import { normalizeThaiMobile } from "@mstgolf/shared/phone";
import { findTier, lowestTier, reviewTier, tierProgress, tierRank } from "@mstgolf/shared/tiers";
import { writeAudit } from "./audit";
import type { Actor } from "./context";
import { db, inTx, type Tx } from "./db";
import { CoreError, isUniqueViolation } from "./errors";
import { recordEvent } from "./events";
import { enqueue } from "./notify/outbox";
import { awardWelcome, postPoints } from "./points";
import { getOrg, type ResolvedSettings } from "./settings";

// Member identity (MST-DEV-PLAN §3.2, §4.2). One person = one Member.code;
// LINE UID and phone are MemberIdentity rows, each owned by exactly one member.

export interface MemberSummary {
  id: string;
  code: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  phoneVerified: boolean;
  hasLine: boolean;
  lineReachable: boolean;
  email: string | null;
  birthday: string | null; // YYYY-MM-DD
  pictureUrl: string | null;
  points: number;
  tier: string;
  spend12mSatang: number;
  lifetimeSatang: number;
  lastPurchaseAt: Date | null;
  source: MemberSource;
  status: "ACTIVE" | "MERGED" | "ERASED";
  noShowCount: number;
  marketingConsent: boolean;
  createdAt: Date;
}

const memberInclude = {
  identities: { select: { type: true, value: true, verifiedAt: true } },
  consents: {
    where: { purpose: "MARKETING" as const },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { granted: true },
  },
} satisfies Prisma.MemberInclude;

type MemberRow = Prisma.MemberGetPayload<{ include: typeof memberInclude }>;

const dateKey = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function toSummary(m: MemberRow): MemberSummary {
  const phone = m.identities.find((i) => i.type === "PHONE");
  return {
    id: m.id,
    code: m.code,
    displayName: m.displayName,
    firstName: m.firstName,
    lastName: m.lastName,
    phone: phone?.value ?? null,
    phoneVerified: !!phone?.verifiedAt,
    hasLine: m.identities.some((i) => i.type === "LINE"),
    lineReachable: m.lineReachable,
    email: m.email,
    birthday: dateKey(m.birthday),
    pictureUrl: m.pictureUrl,
    points: m.points,
    tier: m.tier,
    spend12mSatang: m.spend12mSatang,
    lifetimeSatang: m.lifetimeSatang,
    lastPurchaseAt: m.lastPurchaseAt,
    source: m.source,
    status: m.status,
    noShowCount: m.noShowCount,
    marketingConsent: m.consents[0]?.granted ?? false,
    createdAt: m.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

export function splitName(fullName: string): { firstName: string; lastName: string | null; displayName: string } {
  const clean = fullName.replace(/\s+/g, " ").trim();
  if (clean.length < 2) throw new CoreError("INVALID_INPUT", "กรุณากรอกชื่อ-นามสกุล");
  if (clean.length > 80) throw new CoreError("INVALID_INPUT", "ชื่อยาวเกินไป");
  const [first, ...rest] = clean.split(" ");
  return { firstName: first!, lastName: rest.length ? rest.join(" ") : null, displayName: clean };
}

export function parsePhone(raw: string): string {
  const phone = normalizeThaiMobile(raw);
  if (!phone) throw new CoreError("PHONE_INVALID", "เบอร์มือถือไม่ถูกต้อง (ต้องขึ้นต้น 06 08 หรือ 09 และมี 10 หลัก)");
  return phone;
}

/** "YYYY-MM-DD" → Date (UTC midnight, stored as a DATE), or null. Rejects impossible dates. */
export function parseBirthday(raw: string | null | undefined, now = new Date()): Date | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) throw new CoreError("INVALID_INPUT", "วันเกิดไม่ถูกต้อง");
  let year = Number(m[1]);
  if (year > now.getUTCFullYear() + 400) year -= 543; // typed in Buddhist era
  const d = new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCMonth() !== Number(m[2]) - 1 || year < 1900 || d.getTime() > now.getTime()) {
    throw new CoreError("INVALID_INPUT", "วันเกิดไม่ถูกต้อง");
  }
  return d;
}

export function parseEmail(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase();
  if (!v) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || v.length > 120) throw new CoreError("INVALID_INPUT", "อีเมลไม่ถูกต้อง");
  return v;
}

// ---------------------------------------------------------------------------
// Building blocks shared by sign-up, the counter and the POS import
// ---------------------------------------------------------------------------

export async function nextMemberCode(tx: Tx, orgId: string): Promise<string> {
  const c = await tx.counter.upsert({
    where: { orgId_key: { orgId, key: "member_code" } },
    create: { orgId, key: "member_code", value: 1 },
    update: { value: { increment: 1 } },
  });
  return `MST${String(c.value).padStart(8, "0")}`;
}

async function currentConsentVersion(tx: Tx, purpose: "TERMS" | "MARKETING"): Promise<{ version: string; body: string | null }> {
  const t = await tx.consentText.findFirst({
    where: { purpose, effectiveAt: { lte: new Date() } },
    orderBy: { effectiveAt: "desc" },
  });
  return { version: t?.version ?? "v1", body: t?.body ?? null };
}

async function recordConsents(
  tx: Tx,
  orgId: string,
  memberId: string,
  channel: MemberSource,
  consents: { terms?: boolean; marketing?: boolean },
): Promise<void> {
  for (const purpose of ["TERMS", "MARKETING"] as const) {
    const granted = purpose === "TERMS" ? consents.terms : consents.marketing;
    if (granted === undefined) continue;
    const text = await currentConsentVersion(tx, purpose);
    await tx.consent.create({
      data: { orgId, memberId, purpose, version: text.version, granted, textSnapshot: text.body, channel },
    });
  }
}

interface NewMemberData {
  source: MemberSource;
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  birthday?: Date | null;
  email?: string | null;
  pictureUrl?: string | null;
  phone?: string | null;
  phoneVerified?: boolean;
  lineUserId?: string | null;
  consentAt?: Date | null;
}

/** Creates a member with a new code and its identities. Throws PHONE_TAKEN / LINE_TAKEN on a clash. */
export async function insertMember(tx: Tx, orgId: string, settings: ResolvedSettings, d: NewMemberData): Promise<string> {
  const code = await nextMemberCode(tx, orgId);
  const member = await tx.member.create({
    data: {
      orgId,
      code,
      source: d.source,
      displayName: d.displayName,
      firstName: d.firstName ?? null,
      lastName: d.lastName ?? null,
      birthday: d.birthday ?? null,
      email: d.email ?? null,
      pictureUrl: d.pictureUrl ?? null,
      tier: lowestTier(settings.tiers).key,
      consentAt: d.consentAt ?? null,
    },
  });
  const now = new Date();
  const identities: Prisma.MemberIdentityCreateManyInput[] = [];
  if (d.phone) identities.push({ orgId, memberId: member.id, type: "PHONE", value: d.phone, source: d.source, verifiedAt: d.phoneVerified ? now : null });
  if (d.lineUserId) identities.push({ orgId, memberId: member.id, type: "LINE", value: d.lineUserId, source: d.source, verifiedAt: now });
  if (identities.length) await tx.memberIdentity.createMany({ data: identities });
  return member.id;
}

export async function findMemberIdByIdentity(tx: Tx, type: "LINE" | "PHONE", value: string): Promise<string | null> {
  const identity = await tx.memberIdentity.findFirst({ where: { type, value }, select: { memberId: true } });
  return identity?.memberId ?? null;
}

async function loadSummary(tx: Tx, memberId: string): Promise<MemberSummary> {
  const m = await tx.member.findFirst({ where: { id: memberId }, include: memberInclude });
  if (!m) throw new CoreError("NOT_FOUND", "ไม่พบสมาชิก");
  return toSummary(m);
}

// ---------------------------------------------------------------------------
// Customer sign-up (LINE LIFF or the website with LINE Login)
// ---------------------------------------------------------------------------

export interface SignupInput {
  lineUserId: string;
  channel: "LINE" | "WEB";
  fullName: string;
  phone: string;
  birthday?: string | null;
  email?: string | null;
  pictureUrl?: string | null; // LINE profile picture
  acceptTerms: boolean;
  marketing: boolean;
}

export interface SignupResult {
  member: MemberSummary;
  outcome: "created" | "linked";
  welcomePoints: number;
}

export async function signUp(orgId: string, input: SignupInput): Promise<SignupResult> {
  if (!input.acceptTerms) throw new CoreError("INVALID_INPUT", "กรุณายอมรับข้อกำหนดและนโยบายความเป็นส่วนตัว");
  if (!input.lineUserId) throw new CoreError("INVALID_INPUT", "ต้องล็อกอินด้วย LINE ก่อน");
  const name = splitName(input.fullName);
  const phone = parsePhone(input.phone);
  const birthday = parseBirthday(input.birthday);
  const email = parseEmail(input.email);
  const { settings } = await getOrg(orgId);

  try {
    return await inTx(orgId, async (tx) => {
      if (await findMemberIdByIdentity(tx, "LINE", input.lineUserId)) {
        throw new CoreError("ALREADY_MEMBER", "บัญชี LINE นี้เป็นสมาชิกอยู่แล้ว");
      }
      const now = new Date();
      const phoneOwner = await findMemberIdByIdentity(tx, "PHONE", phone);
      let memberId: string;
      let outcome: SignupResult["outcome"];

      if (phoneOwner) {
        const owner = await tx.member.findFirst({ where: { id: phoneOwner }, include: memberInclude });
        if (!owner || owner.status !== "ACTIVE") throw new CoreError("PHONE_TAKEN", "เบอร์นี้ใช้สมัครไม่ได้ กรุณาติดต่อร้าน");
        if (owner.identities.some((i) => i.type === "LINE")) {
          // Someone else's LINE already owns this phone — never hand the account over.
          // The review item is written after this transaction rolls back (see below).
          throw new CoreError("PHONE_TAKEN", "เบอร์นี้ลงทะเบียนกับบัญชี LINE อื่นแล้ว กรุณาติดต่อร้านเพื่อตรวจสอบ", {
            conflictMemberId: owner.id,
          });
        }
        // Counter- or POS-created member signing up in LINE: same member, same points and history.
        await tx.memberIdentity.create({
          data: { orgId, memberId: owner.id, type: "LINE", value: input.lineUserId, source: input.channel, verifiedAt: now },
        });
        const posOnly = owner.source === "POS" || owner.source === "IMPORT";
        await tx.member.update({
          where: { id: owner.id },
          data: {
            displayName: posOnly || !owner.firstName ? name.displayName : owner.displayName,
            firstName: posOnly || !owner.firstName ? name.firstName : owner.firstName,
            lastName: posOnly || !owner.firstName ? name.lastName : owner.lastName,
            birthday: owner.birthday ?? birthday,
            email: owner.email ?? email,
            pictureUrl: owner.pictureUrl ?? input.pictureUrl ?? null,
            consentAt: owner.consentAt ?? now,
          },
        });
        memberId = owner.id;
        outcome = "linked";
        await recordEvent(tx, orgId, memberId, "LINE_LINKED", { channel: input.channel });
      } else {
        memberId = await insertMember(tx, orgId, settings, {
          source: input.channel,
          ...name,
          birthday,
          email,
          pictureUrl: input.pictureUrl ?? null,
          phone,
          phoneVerified: false,
          lineUserId: input.lineUserId,
          consentAt: now,
        });
        outcome = "created";
        await recordEvent(tx, orgId, memberId, "REGISTER", { channel: input.channel });
      }

      await recordConsents(tx, orgId, memberId, input.channel, { terms: true, marketing: input.marketing });
      const welcomePoints = await awardWelcome(tx, orgId, memberId, settings);
      const member = await loadSummary(tx, memberId);
      await enqueue(tx, orgId, [
        {
          memberId,
          kind: "WELCOME",
          dedupeKey: `WELCOME:${memberId}`,
          payload: { displayName: member.displayName, code: member.code, points: welcomePoints || member.points },
        },
      ]);
      return { member, outcome, welcomePoints };
    });
  } catch (e) {
    // Two taps on "สมัคร" at once: the second loses on the identity index.
    if (isUniqueViolation(e)) throw new CoreError("ALREADY_MEMBER", "บัญชี LINE นี้เป็นสมาชิกอยู่แล้ว");
    const conflict = e instanceof CoreError ? (e.detail?.conflictMemberId as string | undefined) : undefined;
    if (conflict) {
      const client = db(orgId);
      const open = await client.reviewItem.findFirst({
        where: { kind: "PHONE_CONFLICT", status: "OPEN", memberId: conflict, payload: { path: ["lineUserId"], equals: input.lineUserId } },
      });
      if (!open) {
        await client.reviewItem.create({
          data: {
            orgId,
            kind: "PHONE_CONFLICT",
            memberId: conflict,
            payload: { phone, lineUserId: input.lineUserId, fullName: name.displayName, channel: input.channel },
          },
        });
      }
      throw new CoreError("PHONE_TAKEN", (e as Error).message);
    }
    throw e;
  }
}

export async function findMemberByLine(orgId: string, lineUserId: string): Promise<MemberSummary | null> {
  const client = db(orgId);
  const memberId = await findMemberIdByIdentity(client, "LINE", lineUserId);
  if (!memberId) return null;
  const m = await client.member.findFirst({ where: { id: memberId, status: "ACTIVE" }, include: memberInclude });
  return m ? toSummary(m) : null;
}

export async function getMember(orgId: string, memberId: string): Promise<MemberSummary | null> {
  const m = await db(orgId).member.findFirst({ where: { id: memberId }, include: memberInclude });
  return m ? toSummary(m) : null;
}

// ---------------------------------------------------------------------------
// Member card (customer view)
// ---------------------------------------------------------------------------

export interface MemberCard {
  member: MemberSummary;
  tier: { key: string; name: string; pointRate: number; discountPct: number; simDiscountPct: number; bookingDaysAhead: number };
  next: { name: string; remainingBaht: number; pct: number } | null;
  spend12mBaht: number;
}

export async function memberCard(orgId: string, memberId: string): Promise<MemberCard> {
  const { settings } = await getOrg(orgId);
  const member = await getMember(orgId, memberId);
  if (!member || member.status !== "ACTIVE") throw new CoreError("NOT_FOUND", "ไม่พบสมาชิก");
  const spend = member.spend12mSatang / 100;
  const held = findTier(member.tier, settings.tiers) ?? lowestTier(settings.tiers);
  const progress = tierProgress(spend, settings.tiers);
  // The held tier can be above what spend earns (downgrades wait for the 1st).
  const heldRank = settings.tiers.indexOf(held);
  const next = settings.tiers[heldRank + 1] ?? null;
  return {
    member,
    tier: {
      key: held.key,
      name: held.name,
      pointRate: held.pointRate,
      discountPct: held.benefits.discountPct,
      simDiscountPct: held.benefits.simDiscountPct,
      bookingDaysAhead: held.benefits.simBookingDaysAhead,
    },
    next: next
      ? {
          name: next.name,
          remainingBaht: Math.max(0, next.minSpend12m - spend),
          pct: next === progress.next ? progress.pct : Math.min(1, spend / Math.max(1, next.minSpend12m)),
        }
      : null,
    spend12mBaht: spend,
  };
}

// ---------------------------------------------------------------------------
// Profile edits
// ---------------------------------------------------------------------------

export interface ProfileInput {
  fullName?: string;
  birthday?: string | null;
  email?: string | null;
  marketing?: boolean;
}

/** The member edits their own profile. Birthday can be set once (it drives the birthday bonus); after that only staff change it. */
export async function updateOwnProfile(orgId: string, memberId: string, input: ProfileInput): Promise<MemberSummary> {
  return inTx(orgId, async (tx) => {
    const m = await tx.member.findFirst({ where: { id: memberId, status: "ACTIVE" }, include: memberInclude });
    if (!m) throw new CoreError("NOT_FOUND", "ไม่พบสมาชิก");
    const data: Prisma.MemberUpdateInput = {};
    if (input.fullName !== undefined) Object.assign(data, splitName(input.fullName));
    if (input.email !== undefined) data.email = parseEmail(input.email);
    if (input.birthday !== undefined) {
      const b = parseBirthday(input.birthday);
      if (m.birthday && dateKey(m.birthday) !== dateKey(b)) {
        throw new CoreError("FORBIDDEN", "แก้วันเกิดได้ครั้งเดียว หากต้องการเปลี่ยนกรุณาติดต่อร้าน");
      }
      data.birthday = b;
    }
    if (Object.keys(data).length) {
      await tx.member.update({ where: { id: m.id }, data });
      await recordEvent(tx, orgId, m.id, "PROFILE_UPDATE", { fields: Object.keys(data) });
    }
    if (input.marketing !== undefined && input.marketing !== (m.consents[0]?.granted ?? false)) {
      await recordConsents(tx, orgId, m.id, "LINE", { marketing: input.marketing });
    }
    return loadSummary(tx, m.id);
  });
}

// ---------------------------------------------------------------------------
// Back office
// ---------------------------------------------------------------------------

export interface CounterSignupInput {
  fullName: string;
  phone: string;
  birthday?: string | null;
  email?: string | null;
  consentConfirmed: boolean; // staff confirms the customer agreed to the terms
  marketing: boolean;
}

/** Staff create a member at the counter. The customer gets the same welcome points as in LINE. */
export async function createMemberAtCounter(orgId: string, actor: Actor, input: CounterSignupInput): Promise<SignupResult> {
  if (!input.consentConfirmed) throw new CoreError("INVALID_INPUT", "ต้องยืนยันว่าลูกค้ายินยอมตามนโยบาย PDPA");
  const name = splitName(input.fullName);
  const phone = parsePhone(input.phone);
  const birthday = parseBirthday(input.birthday);
  const email = parseEmail(input.email);
  const { settings } = await getOrg(orgId);
  try {
    return await inTx(orgId, async (tx) => {
      const existing = await findMemberIdByIdentity(tx, "PHONE", phone);
      if (existing) throw new CoreError("PHONE_TAKEN", "เบอร์นี้เป็นสมาชิกอยู่แล้ว", { memberId: existing });
      const memberId = await insertMember(tx, orgId, settings, {
        source: "COUNTER",
        ...name,
        birthday,
        email,
        phone,
        phoneVerified: true, // the customer is standing at the counter
        consentAt: new Date(),
      });
      await recordEvent(tx, orgId, memberId, "REGISTER", { channel: "COUNTER" });
      await recordConsents(tx, orgId, memberId, "COUNTER", { terms: true, marketing: input.marketing });
      const welcomePoints = await awardWelcome(tx, orgId, memberId, settings);
      const member = await loadSummary(tx, memberId);
      await writeAudit(tx, orgId, actor, { action: "member.create", entity: "member", entityId: memberId, after: { code: member.code, phone } });
      return { member, outcome: "created" as const, welcomePoints };
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new CoreError("PHONE_TAKEN", "เบอร์นี้เป็นสมาชิกอยู่แล้ว");
    throw e;
  }
}

export interface StaffEditInput {
  fullName?: string;
  phone?: string;
  birthday?: string | null;
  email?: string | null;
  attributes?: Record<string, unknown>;
}

export async function staffUpdateMember(orgId: string, actor: Actor, memberId: string, input: StaffEditInput): Promise<MemberSummary> {
  try {
    return await inTx(orgId, async (tx) => {
      const m = await tx.member.findFirst({ where: { id: memberId, status: "ACTIVE" }, include: memberInclude });
      if (!m) throw new CoreError("NOT_FOUND", "ไม่พบสมาชิก");
      const before = toSummary(m);
      const data: Prisma.MemberUpdateInput = {};
      if (input.fullName !== undefined) Object.assign(data, splitName(input.fullName));
      if (input.birthday !== undefined) data.birthday = parseBirthday(input.birthday);
      if (input.email !== undefined) data.email = parseEmail(input.email);
      if (input.attributes !== undefined) data.attributes = input.attributes as Prisma.InputJsonValue;
      if (Object.keys(data).length) await tx.member.update({ where: { id: m.id }, data });

      if (input.phone !== undefined) {
        const phone = parsePhone(input.phone);
        if (phone !== before.phone) {
          const owner = await findMemberIdByIdentity(tx, "PHONE", phone);
          if (owner && owner !== m.id) throw new CoreError("PHONE_TAKEN", "เบอร์นี้เป็นของสมาชิกคนอื่น — ใช้การรวมบัญชีแทน", { memberId: owner });
          await tx.memberIdentity.deleteMany({ where: { memberId: m.id, type: "PHONE" } });
          await tx.memberIdentity.create({
            data: { orgId, memberId: m.id, type: "PHONE", value: phone, source: "COUNTER", verifiedAt: new Date() },
          });
        }
      }
      const after = await loadSummary(tx, m.id);
      await writeAudit(tx, orgId, actor, {
        action: "member.update",
        entity: "member",
        entityId: m.id,
        before: pick(before, input),
        after: pick(after, input),
      });
      return after;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new CoreError("PHONE_TAKEN", "เบอร์นี้เป็นของสมาชิกคนอื่น");
    throw e;
  }
}

function pick(s: MemberSummary, input: StaffEditInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.fullName !== undefined) out.displayName = s.displayName;
  if (input.phone !== undefined) out.phone = s.phone;
  if (input.birthday !== undefined) out.birthday = s.birthday;
  if (input.email !== undefined) out.email = s.email;
  if (input.attributes !== undefined) out.attributes = "changed";
  return out;
}

export async function setMemberPicture(orgId: string, actor: Actor, memberId: string, pictureUrl: string | null): Promise<void> {
  await inTx(orgId, async (tx) => {
    const m = await tx.member.findFirst({ where: { id: memberId } });
    if (!m) throw new CoreError("NOT_FOUND", "ไม่พบสมาชิก");
    await tx.member.update({ where: { id: m.id }, data: { pictureUrl } });
    await writeAudit(tx, orgId, actor, { action: pictureUrl ? "member.photo_set" : "member.photo_remove", entity: "member", entityId: m.id });
  });
}

// ---------------------------------------------------------------------------
// Search (back office list)
// ---------------------------------------------------------------------------

export interface MemberQuery {
  q?: string; // name, phone or code
  tier?: string;
  hasLine?: boolean;
  source?: MemberSource;
  status?: "ACTIVE" | "MERGED" | "ERASED";
  page?: number;
  pageSize?: number;
}

export async function searchMembers(orgId: string, query: MemberQuery): Promise<{ total: number; rows: MemberSummary[] }> {
  const where: Prisma.MemberWhereInput = { status: query.status ?? "ACTIVE" };
  const q = query.q?.trim();
  if (q) {
    const phone = normalizeThaiMobile(q);
    const digits = q.replace(/\D/g, "");
    where.OR = [
      { displayName: { contains: q, mode: "insensitive" } },
      { code: { contains: q.toUpperCase() } },
      { email: { contains: q.toLowerCase() } },
      ...(phone ? [{ identities: { some: { type: "PHONE" as const, value: phone } } }] : []),
      ...(digits.length >= 4 && !phone ? [{ identities: { some: { type: "PHONE" as const, value: { contains: digits } } } }] : []),
    ];
  }
  if (query.tier) where.tier = query.tier;
  if (query.source) where.source = query.source;
  if (query.hasLine !== undefined) {
    where.identities = query.hasLine ? { some: { type: "LINE" } } : { none: { type: "LINE" } };
  }
  const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));
  const page = Math.max(1, query.page ?? 1);
  const client = db(orgId);
  const [total, rows] = await Promise.all([
    client.member.count({ where }),
    client.member.findMany({
      where,
      include: memberInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { total, rows: rows.map(toSummary) };
}

// ---------------------------------------------------------------------------
// Merge and erase (Super Admin)
// ---------------------------------------------------------------------------

export async function mergeMembers(
  orgId: string,
  actor: Actor,
  input: { survivorId: string; mergedId: string; reason: string },
): Promise<MemberSummary> {
  if (input.survivorId === input.mergedId) throw new CoreError("INVALID_INPUT", "เลือกสมาชิกสองคนที่ต่างกัน");
  if (!input.reason.trim()) throw new CoreError("INVALID_INPUT", "ต้องใส่เหตุผลการรวมบัญชี");
  const { settings } = await getOrg(orgId);
  return inTx(
    orgId,
    async (tx) => {
      const [survivor, merged] = await Promise.all([
        tx.member.findFirst({ where: { id: input.survivorId, status: "ACTIVE" }, include: memberInclude }),
        tx.member.findFirst({ where: { id: input.mergedId, status: "ACTIVE" }, include: memberInclude }),
      ]);
      if (!survivor || !merged) throw new CoreError("NOT_FOUND", "ไม่พบสมาชิก หรือถูกรวม/ลบไปแล้ว");
      const lineOnBoth = survivor.identities.some((i) => i.type === "LINE") && merged.identities.some((i) => i.type === "LINE");
      if (lineOnBoth) throw new CoreError("INVALID_INPUT", "ทั้งสองบัญชีผูก LINE คนละบัญชี — รวมไม่ได้ ลูกค้าต้องใช้บัญชีเดียว");

      // Identities: the survivor keeps its own; the merged one's move over unless the survivor already has that type.
      const moved: Record<string, number> = {};
      for (const identity of merged.identities) {
        const clash = survivor.identities.some((i) => i.type === identity.type);
        if (clash) {
          await tx.memberIdentity.deleteMany({ where: { memberId: merged.id, type: identity.type } });
        } else {
          await tx.memberIdentity.updateMany({ where: { memberId: merged.id, type: identity.type }, data: { memberId: survivor.id } });
          moved[`identity_${identity.type}`] = 1;
        }
      }
      moved.sales = (await tx.sale.updateMany({ where: { memberId: merged.id }, data: { memberId: survivor.id } })).count;
      moved.bookings = (await tx.booking.updateMany({ where: { memberId: merged.id }, data: { memberId: survivor.id } })).count;
      moved.events = (await tx.event.updateMany({ where: { memberId: merged.id }, data: { memberId: survivor.id } })).count;
      moved.consents = (await tx.consent.updateMany({ where: { memberId: merged.id }, data: { memberId: survivor.id } })).count;
      await tx.notification.updateMany({ where: { memberId: merged.id, status: "PENDING" }, data: { status: "SKIPPED", lastError: "รวมบัญชีแล้ว" } });

      // Points move as a transfer so both ledgers stay readable. A second welcome bonus is not carried over.
      const survivorGotWelcome = await tx.pointTransaction.findFirst({ where: { memberId: survivor.id, reason: "WELCOME" } });
      const mergedWelcome = await tx.pointTransaction.findFirst({ where: { memberId: merged.id, reason: "WELCOME" } });
      const duplicateWelcome = survivorGotWelcome && mergedWelcome ? mergedWelcome.delta : 0;
      const transfer = merged.points - duplicateWelcome;
      if (merged.points !== 0) {
        await postPoints(tx, orgId, { memberId: merged.id, type: "ADJUST", delta: -merged.points, reason: "MERGE_OUT", note: `รวมเข้า ${survivor.code}`, createdById: actorUserIdOf(actor) });
      }
      if (transfer !== 0) {
        await postPoints(tx, orgId, { memberId: survivor.id, type: "ADJUST", delta: transfer, reason: "MERGE_IN", note: `จาก ${merged.code}`, createdById: actorUserIdOf(actor) });
      }
      moved.points = transfer;

      await tx.member.update({
        where: { id: survivor.id },
        data: {
          birthday: survivor.birthday ?? merged.birthday,
          email: survivor.email ?? merged.email,
          pictureUrl: survivor.pictureUrl ?? merged.pictureUrl,
          noShowCount: survivor.noShowCount + merged.noShowCount,
        },
      });
      await tx.member.update({ where: { id: merged.id }, data: { status: "MERGED", mergedIntoId: survivor.id } });
      await refreshMemberSpend(tx, orgId, survivor.id, settings, { allowDowngrade: false });
      await tx.mergeLog.create({
        data: { orgId, survivorId: survivor.id, mergedId: merged.id, movedCounts: moved, userId: actorUserIdOf(actor), reason: input.reason },
      });
      await recordEvent(tx, orgId, survivor.id, "MERGED", { mergedCode: merged.code });
      await writeAudit(tx, orgId, actor, {
        action: "member.merge",
        entity: "member",
        entityId: survivor.id,
        before: { survivor: survivor.code, merged: merged.code, points: [survivor.points, merged.points] },
        after: moved,
        reason: input.reason,
      });
      return loadSummary(tx, survivor.id);
    },
    { timeout: 30_000 },
  );
}

function actorUserIdOf(actor: Actor): string | null {
  return actor.kind === "staff" ? actor.userId : null;
}

/**
 * PDPA erasure: identities and personal fields are removed; bills stay for the
 * accounts but no longer point to a person. Returns the old picture URL so the
 * caller can delete the file.
 */
export async function eraseMember(orgId: string, actor: Actor, memberId: string, reason: string): Promise<{ pictureUrl: string | null }> {
  if (!reason.trim()) throw new CoreError("INVALID_INPUT", "ต้องใส่เหตุผล");
  return inTx(orgId, async (tx) => {
    const m = await tx.member.findFirst({ where: { id: memberId, status: "ACTIVE" } });
    if (!m) throw new CoreError("NOT_FOUND", "ไม่พบสมาชิก");
    await tx.memberIdentity.deleteMany({ where: { memberId: m.id } });
    await tx.sale.updateMany({ where: { memberId: m.id }, data: { memberId: null, memberRef: null } });
    await tx.booking.updateMany({
      where: { memberId: m.id, status: { in: ["HELD", "CONFIRMED"] } },
      data: { status: "CANCELLED", cancelReason: "ลบข้อมูลสมาชิก", cancelledBy: actorUserIdOf(actor) },
    });
    await tx.booking.updateMany({ where: { memberId: m.id }, data: { memberId: null, guestName: null, guestPhone: null } });
    await tx.notification.updateMany({ where: { memberId: m.id, status: "PENDING" }, data: { status: "SKIPPED", lastError: "ลบข้อมูลสมาชิก" } });
    await tx.member.update({
      where: { id: m.id },
      data: {
        status: "ERASED",
        erasedAt: new Date(),
        displayName: "ลบข้อมูลแล้ว",
        firstName: null,
        lastName: null,
        birthday: null,
        email: null,
        pictureUrl: null,
        attributes: {},
      },
    });
    await writeAudit(tx, orgId, actor, { action: "member.erase", entity: "member", entityId: m.id, before: { code: m.code }, reason });
    return { pictureUrl: m.pictureUrl };
  });
}

// ---------------------------------------------------------------------------
// Spend and tier cache
// ---------------------------------------------------------------------------

/**
 * Recomputes spend12m / lifetime / lastPurchaseAt from posted sales and moves
 * the tier: up immediately; down only when allowDowngrade (the monthly review
 * or a correction such as an import rollback).
 */
export async function refreshMemberSpend(
  tx: Tx,
  orgId: string,
  memberId: string,
  settings: ResolvedSettings,
  opts: { allowDowngrade: boolean; now?: Date },
): Promise<{ tierChanged: "up" | "down" | null; tier: string; spend12mSatang: number }> {
  const now = opts.now ?? new Date();
  const from = new Date(now.getTime() - 365 * 24 * 60 * 60_000);
  const [window, lifetime, last, member] = await Promise.all([
    tx.sale.aggregate({ where: { memberId, status: "POSTED", occurredAt: { gt: from } }, _sum: { netSatang: true } }),
    tx.sale.aggregate({ where: { memberId, status: "POSTED" }, _sum: { netSatang: true } }),
    tx.sale.findFirst({ where: { memberId, status: "POSTED", type: "SALE" }, orderBy: { occurredAt: "desc" }, select: { occurredAt: true } }),
    tx.member.findFirst({ where: { id: memberId }, select: { tier: true } }),
  ]);
  const spend12mSatang = Math.max(0, window._sum.netSatang ?? 0);
  const next = reviewTier(member?.tier, spend12mSatang / 100, settings.tiers, { allowDowngrade: opts.allowDowngrade });
  const before = tierRank(member?.tier, settings.tiers);
  const after = tierRank(next.key, settings.tiers);
  await tx.member.update({
    where: { id: memberId },
    data: {
      spend12mSatang,
      lifetimeSatang: Math.max(0, lifetime._sum.netSatang ?? 0),
      lastPurchaseAt: last?.occurredAt ?? null,
      tier: next.key,
    },
  });
  return { tierChanged: after > before ? "up" : after < before ? "down" : null, tier: next.key, spend12mSatang };
}

// ---------------------------------------------------------------------------
// Customer 360 (back office)
// ---------------------------------------------------------------------------

export interface MemberActivity {
  sales: Array<{
    id: string;
    invoiceNo: string;
    type: "SALE" | "RETURN" | "VOID";
    occurredAt: Date;
    netSatang: number;
    storeName: string;
    points: number;
    lines: Array<{ name: string; sku: string | null; qty: number; netSatang: number }>;
  }>;
  identities: Array<{ type: "LINE" | "PHONE"; value: string; verifiedAt: Date | null; source: MemberSource; createdAt: Date }>;
  consents: Array<{ purpose: "TERMS" | "MARKETING"; version: string; granted: boolean; channel: MemberSource | null; createdAt: Date }>;
  events: Array<{ type: string; occurredAt: Date; payload: Record<string, unknown> }>;
  openReviews: number;
}

export async function memberActivity(orgId: string, memberId: string): Promise<MemberActivity> {
  const client = db(orgId);
  const [sales, identities, consents, events, openReviews] = await Promise.all([
    client.sale.findMany({
      where: { memberId, status: "POSTED" },
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: {
        store: { select: { name: true } },
        lines: { select: { name: true, sku: true, qty: true, netSatang: true } },
        pointTransactions: { select: { delta: true } },
      },
    }),
    client.memberIdentity.findMany({ where: { memberId }, orderBy: { createdAt: "asc" } }),
    client.consent.findMany({ where: { memberId }, orderBy: { createdAt: "desc" }, take: 50 }),
    client.event.findMany({ where: { memberId }, orderBy: { occurredAt: "desc" }, take: 80 }),
    client.reviewItem.count({ where: { memberId, status: "OPEN" } }),
  ]);
  return {
    sales: sales.map((s) => ({
      id: s.id,
      invoiceNo: s.invoiceNo,
      type: s.type,
      occurredAt: s.occurredAt,
      netSatang: s.netSatang,
      storeName: s.store.name,
      points: s.pointTransactions.reduce((sum, t) => sum + t.delta, 0),
      lines: s.lines,
    })),
    identities: identities.map((i) => ({ type: i.type, value: i.value, verifiedAt: i.verifiedAt, source: i.source, createdAt: i.createdAt })),
    consents: consents.map((c) => ({ purpose: c.purpose, version: c.version, granted: c.granted, channel: c.channel, createdAt: c.createdAt })),
    events: events.map((e) => ({ type: e.type, occurredAt: e.occurredAt, payload: (e.payload ?? {}) as Record<string, unknown> })),
    openReviews,
  };
}
