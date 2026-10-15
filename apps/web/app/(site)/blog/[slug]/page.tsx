import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPost } from "@mstgolf/core";
import { CATEGORY_LABEL, formatThaiDate } from "@/lib/format";
import { getOrg } from "@/lib/org";

export const revalidate = 300;

const loadPost = cache(async (slug: string) => {
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(slug)) return null;
  const org = await getOrg();
  return getPost(org.id, { slug, publishedOnly: true });
});

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await loadPost(params.slug);
  if (!post || post.category === "PROMOTION") return { title: "ไม่พบบทความ", robots: { index: false } };
  const description = post.excerpt || post.body.replace(/[#*_>`[\]()!-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);
  return {
    title: post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url: `/blog/${post.slug}`,
      publishedTime: post.publishedAt?.toISOString(),
      ...(post.coverUrl ? { images: [{ url: post.coverUrl }] } : {}),
    },
  };
}

// Markdown is rendered by react-markdown: raw HTML in the body is not
// rendered and unsafe link protocols (javascript: …) are stripped.
export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await loadPost(params.slug);
  if (!post) notFound();
  // Promotions live at /promotions/<slug>, which hides them outside their dates.
  if (post.category === "PROMOTION") permanentRedirect(`/promotions/${post.slug}`);

  return (
    <article className="article">
      <div className="wrap article-wrap">
        <p className="post-meta article-meta">
          <span className="cat">{CATEGORY_LABEL[post.category]}</span>
          {post.publishedAt && <time dateTime={post.publishedAt.toISOString()}>{formatThaiDate(post.publishedAt)}</time>}
        </p>
        <header className="article-head">
          <h1 className="sh-title">{post.title}</h1>
          {post.excerpt && <p className="sh-lede">{post.excerpt}</p>}
        </header>
        {post.coverUrl && (
          <figure className="article-cover">
            {/* eslint-disable-next-line @next/next/no-img-element -- cover lives in MST's public Blob store */}
            <img src={post.coverUrl} alt="" width={1200} height={630} />
          </figure>
        )}
        <div className="md">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => {
                const external = !!href && /^https?:\/\//.test(href);
                return (
                  <a href={href} {...(external ? { target: "_blank", rel: "noopener nofollow" } : {})}>
                    {children}
                  </a>
                );
              },
              // eslint-disable-next-line @next/next/no-img-element
              img: ({ src, alt }) => (typeof src === "string" ? <img src={src} alt={alt ?? ""} loading="lazy" /> : null),
            }}
          >
            {post.body}
          </ReactMarkdown>
        </div>
        <aside className="pg-close">
          <p>อยากลองของจริง? จองซิมหรือนัดฟิตติ้งได้ทุกวัน</p>
          <div className="cta-row">
            <Link href="/app/booking" className="btn btn-primary">
              จองซิม
            </Link>
            <Link href="/services" className="text-link">
              ดูบริการ
            </Link>
          </div>
        </aside>
      </div>
    </article>
  );
}
