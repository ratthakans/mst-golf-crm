import type { BlockReason, ConsentPurpose } from "@mstgolf/database";
import type { BookingSettings, NotificationSettings, OpenHours, OrgSettings, PosSettings, SiteCopy, SitePhotoKey, SiteSettings, TierSettings, Weekday } from "@mstgolf/shared";
import { encrypt, SITE_PHOTO_KEYS, SITE_SERVICE_SLUGS } from "@mstgolf/shared";
import { writeAudit } from "./audit";
import type { Actor } from "./context";
import { db, inTx } from "./db";
import { CoreError } from "./errors";
import { toSatang } from "./money";
import { getOrg, updateSettings, type ResolvedSettings } from "./settings";
import { parseHm } from "./time";

// Back-office Settings (docs/PRODUCT.md §9.3): every value MST may change without
// a code change. Each save is validated here and written to the audit log.

async function audited(orgId: string, actor: Actor, action: string, before: unknown, after: unknown) {
  await inTx(orgId, (tx) => writeAudit(tx, orgId, actor, { action, entity: "settings", before, after }));
}

const num = (v: unknown, min: number, max: number, label: string): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new CoreError("INVALID_INPUT", `${label} ต้องอยู่ระหว่าง ${min}–${max}`);
  return n;
};

export async function saveTiers(orgId: string, actor: Actor, tiers: TierSettings[]): Promise<ResolvedSettings> {
  if (!Array.isArray(tiers) || tiers.length < 1 || tiers.length > 5) throw new CoreError("INVALID_INPUT", "ต้องมี 1–5 ระดับ");
  const clean: TierSettings[] = tiers.map((t, i) => {
    const key = String(t.key ?? "").trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{1,19}$/.test(key)) throw new CoreError("INVALID_INPUT", `รหัสระดับที่ ${i + 1} ใช้ได้เฉพาะ a-z 0-9 _`);
    const name = String(t.name ?? "").trim();
    if (!name) throw new CoreError("INVALID_INPUT", `ใส่ชื่อระดับที่ ${i + 1}`);
    return {
      key,
      name: name.slice(0, 30),
      minSpend12m: Math.round(num(t.minSpend12m, 0, 100_000_000, "เกณฑ์ยอดซื้อ")),
      pointRate: num(t.pointRate, 0, 10, "อัตราแต้ม"),
      benefits: {
        discountPct: num(t.benefits?.discountPct ?? 0, 0, 100, "ส่วนลดร้าน"),
        birthdayPointMultiplier: num(t.benefits?.birthdayPointMultiplier ?? 1, 1, 10, "ตัวคูณเดือนเกิด"),
        simDiscountPct: num(t.benefits?.simDiscountPct ?? 0, 0, 100, "ส่วนลดซิม"),
        simBookingDaysAhead: Math.round(num(t.benefits?.simBookingDaysAhead ?? 14, 1, 90, "จองล่วงหน้า")),
        exclusiveCampaigns: !!t.benefits?.exclusiveCampaigns,
      },
    };
  });
  clean.sort((a, b) => a.minSpend12m - b.minSpend12m);
  if (clean[0]!.minSpend12m !== 0) throw new CoreError("INVALID_INPUT", "ระดับแรกต้องมีเกณฑ์ ฿0");
  if (new Set(clean.map((t) => t.key)).size !== clean.length) throw new CoreError("INVALID_INPUT", "รหัสระดับซ้ำกัน");
  if (new Set(clean.map((t) => t.minSpend12m)).size !== clean.length) throw new CoreError("INVALID_INPUT", "เกณฑ์ยอดซื้อของแต่ละระดับต้องไม่เท่ากัน");
  const { settings } = await getOrg(orgId);
  const removed = settings.tiers.filter((t) => !clean.some((c) => c.key === t.key)).map((t) => t.key);
  if (removed.length) {
    const inUse = await db(orgId).member.count({ where: { tier: { in: removed }, status: "ACTIVE" } });
    if (inUse) throw new CoreError("INVALID_INPUT", `ยังมีสมาชิก ${inUse} คนอยู่ในระดับที่ลบ (${removed.join(", ")}) — เปลี่ยนชื่อได้ แต่อย่าเปลี่ยนรหัส`);
  }
  const next = await updateSettings(orgId, { tiers: clean });
  await audited(orgId, actor, "settings.tiers", settings.tiers, clean);
  return next;
}

