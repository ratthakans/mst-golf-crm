import type { PostInput } from "@mstgolf/core";

export function postInput(b: Record<string, unknown>): PostInput {
  const s = (v: unknown) => (typeof v === "string" ? v : undefined);
  const category = b.category === "SERVICE" || b.category === "NEWS" || b.category === "ARTICLE" || b.category === "PROMOTION" ? b.category : undefined;
  const status = b.status === "PUBLISHED" || b.status === "DRAFT" ? b.status : undefined;
  const cover = s(b.coverUrl);
  return {
    title: s(b.title) ?? "",
    slug: s(b.slug),
    excerpt: s(b.excerpt),
    body: s(b.body),
    coverUrl: b.coverUrl === null ? null : cover === undefined ? undefined : cover.trim() && /^https:\/\//.test(cover.trim()) ? cover.trim() : null,
    category,
    status,
    startsAt: b.startsAt === null ? null : s(b.startsAt),
    endsAt: b.endsAt === null ? null : s(b.endsAt),
    linkUrl: b.linkUrl === null ? null : s(b.linkUrl),
    linkLabel: b.linkLabel === null ? null : s(b.linkLabel),
  };
}
