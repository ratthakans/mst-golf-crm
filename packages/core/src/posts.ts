import type { PostCategory, PostStatus } from "@mstgolf/database";
import { writeAudit } from "./audit";
import type { Actor } from "./context";
import { db, inTx } from "./db";
import { CoreError, isUniqueViolation } from "./errors";

// Website articles (docs/PRODUCT.md §7.2). Markdown bodies; MST's marketing team
// writes them in the back office and the website renders published ones.

export interface PostInput {
  title: string;
  slug?: string;
  excerpt?: string;
  coverUrl?: string | null;
  body?: string;
  category?: PostCategory;
  status?: PostStatus;
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
});

export async function listPosts(orgId: string, opts: { publishedOnly?: boolean; category?: PostCategory; limit?: number } = {}): Promise<PostView[]> {
  const rows = await db(orgId).post.findMany({
    where: {
      ...(opts.publishedOnly ? { status: "PUBLISHED" as const, publishedAt: { lte: new Date() } } : {}),
      ...(opts.category ? { category: opts.category } : {}),
    },
    orderBy: opts.publishedOnly ? { publishedAt: "desc" } : { updatedAt: "desc" },
    take: opts.limit ?? 100,
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
  if (!title) throw new CoreError("INVALID_INPUT", "ใส่ชื่อบทความ");
  const slug = input.slug?.trim() ? cleanSlug(input.slug) : slugify(title);
  try {
    return await inTx(orgId, async (tx) => {
      const existing = id ? await tx.post.findFirst({ where: { id } }) : null;
      if (id && !existing) throw new CoreError("NOT_FOUND", "ไม่พบบทความ");
      const status = input.status ?? existing?.status ?? "DRAFT";
      const data = {
        title: title.slice(0, 160),
        slug,
        excerpt: (input.excerpt ?? existing?.excerpt ?? "").trim().slice(0, 300),
        coverUrl: input.coverUrl === undefined ? existing?.coverUrl ?? null : input.coverUrl,
        body: input.body ?? existing?.body ?? "",
        category: input.category ?? existing?.category ?? "ARTICLE",
        status,
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