export async function saveBookingRules(orgId: string, actor: Actor, input: Partial<BookingSettings>): Promise<ResolvedSettings> {
  const { settings } = await getOrg(orgId);
  const b = { ...settings.booking, ...input };
  const clean: BookingSettings = {
    slotMinutes: 60, // one-hour slots are fixed in Phase 1 (the unique index assumes it)
    holdMinutes: Math.round(num(b.holdMinutes, 1, 30, "เวลาถือช่อง")),
    maxSlotsPerDay: Math.round(num(b.maxSlotsPerDay, 1, 12, "จำนวนช่องต่อวัน")),
    maxUpcoming: Math.round(num(b.maxUpcoming, 1, 30, "การจองค้าง")),
    cancelHoursBefore: num(b.cancelHoursBefore, 0, 72, "ยกเลิกล่วงหน้า"),
    noShowGraceMinutes: Math.round(num(b.noShowGraceMinutes, 0, 120, "เวลาผ่อนผัน no-show")),
    reminderHoursBefore: num(b.reminderHoursBefore, 0.5, 48, "เตือนล่วงหน้า"),
  };
  const next = await updateSettings(orgId, { booking: clean });
  await audited(orgId, actor, "settings.booking", settings.booking, clean);
  return next;
}

export async function saveNotificationToggles(orgId: string, actor: Actor, input: Partial<NotificationSettings>): Promise<ResolvedSettings> {
  const { settings } = await getOrg(orgId);
  const clean = { ...settings.notifications };
  for (const k of Object.keys(clean) as Array<keyof NotificationSettings>) if (typeof input[k] === "boolean") clean[k] = input[k]!;
  const next = await updateSettings(orgId, { notifications: clean });
  await audited(orgId, actor, "settings.notifications", settings.notifications, clean);
  return next;
}

export async function savePointRules(orgId: string, actor: Actor, input: { welcomeBonus?: number; perBaht?: number }): Promise<ResolvedSettings> {
  const { settings } = await getOrg(orgId);
  const raw = settings.raw.points ?? { perBaht: 1, signupBonus: 1600, birthdayBonus: 0, expiryMonths: 12 };
  const points: OrgSettings["points"] = {
    ...raw,
    perBaht: input.perBaht === undefined ? settings.pointsPerBaht : num(input.perBaht, 0.01, 100, "แต้มต่อบาท"),
    signupBonus: input.welcomeBonus === undefined ? settings.welcomeBonus : Math.round(num(input.welcomeBonus, 0, 100_000, "แต้มต้อนรับ")),
  };
  const next = await updateSettings(orgId, { points });
  await audited(orgId, actor, "settings.points", { perBaht: settings.pointsPerBaht, welcomeBonus: settings.welcomeBonus }, { perBaht: points.perBaht, welcomeBonus: points.signupBonus });
  return next;
}

export async function savePosRules(orgId: string, actor: Actor, input: Partial<Pick<PosSettings, "memberTag" | "pointExcludedSkus" | "pointExcludedCategories">>): Promise<ResolvedSettings> {
  const { settings } = await getOrg(orgId);
  const list = (v: unknown) => (Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean).slice(0, 200) : undefined);
  const tag = input.memberTag?.trim();
  if (tag !== undefined && !/^[A-Za-z]{3,20}$/.test(tag)) throw new CoreError("INVALID_INPUT", "คำนำหน้าในหมายเหตุใช้ได้เฉพาะตัวอักษร A-Z 3–20 ตัว");
  const pos: PosSettings = {
    ...settings.pos,
    memberTag: tag ?? settings.pos.memberTag,
    pointExcludedSkus: list(input.pointExcludedSkus) ?? settings.pos.pointExcludedSkus,
    pointExcludedCategories: list(input.pointExcludedCategories) ?? settings.pos.pointExcludedCategories,
  };
  const next = await updateSettings(orgId, { pos });
  await audited(orgId, actor, "settings.pos", settings.pos, pos);
  return next;
}

export async function saveSite(orgId: string, actor: Actor, input: SiteSettings): Promise<ResolvedSettings> {
  const { settings } = await getOrg(orgId);
  const url = (v: string | undefined, label: string) => {
    const s = v?.trim();
    if (!s) return undefined;
    if (!/^https:\/\/[^\s]+$/.test(s)) throw new CoreError("INVALID_INPUT", `${label} ต้องขึ้นต้นด้วย https://`);
    return s.replace(/\/$/, "");
  };
  const site: SiteSettings = {
    ...settings.site, // photos and copy are saved by saveSiteContent
    lineOaUrl: url(input.lineOaUrl, "ลิงก์ LINE OA"),
    mapsUrl: url(input.mapsUrl, "ลิงก์ Google Maps"),
    siteUrl: url(input.siteUrl, "โดเมนเว็บไซต์"),
    phone: input.phone?.trim() || undefined,
    address: input.address?.trim() || undefined,
  };
  const next = await updateSettings(orgId, { site });
  await audited(orgId, actor, "settings.site", settings.site, site);
  return next;
}

export interface SiteContentInput {
  photos?: Partial<Record<string, string | null>>;
  copy?: SiteCopy;
}

const clip = (v: unknown, max: number): string | undefined => {
  const s = typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : "";
  return s ? s.slice(0, max) : undefined;
};

