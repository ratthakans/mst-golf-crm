import Link from "next/link";
import { CATEGORY_LABEL, formatThaiDate } from "@/lib/format";

export interface PostItem {
  slug: string;
  title: string;
  excerpt: string;
  category: "ARTICLE" | "SERVICE" | "NEWS";
  publishedAt: string | null;
  coverUrl: string | null;
}

export function PostList({ posts }: { posts: PostItem[] }) {
  return (
    <ul className="post-list">
      {posts.map((p) => (
        <li key={p.slug} className="post-item">
          <Link href={`/blog/${p.slug}`} className={`post-link${p.coverUrl ? " has-cover" : ""}`}>
            <span className="post-text">
              <span className="post-meta">
                <span className={`cat cat-${p.category.toLowerCase()}`}>{CATEGORY_LABEL[p.category]}</span>
                {p.publishedAt && <time dateTime={p.publishedAt}>{formatThaiDate(new Date(p.publishedAt))}</time>}
              </span>
              <span className="post-title">{p.title}</span>
              {p.excerpt && <span className="post-excerpt">{p.excerpt}</span>}
            </span>
            {p.coverUrl && (
              <span className="post-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element -- covers live in MST's public Blob store or /mock */}
                <img src={p.coverUrl} alt="" loading="lazy" width={320} height={200} />
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
