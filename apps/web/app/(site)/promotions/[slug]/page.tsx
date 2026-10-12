import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPost } from "@mstgolf/core";
import { IconBack } from "@/components/icons";
import { formatThaiDate } from "@/lib/format";
import { getOrg } from "@/lib/org";

export const revalidate = 300;

// A promotion the visitor can read in full; it disappears (404) once it ends.
const loadPromo = cache(async (slug: string) => {
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(slug)) return null;
  const org = await getOrg();
  const p = await getPost(org.id, { slug, publishedOnly: true });
  if (!p || p.category !== "PROMOTION") return null;
  const now = new Date();
  if ((p.startsAt && p.startsAt > now) || (p.endsAt && p.endsAt <= now)) return null;
  return p;
});

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await loadPromo(params.slug);
  if (!p) return { title: "โปรโมชันนี้จบแล้ว", robots: { index: false } };
  return {
    title: p.title,
    description: p.excerpt || undefined,
    alternates: { canonical: `/promotions/${p.slug}` },
    openGraph: { title: p.title, description: p.excerpt || undefined, url: `/promotions/${p.slug}`, ...(p.coverUrl ? { images: [{ url: p.coverUrl }] } : {}) },
  };
}

export default async function PromotionPage({ params }: { params: { slug: string } }) {
  const p = await loadPromo(params.slug);
  if (!p) notFound();
  const lastDay = p.endsAt ? new Date(p.endsAt.getTime() - 1) : null;
  const external = !!p.linkUrl && /^https:\/\//.test(p.linkUrl);

  return (
    <article className="article promo-article">
      <div className="wrap article-wrap">
        <Link href="/promotions" className="link-arrow back">
          <IconBack size={18} />
          <span>โปรโมชันทั้งหมด</span>
        </Link>
        <header className="article-head">
          <p className="post-meta">
            <span className="cat cat-promotion">โปรโมชัน</span>
            <span>{lastDay ? `ถึง ${formatThaiDate(lastDay)}` : "ระยะเวลาจำกัด"}</span>
          </p>
          <h1>{p.title}</h1>
          {p.excerpt && <p className="lede">{p.excerpt}</p>}
          {p.linkUrl && (
            <p className="cta-row">
              {external ? (
                <a href={p.linkUrl} className="btn btn-primary" target="_blank" rel="noopener">
                  {p.linkLabel || "ดูรายละเอียด"}
                </a>
              ) : (
                <Link href={p.linkUrl} className="btn btn-primary">
                  {p.linkLabel || "ดูรายละเอียด"}
                </Link>
              )}
            </p>
          )}
        </header>
        {p.coverUrl && (
          <figure className="article-cover">
            {/* eslint-disable-next-line @next/next/no-img-element -- cover lives in MST's public Blob store */}
            <img src={p.coverUrl} alt="" width={1200} height={630} />
          </figure>
        )}
        {p.body.trim() && (
          <div className="md">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: () => null }}>
              {p.body}
            </ReactMarkdown>
          </div>
        )}
        <p className="promo-foot">
          สมาชิกได้แต้มทุกการซื้อ · <Link href="/rewards">สิทธิ์สมาชิก</Link> · <Link href="/contact">สอบถามร้าน</Link>
        </p>
      </div>
    </article>
  );
}