/**
 * Website photos and text (Settings live in Organization.settings.site). A blank
 * field means "use the built-in placeholder", so MST can fill the site in any
 * order. Editable by whoever manages the website (posts.manage).
 */
export async function saveSiteContent(orgId: string, actor: Actor, input: SiteContentInput): Promise<ResolvedSettings> {
  const { settings } = await getOrg(orgId);
  const photos: Partial<Record<SitePhotoKey, string>> = {};
  for (const key of SITE_PHOTO_KEYS) {
    const v = input.photos?.[key]?.trim();
    if (!v) continue;
    if (!/^https:\/\/\S+$/.test(v) && !/^\/[\w\-./]+$/.test(v)) throw new CoreError("INVALID_INPUT", "ลิงก์รูปต้องขึ้นต้นด้วย https://");
    photos[key] = v.slice(0, 500);
  }
  const c = input.copy ?? {};
  const services: SiteCopy["services"] = {};
  for (const slug of SITE_SERVICE_SLUGS) {
    const sv = c.services?.[slug];
    const out = { short: clip(sv?.short, 200), body: clip(sv?.body, 2000), points: clip(sv?.points, 600) };
    if (out.short || out.body || out.points) services[slug] = out;
  }
  const copy: SiteCopy = {
    heroTitle: clip(c.heroTitle, 60),
    heroHighlight: clip(c.heroHighlight, 60),
    heroLede: clip(c.heroLede, 300),
    servicesTitle: clip(c.servicesTitle, 80),
    servicesLede: clip(c.servicesLede, 300),
    services,
  };
  const site: SiteSettings = { ...settings.site, photos, copy };
  const next = await updateSettings(orgId, { site });
  await audited(orgId, actor, "settings.site_content", { photos: settings.site.photos ?? {}, copy: settings.site.copy ?? {} }, { photos, copy });
  return next;
}

// ---------------------------------------------------------------------------
// Store and lanes
// ---------------------------------------------------------------------------

const DAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function validateOpenHours(input: OpenHours): OpenHours {
  const out: OpenHours = {};
  for (const d of DAYS) {
    const v = input[d];
    if (!v) {
      out[d] = null;
      continue;
    }
    const open = parseHm(v[0]);
    const close = parseHm(v[1]);
    if (open === null || close === null || close <= open) throw new CoreError("INVALID_INPUT", `เวลาเปิดปิดวัน ${d} ไม่ถูกต้อง`);
    out[d] = [v[0], v[1]];
  }
  return out;
}

export async function saveStore(
  orgId: string,
  actor: Actor,
  id: string | null,
  input: { code: string; name: string; address?: string | null; openHours: OpenHours; isActive?: boolean },
): Promise<{ id: string }> {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,20}$/.test(code)) throw new CoreError("INVALID_INPUT", "รหัสสาขาใช้ A-Z 0-9 2–20 ตัว");
  const name = input.name.trim();
  if (!name) throw new CoreError("INVALID_INPUT", "ใส่ชื่อสาขา");
  const openHours = validateOpenHours(input.openHours);
  return inTx(orgId, async (tx) => {
    const existing = id ? await tx.store.findFirst({ where: { id } }) : null;
    if (id && !existing) throw new CoreError("NOT_FOUND", "ไม่พบสาขา");
    const data = { code, name, address: input.address?.trim() || null, openHours, isActive: input.isActive ?? true };
    const saved = existing ? await tx.store.update({ where: { id: existing.id }, data }) : await tx.store.create({ data: { orgId, ...data } });
    await writeAudit(tx, orgId, actor, { action: existing ? "store.update" : "store.create", entity: "store", entityId: saved.id, before: existing, after: data });
    return { id: saved.id };
  });
}

export async function saveLane(
  orgId: string,
  actor: Actor,
  id: string | null,
  input: { storeId: string; name: string; capacity: number; hourlyPrice: string | number; sortOrder?: number; isActive?: boolean },
): Promise<{ id: string }> {
  const name = input.name.trim();
  if (!name) throw new CoreError("INVALID_INPUT", "ใส่ชื่อ lane");
  const capacity = Math.round(num(input.capacity, 1, 10, "จำนวนคนต่อ lane"));
  const price = toSatang(input.hourlyPrice);
  if (price === null || price < 0) throw new CoreError("INVALID_INPUT", "ราคาไม่ถูกต้อง");
  return inTx(orgId, async (tx) => {
    const store = await tx.store.findFirst({ where: { id: input.storeId } });
    if (!store) throw new CoreError("NOT_FOUND", "ไม่พบสาขา");
    const existing = id ? await tx.lane.findFirst({ where: { id } }) : null;
    if (id && !existing) throw new CoreError("NOT_FOUND", "ไม่พบ lane");
    const data = { storeId: store.id, name: name.slice(0, 40), capacity, hourlyPriceSatang: price, sortOrder: input.sortOrder ?? existing?.sortOrder ?? 0, isActive: input.isActive ?? true };
    const saved = existing ? await tx.lane.update({ where: { id: existing.id }, data }) : await tx.lane.create({ data: { orgId, ...data } });
    await writeAudit(tx, orgId, actor, { action: existing ? "lane.update" : "lane.create", entity: "lane", entityId: saved.id, before: existing, after: data });
    return { id: saved.id };
  });
}

