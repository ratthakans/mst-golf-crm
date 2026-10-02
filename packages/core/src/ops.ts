import type { Prisma } from "@mstgolf/database";
import { prisma } from "@mstgolf/database";
import { SITE_PHOTO_KEYS } from "@mstgolf/shared";
import { earnRateText } from "@mstgolf/shared/tiers";
import { writeAudit } from "./audit";
import type { Actor } from "./context";
import { currentConsentTexts, lineChannelStatus, listStores } from "./config";
import { db, inTx } from "./db";
import { CoreError } from "./errors";
import { formatBaht } from "./money";
import { getOrg, updateSettings } from "./settings";

// Operations (docs/PRODUCT.md §4.4): when scheduled jobs last ran, what the
// system looks like right now, and the go-live checklist (Settings ›
// ความพร้อมเปิดใช้ / สถานะระบบ). Reads only; the one write is MST confirming a
// checklist item, which is audited.

export type JobKind = "nightly" | "frequent" | "backup";
const KEEP_DAYS = 60;

/** Records one run of a job for every active org (jobs span all orgs). */
export async function recordJobRun(kind: JobKind, run: { startedAt: Date; ok: boolean; detail?: unknown; error?: string | null; orgIds?: string[] }): Promise<void> {
  const orgIds = run.orgIds ?? (await prisma.organization.findMany({ where: { isActive: true }, select: { id: true } })).map((o) => o.id);
  const finishedAt = new Date();
  for (const orgId of orgIds) {
    await db(orgId).jobRun.create({
      data: {
        orgId,
        kind,
        ok: run.ok,
        startedAt: run.startedAt,
        finishedAt,
        detail: (run.detail ?? {}) as Prisma.InputJsonValue,
        error: run.error?.slice(0, 500) ?? null,
      },
    });
  }
}

/** Runs a job and records the outcome, success or failure; rethrows failures. */
export async function runRecorded<T>(kind: JobKind, fn: () => Promise<T>, detail: (r: T) => unknown = (r) => r): Promise<T> {
  const startedAt = new Date();
  try {
    const r = await fn();
    await recordJobRun(kind, { startedAt, ok: true, detail: detail(r) });
    return r;
  } catch (e) {
    await recordJobRun(kind, { startedAt, ok: false, error: e instanceof Error ? e.message : String(e) }).catch(() => undefined);
    throw e;
  }
}

export async function pruneJobRuns(orgId: string, now = new Date()): Promise<number> {
  const r = await db(orgId).jobRun.deleteMany({ where: { startedAt: { lt: new Date(now.getTime() - KEEP_DAYS * 24 * 3600_000) } } });
  return r.count;
}

// ---------------------------------------------------------------------------
// System status
// ---------------------------------------------------------------------------

export interface JobHealth {
  kind: JobKind;
  label: string;
  expectEveryMin: number;
  last: { at: Date; ok: boolean; error: string | null; detail: unknown } | null;
  lastOkAt: Date | null;
  state: "ok" | "late" | "failed" | "never";
}

const JOBS: Array<{ kind: JobKind; label: string; everyMin: number }> = [
  { kind: "nightly", label: "งานกลางคืน (02:00) — ยอด 12 เดือน ระดับ ปิดการจอง ตรวจแต้ม", everyMin: 24 * 60 },
  { kind: "frequent", label: "งานทุก 15 นาที — เตือนก่อนจอง ส่งข้อความ LINE", everyMin: 15 },
  { kind: "backup", label: "สำรองฐานข้อมูล (03:00)", everyMin: 24 * 60 },
];

