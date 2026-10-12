import type { PostCategory, PostStatus } from "@mstgolf/database";
import { writeAudit } from "./audit";
import type { Actor } from "./context";
import { db, inTx } from "./db";
import { CoreError, isUniqueViolation } from "./errors";
import { DAY_MS, fromLocal, localDateKey } from "./time";

// Website articles and promotions (docs/PRODUCT.md §7.2). Markdown bodies; MST's
// marketing team writes them in the back office and the website renders
// published ones. A PROMOTION also has a date window and an optional "shop now"
// link, and disappears from the site by itself when it ends.

export interface PostInput {
  title: string;
  slug?: string;
  excerpt?: string;
  coverUrl?: string | null;
  body?: string;
  category?: PostCategory;
  status?: PostStatus;
  startsAt?: string | null; // YYYY-MM-DD, Bangkok — promotions only
  endsAt?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
}

export interface PostView {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  body: string;
  category: PostCategory;
  status: PostStatus;
  publishedAt: Date | null;
  updatedAt: Date;
  startsAt: Date | null;
  endsAt: Date | null;
  linkUrl: string | null;
  linkLabel: string | null;
}

/** A promotion's dates as the back office edits them (YYYY-MM-DD, Bangkok). */
export function promoDateKey(d: Date | null, end = false): string {
  if (!d) return "";
  return localDateKey(end ? new Date(d.getTime() - 1) : d);
}

function promoDate(v: string | null | undefined, end: boolean): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) throw new CoreError("INVALID_INPUT", "วันที่โปรโมชันไม่ถูกต้อง");
  const start = fromLocal(Number(m[1]), Number(m[2]), Number(m[3]));
  return end ? new Date(start.getTime() + DAY_MS) : start; // an end date includes that whole day
}

export function slugify(title: string): string {
  const ascii = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\x00-\x7f]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return ascii.length >= 3 ? ascii : `post-${Date.now().toString(36)}`;
}

function cleanSlug(s: string): string {
  const v = s.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(v)) throw new CoreError("INVALID_INPUT", "slug ใช้ได้เฉพาะ a-z 0-9 และขีด (-) ยาว 2–80 ตัว");
  return v;
}

const toView = (p: PostView & Record<string, unknown>): PostView => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  excerpt: p.excerpt,
  coverUrl: p.coverUrl,
  body: p.body,
  category: p.category,
  status: p.status,
  publishedAt: p.publishedAt,
  updatedAt: p.updatedAt,
  startsAt: p.startsAt,
  endsAt: p.endsAt,
  linkUrl: p.linkUrl,
  linkLabel: p.linkLabel,
});

export async function listPosts(
  orgId: string,
  opts: { publishedOnly?: boolean; category?: PostCategory; excludeCategory?: PostCategory; limit?: number } = {},
): Promise<PostView[]> {
  const rows = await db(orgId).post.findMany({
    where: {
      ...(opts.publishedOnly ? { status: "PUBLISHED" as const, publishedAt: { lte: new Date() } } : {}),
      ...(opts.category ? { category: opts.category } : opts.excludeCategory ? { category: { not: opts.excludeCategory } } : {}),
    },
    orderBy: opts.publishedOnly ? { publishedAt: "desc" } : { updatedAt: "desc" },
    take: opts.limit ?? 100,
  });
  return rows.map(toView);
}

/** Promotions running now: published, inside their date window, newest first. */
export async function activePromotions(orgId: string, now = new Date(), limit = 12): Promise<PostView[]> {
  const rows = await db(orgId).post.findMany({
    where: {
      category: "PROMOTION",
      status: "PUBLISHED",
      publishedAt: { lte: now },
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    orderBy: [{ startsAt: "desc" }, { publishedAt: "desc" }],
    take: limit,
  });
  return rows.map(toView);
}

export async function getPost(orgId: string, key: { id?: string; slug?: string; publishedOnly?: boolean }): Promise<PostView | null> {
  const p = await db(orgId).post.findFirst({
    where: {
      ...(key.id ? { id: key.id } : { slug: key.slug }),
      ...(key.publishedOnly ? { status: "PUBLISHED" as const, publishedAt: { lte: new Date() } } : {}),
    },
  });
  return p ? toView(p) : null;
}

export async function savePost(orgId: string, actor: Actor, id: string | null, input: PostInput): Promise<PostView> {
  const title = input.title?.trim();
  if (!title) throw new CoreError("INVALID_INPUT", "ใส่ชื่อเรื่อง");
  const slug = input.slug?.trim() ? cleanSlug(input.slug) : slugify(title);
  try {
    return await inTx(orgId, async (tx) => {
      const existing = id ? await tx.post.findFirst({ where: { id } }) : null;
      if (id && !existing) throw new CoreError("NOT_FOUND", "ไม่พบบทความ");
      const status = input.status ?? existing?.status ?? "DRAFT";
      const category = input.category ?? existing?.category ?? "ARTICLE";
      const promo = category === "PROMOTION";
      const startsAt = promo ? (input.startsAt === undefined ? existing?.startsAt ?? null : promoDate(input.startsAt, false)) : null;
      const endsAt = promo ? (input.endsAt === undefined ? existing?.endsAt ?? null : promoDate(input.endsAt, true)) : null;
      if (startsAt && endsAt && endsAt <= startsAt) throw new CoreError("INVALID_INPUT", "วันสิ้นสุดโปรโมชันต้องอยู่หลังวันเริ่ม");
      const link = input.linkUrl === undefined ? existing?.linkUrl ?? null : input.linkUrl?.trim() || null;
      if (link && !/^(https:\/\/|\/)[^\s]+$/.test(link)) throw new CoreError("INVALID_INPUT", "ลิงก์ต้องขึ้นต้นด้วย https:// หรือ / (หน้าในเว็บนี้)");
      const data = {
        title: title.slice(0, 160),
        slug,
        excerpt: (input.excerpt ?? existing?.excerpt ?? "").trim().slice(0, 300),
        coverUrl: input.coverUrl === undefined ? existing?.coverUrl ?? null : input.coverUrl,
        body: input.body ?? existing?.body ?? "",
        category,
        status,
        startsAt,
        endsAt,
        linkUrl: promo ? link : null,
        linkLabel: promo && link ? (input.linkLabel === undefined ? existing?.linkLabel ?? null : input.linkLabel?.trim().slice(0, 40) || null) : null,
        publishedAt: status === "PUBLISHED" ? existing?.publishedAt ?? new Date() : null,
      };
      const saved = existing
        ? await tx.post.update({ where: { id: existing.id }, data })
        : await tx.post.create({ data: { orgId, ...data, authorId: actor.kind === "staff" ? actor.userId : null } });
      await writeAudit(tx, orgId, actor, {
        action: existing ? "post.update" : "post.create",
        entity: "post",
        entityId: saved.id,
        after: { title: saved.title, status: saved.status },
      });
      return toView(saved);
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new CoreError("INVALID_INPUT", "slug นี้มีบทความอื่นใช้แล้ว");
    throw e;
  }
}

export async function deletePost(orgId: string, actor: Actor, id: string): Promise<{ coverUrl: string | null }> {
  return inTx(orgId, async (tx) => {
    const p = await tx.post.findFirst({ where: { id } });
    if (!p) throw new CoreError("NOT_FOUND", "ไม่พบบทความ");
    await tx.post.delete({ where: { id: p.id } });
    await writeAudit(tx, orgId, actor, { action: "post.delete", entity: "post", entityId: p.id, before: { title: p.title } });
    return { coverUrl: p.coverUrl };
  });
}