export async function listStores(orgId: string) {
  return db(orgId).store.findMany({ orderBy: { createdAt: "asc" }, include: { lanes: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } } });
}

// ---------------------------------------------------------------------------
// Consent texts (PDPA wording, versioned)
// ---------------------------------------------------------------------------

export async function currentConsentTexts(orgId: string) {
  const client = db(orgId);
  const pick = (purpose: ConsentPurpose) =>
    client.consentText.findFirst({ where: { purpose, effectiveAt: { lte: new Date() } }, orderBy: { effectiveAt: "desc" } });
  const [terms, marketing] = await Promise.all([pick("TERMS"), pick("MARKETING")]);
  return { terms, marketing };
}

export async function publishConsentText(orgId: string, actor: Actor, input: { purpose: ConsentPurpose; title: string; body: string }) {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || body.length < 20) throw new CoreError("INVALID_INPUT", "ใส่หัวข้อและเนื้อหาให้ครบ");
  return inTx(orgId, async (tx) => {
    const count = await tx.consentText.count({ where: { purpose: input.purpose } });
    const version = `v${count + 1}`;
    const saved = await tx.consentText.create({ data: { orgId, purpose: input.purpose, version, title, body } });
    await writeAudit(tx, orgId, actor, { action: "consent_text.publish", entity: "consent_text", entityId: saved.id, after: { purpose: input.purpose, version } });
    return saved;
  });
}

// ---------------------------------------------------------------------------
// LINE credentials (from the LINE agency)
// ---------------------------------------------------------------------------

export interface LineChannelInput {
  channelId: string; // Messaging API channel id
  channelSecret?: string; // leave blank to keep
  accessToken?: string; // leave blank to keep
  liffId?: string | null;
  loginChannelId?: string | null;
}

export async function saveLineChannel(orgId: string, actor: Actor, input: LineChannelInput): Promise<void> {
  const channelId = input.channelId.trim();
  if (!/^\d{6,}$/.test(channelId)) throw new CoreError("INVALID_INPUT", "Channel ID ของ Messaging API เป็นตัวเลข");
  const liffId = input.liffId?.trim() || null;
  if (liffId && !/^\d+-[A-Za-z0-9]+$/.test(liffId)) throw new CoreError("INVALID_INPUT", "LIFF ID ไม่ถูกต้อง (รูปแบบ 1234567890-AbCdEfGh)");
  const loginChannelId = input.loginChannelId?.trim() || null;
  if (loginChannelId && !/^\d{6,}$/.test(loginChannelId)) throw new CoreError("INVALID_INPUT", "Channel ID ของ LINE Login เป็นตัวเลข");
  await inTx(orgId, async (tx) => {
    const existing = await tx.lineChannel.findFirst({ where: { channelId } });
    const secret = input.channelSecret?.trim();
    const token = input.accessToken?.trim();
    if (!existing && (!secret || !token)) throw new CoreError("INVALID_INPUT", "ครั้งแรกต้องใส่ Channel secret และ Channel access token");
    await tx.lineChannel.updateMany({ where: { channelId: { not: channelId } }, data: { isActive: false } });
    const data = {
      liffId,
      loginChannelId,
      isActive: true,
      ...(secret ? { channelSecretEnc: encrypt(secret) } : {}),
      ...(token ? { channelAccessTokenEnc: encrypt(token) } : {}),
    };
    if (existing) await tx.lineChannel.update({ where: { id: existing.id }, data });
    else await tx.lineChannel.create({ data: { orgId, channelId, channelSecretEnc: encrypt(secret!), channelAccessTokenEnc: encrypt(token!), liffId, loginChannelId } });
    await writeAudit(tx, orgId, actor, {
      action: "line.save",
      entity: "line_channel",
      entityId: channelId,
      after: { channelId, liffId, loginChannelId, secretChanged: !!secret, tokenChanged: !!token },
    });
  });
}

export async function lineChannelStatus(orgId: string) {
  const ch = await db(orgId).lineChannel.findFirst({ where: { isActive: true }, orderBy: { updatedAt: "desc" } });
  return ch ? { channelId: ch.channelId, liffId: ch.liffId, loginChannelId: ch.loginChannelId, updatedAt: ch.updatedAt } : null;
}

export type { BlockReason };