export async function systemStatus(orgId: string, now = new Date()) {
  const client = db(orgId);
  const jobs: JobHealth[] = [];
  for (const j of JOBS) {
    const [last, lastOk] = await Promise.all([
      client.jobRun.findFirst({ where: { kind: j.kind }, orderBy: { startedAt: "desc" } }),
      client.jobRun.findFirst({ where: { kind: j.kind, ok: true }, orderBy: { startedAt: "desc" }, select: { startedAt: true } }),
    ]);
    // Late once twice the interval has passed without a successful run (plus slack for the daily jobs).
    const grace = (j.everyMin * 2 + (j.everyMin >= 1440 ? 120 : 15)) * 60_000;
    const state: JobHealth["state"] = !last ? "never" : !last.ok ? "failed" : now.getTime() - last.startedAt.getTime() > grace ? "late" : "ok";
    jobs.push({
      kind: j.kind,
      label: j.label,
      expectEveryMin: j.everyMin,
      last: last ? { at: last.startedAt, ok: last.ok, error: last.error, detail: last.detail } : null,
      lastOkAt: lastOk?.startedAt ?? null,
      state,
    });
  }
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
  const [pending, failed, skipped, sent, oldestPending, lastImport, failedImports] = await Promise.all([
    client.notification.count({ where: { status: "PENDING" } }),
    client.notification.count({ where: { status: "FAILED", createdAt: { gte: weekAgo } } }),
    client.notification.count({ where: { status: "SKIPPED", createdAt: { gte: weekAgo } } }),
    client.notification.count({ where: { status: "SENT", createdAt: { gte: weekAgo } } }),
    client.notification.findFirst({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    client.importBatch.findFirst({ where: { status: "COMMITTED" }, orderBy: { committedAt: "desc" }, include: { store: { select: { name: true } } } }),
    client.importBatch.count({ where: { status: "PREVIEW", createdAt: { lt: new Date(now.getTime() - 3600_000) } } }),
  ]);
  const env = {
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    CRON_SECRET: !!process.env.CRON_SECRET,
    ENCRYPTION_KEY: !!process.env.ENCRYPTION_KEY,
    PUBLIC_BLOB_READ_WRITE_TOKEN: !!process.env.PUBLIC_BLOB_READ_WRITE_TOKEN,
    EMAIL: !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM,
    DATABASE_SCHEMA: process.env.DATABASE_SCHEMA || "public",
  };
  return {
    jobs,
    outbox: { pending, failed, skipped, sent, oldestPendingAt: oldestPending?.createdAt ?? null },
    lastImport: lastImport ? { at: lastImport.committedAt, fileName: lastImport.fileName, store: lastImport.store.name, counts: lastImport.counts as Record<string, unknown> } : null,
    abandonedPreviews: failedImports,
    env,
  };
}

// ---------------------------------------------------------------------------
// Go-live readiness
// ---------------------------------------------------------------------------

export type ReadyState = "ok" | "todo" | "confirm" | "waiting";
export interface ReadyItem {
  key: string;
  group: "website" | "store" | "members" | "rewards" | "pos" | "team" | "line" | "system";
  label: string;
  state: ReadyState; // confirm = the value is set, MST must say it is right
  detail: string;
  owner: "MST" | "ORIONS" | "ทีม LINE";
  href?: string;
  confirmed?: { at: string; by: string } | null;
}

/** Items MST confirms by pressing a button (the value exists; only MST knows it is right). */
export const CONFIRMABLE = ["store.hours", "store.lanes", "booking.rules", "members.tiers", "members.points", "pos.excluded", "consent.legal", "site.copy", "rewards.catalogue"] as const;
export type ConfirmKey = (typeof CONFIRMABLE)[number];

const DAY_TH: Record<string, string> = { mon: "จ", tue: "อ", wed: "พ", thu: "พฤ", fri: "ศ", sat: "ส", sun: "อา" };
function hoursText(raw: unknown): string {
  const h = (raw && typeof raw === "object" ? raw : {}) as Record<string, [string, string] | null>;
  const parts = Object.keys(DAY_TH).map((d) => (h[d] ? `${h[d]![0]}–${h[d]![1]}` : "ปิด"));
  if (parts.every((p) => p === parts[0])) return parts[0] === "ปิด" ? "ยังไม่ได้ตั้งเวลาเปิด" : `ทุกวัน ${parts[0]}`;
  return Object.keys(DAY_TH).map((d, i) => `${DAY_TH[d]} ${parts[i]}`).join(" · ");
}

export async function readiness(orgId: string, now = new Date()): Promise<ReadyItem[]> {
  const { settings } = await getOrg(orgId);
  const client = db(orgId);
  const confirmed = settings.raw.readiness ?? {};
  const c = (key: ConfirmKey) => confirmed[key] ?? null;
  const site = settings.site;
  const [stores, line, consent, posts, commits, users, status, rewards] = await Promise.all([
    listStores(orgId),
    lineChannelStatus(orgId),
    currentConsentTexts(orgId),
    client.post.count({ where: { status: "PUBLISHED" } }),
    client.importBatch.count({ where: { status: "COMMITTED", mode: "DAILY" } }),
    client.user.count({ where: { isActive: true } }),
    systemStatus(orgId, now),
    client.reward.findMany({ where: { isActive: true }, select: { name: true, costPoints: true }, orderBy: { costPoints: "asc" } }),
  ]);
  const store = stores.find((s) => s.isActive) ?? null;
  const lanes = store?.lanes.filter((l) => l.isActive) ?? [];
  const realPhotos = SITE_PHOTO_KEYS.filter((k) => site.photos?.[k]).length;
  const edited = !!(site.copy && (site.copy.heroTitle || site.copy.heroLede || Object.keys(site.copy.services ?? {}).length));
  const b = settings.booking;
  const items: ReadyItem[] = [];
  const add = (i: ReadyItem) => items.push(i);
  const confirmState = (key: ConfirmKey, hasValue = true): ReadyState => (!hasValue ? "todo" : c(key) ? "ok" : "confirm");

  // Website
  add({ key: "site.domain", group: "website", label: "โดเมนเว็บไซต์", owner: "MST", href: "/settings/site", state: site.siteUrl ? "ok" : "waiting", detail: site.siteUrl ?? "ยังไม่มี — เว็บยังอยู่ที่ *.vercel.app" });
  add({ key: "site.photos", group: "website", label: "รูปจริงของร้านแทนรูปตัวอย่าง", owner: "MST", href: "/website/content", state: realPhotos === SITE_PHOTO_KEYS.length ? "ok" : "waiting", detail: `รูปจริง ${realPhotos} จาก ${SITE_PHOTO_KEYS.length} รูป — ที่เหลือยังเป็นภาพ AI` });
  add({ key: "site.copy", group: "website", label: "ข้อความหน้าเว็บ", owner: "MST", href: "/website/content", state: confirmState("site.copy"), detail: edited ? "แก้แล้วบางส่วนในหลังบ้าน" : "ยังใช้ข้อความตั้งต้นของเรา", confirmed: c("site.copy") });
  add({ key: "site.contact", group: "website", label: "เบอร์ร้าน · ลิงก์ Google Maps", owner: "MST", href: "/settings/site", state: site.phone && site.mapsUrl ? "ok" : "waiting", detail: [site.phone ? `โทร ${site.phone}` : "ยังไม่มีเบอร์", site.mapsUrl ? "มีลิงก์แผนที่" : "ยังไม่มีลิงก์แผนที่"].join(" · ") });
  add({ key: "site.posts", group: "website", label: "บทความตั้งต้น", owner: "MST", href: "/website", state: posts >= 3 ? "ok" : "waiting", detail: `เผยแพร่แล้ว ${posts} บทความ (แนะนำอย่างน้อย 3)` });
  add({ key: "site.uploads", group: "website", label: "ที่เก็บรูปสำหรับอัปโหลด", owner: "ORIONS", state: status.env.PUBLIC_BLOB_READ_WRITE_TOKEN ? "ok" : "todo", detail: status.env.PUBLIC_BLOB_READ_WRITE_TOKEN ? "อัปโหลดรูปจากหลังบ้านได้" : "ยังอัปโหลดไม่ได้ — ใส่ลิงก์รูปแทนได้ระหว่างนี้" });

  // Store and booking
  add({ key: "store.hours", group: "store", label: "เวลาเปิดร้าน", owner: "MST", href: "/settings/booking", state: confirmState("store.hours", !!store), detail: store ? hoursText(store.openHours) : "ยังไม่มีสาขา", confirmed: c("store.hours") });
  add({ key: "store.lanes", group: "store", label: "lane และราคาซิม", owner: "MST", href: "/settings/booking", state: confirmState("store.lanes", lanes.length > 0), detail: lanes.length ? lanes.map((l) => `${l.name} ${formatBaht(l.hourlyPriceSatang)}/ชม. ${l.capacity} คน`).join(" · ") : "ยังไม่มี lane", confirmed: c("store.lanes") });
  add({ key: "booking.rules", group: "store", label: "กติกาการจอง ยกเลิก no-show", owner: "MST", href: "/settings/booking", state: confirmState("booking.rules"), detail: `ครั้งละ ${b.slotMinutes} นาที · วันละไม่เกิน ${b.maxSlotsPerDay} ช่อง · ยกเลิกเองก่อน ${b.cancelHoursBefore} ชม. · ไม่มาเกิน ${b.noShowGraceMinutes} นาที = no-show`, confirmed: c("booking.rules") });

  // Members and points
  add({ key: "members.tiers", group: "members", label: "ระดับสมาชิกและสิทธิ์", owner: "MST", href: "/settings/tiers", state: confirmState("members.tiers"), detail: settings.tiers.map((t) => `${t.name} ≥ ${formatBaht(t.minSpend12m * 100)} ×${t.pointRate} ลด ${t.benefits.discountPct}% ซิม ${t.benefits.simDiscountPct}%`).join(" · "), confirmed: c("members.tiers") });
  add({ key: "members.points", group: "members", label: "อัตราแต้ม · แต้มต้อนรับ", owner: "MST", href: "/settings/points", state: confirmState("members.points"), detail: `${earnRateText(settings.pointsPerBaht)} · ต้อนรับ ${settings.welcomeBonus.toLocaleString("en-US")} แต้ม`, confirmed: c("members.points") });
  add({ key: "pos.excluded", group: "members", label: "สินค้าที่ไม่ได้แต้ม", owner: "MST", href: "/settings/points", state: confirmState("pos.excluded"), detail: [...settings.pos.pointExcludedCategories, ...settings.pos.pointExcludedSkus].join(", ") || "ทุกสินค้าได้แต้ม", confirmed: c("pos.excluded") });
  add({ key: "consent.legal", group: "members", label: "ข้อกำหนดและนโยบายความเป็นส่วนตัว ผ่านฝ่ายกฎหมาย", owner: "MST", href: "/settings/consent", state: confirmState("consent.legal", !!consent.terms), detail: consent.terms ? `ข้อกำหนดฉบับ ${consent.terms.version}${consent.marketing ? ` · การรับข่าวสารฉบับ ${consent.marketing.version}` : ""}` : "ยังไม่มีข้อความ", confirmed: c("consent.legal") });

  // Rewards
  if (settings.features.rewards) {
    const alerts = settings.redemption.alertEmails;
    add({ key: "rewards.catalogue", group: "rewards", label: "รางวัลและคูปองที่เปิดให้แลก", owner: "MST", href: "/rewards/catalog", state: confirmState("rewards.catalogue", rewards.length > 0), detail: rewards.length ? rewards.map((r) => `${r.name} ${r.costPoints.toLocaleString("en-US")} แต้ม`).join(" · ") : "ยังไม่มีรางวัล — สมาชิกเห็นหน้ารางวัลว่าง", confirmed: c("rewards.catalogue") });
    add({ key: "rewards.alerts", group: "rewards", label: "อีเมลแจ้ง Marketing เมื่อมีคำขอแลกของ", owner: "MST", href: "/settings/rewards", state: alerts.length ? "ok" : "waiting", detail: alerts.length ? alerts.join(", ") : "ยังไม่มีอีเมลผู้รับ — คำขอยังเข้าคิวในหลังบ้านตามปกติ" });
    add({ key: "rewards.mailer", group: "rewards", label: "บริการส่งอีเมล", owner: "ORIONS", href: "/settings/system", state: status.env.EMAIL ? "ok" : "todo", detail: status.env.EMAIL ? "พร้อมส่ง" : "ยังไม่ได้ตั้ง RESEND_API_KEY / EMAIL_FROM — อีเมลจะถูกข้าม" });
  }

  // POS and team
  add({ key: "pos.file", group: "pos", label: "นำเข้าไฟล์ POS จริง", owner: "MST", href: "/import", state: commits > 0 ? "ok" : "waiting", detail: commits > 0 ? `นำเข้าแล้ว ${commits} รอบ` : "รอไฟล์ export จาก POS ของร้าน" });
  add({ key: "team.users", group: "team", label: "บัญชีพนักงาน", owner: "MST", href: "/settings/users", state: users >= 2 ? "ok" : "waiting", detail: `ใช้งานอยู่ ${users} บัญชี` });

  // LINE (the LINE agency's part)
  add({ key: "line.messaging", group: "line", label: "Messaging API", owner: "ทีม LINE", href: "/settings/line", state: line ? "ok" : "waiting", detail: line ? `Channel ${line.channelId}` : "ยังไม่ได้ credentials — ระบบไม่ส่งข้อความ LINE" });
  add({ key: "line.login", group: "line", label: "LINE Login + LIFF", owner: "ทีม LINE", href: "/settings/line", state: line?.liffId && line.loginChannelId ? "ok" : "waiting", detail: line?.liffId ? "พร้อม" : "ลูกค้ายังล็อกอินหน้าสมาชิก/หน้าจองไม่ได้" });
  add({ key: "line.oa", group: "line", label: "ลิงก์เพิ่มเพื่อน LINE OA", owner: "ทีม LINE", href: "/settings/site", state: site.lineOaUrl ? "ok" : "waiting", detail: site.lineOaUrl ?? "ยังไม่มี" });

  // System
  const envOk = status.env.AUTH_SECRET && status.env.CRON_SECRET && status.env.ENCRYPTION_KEY;
  add({ key: "system.env", group: "system", label: "ค่าระบบ (secrets)", owner: "ORIONS", href: "/settings/system", state: envOk ? "ok" : "todo", detail: envOk ? "ครบ" : "ยังไม่ครบ — ดูที่ สถานะระบบ" });
  for (const j of status.jobs) {
    add({
      key: `system.${j.kind}`,
      group: "system",
      label: j.kind === "nightly" ? "งานกลางคืน" : j.kind === "frequent" ? "งานทุก 15 นาที" : "สำรองฐานข้อมูล",
      owner: "ORIONS",
      href: "/settings/system",
      state: j.state === "ok" ? "ok" : "todo",
      detail: j.state === "never" ? "ยังไม่เคยรัน" : j.state === "failed" ? "รอบล่าสุดล้มเหลว" : j.state === "late" ? "ไม่ได้รันตามรอบ" : "รันตามรอบ",
    });
  }
  return items;
}

export async function confirmReadiness(orgId: string, actor: Actor, key: string, confirmed: boolean): Promise<void> {
  if (!(CONFIRMABLE as readonly string[]).includes(key)) throw new CoreError("INVALID_INPUT", "รายการนี้ยืนยันเองไม่ได้");
  if (actor.kind !== "staff") throw new CoreError("FORBIDDEN", "เฉพาะพนักงาน");
  const { settings } = await getOrg(orgId);
  const user = await db(orgId).user.findFirst({ where: { id: actor.userId }, select: { name: true, email: true } });
  const current = { ...(settings.raw.readiness ?? {}) };
  if (confirmed) current[key] = { at: new Date().toISOString(), by: user?.name || user?.email || "พนักงาน" };
  else delete current[key];
  await updateSettings(orgId, { readiness: current });
  await inTx(orgId, (tx) => writeAudit(tx, orgId, actor, { action: confirmed ? "readiness.confirm" : "readiness.unconfirm", entity: "settings", entityId: key }));
}
