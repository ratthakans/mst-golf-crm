import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPost } from "@mstgolf/core";
import { SheetHead } from "@/components/SheetHead";
import { formatThaiDate } from "@/lib/format";
import { endsSoon, untilText } from "@/lib/promo";
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
  const lastDay = p.endsAt ? new Date(p.endsAt.getTime() - 1).toISOString() : null;
  const external = !!p.linkUrl && /^https:\/\//.test(p.linkUrl);
  const now = new Date();
  const hasBody = p.body.trim().length > 0;

  return (
    <>
      <SheetHead
        crumb={{ text: "โปรโมชัน", href: "/promotions" }}
        fact={lastDay ? `ถึง ${formatThaiDate(new Date(lastDay))}` : "ระยะเวลาจำกัด"}
        kicker={lastDay ? untilText(lastDay, now) : null}
        kickerSoon={!!lastDay && endsSoon(lastDay, now)}
        title={p.title}
        lede={p.excerpt || null}
        actions={
          p.linkUrl ? (
            external ? (
              <a href={p.linkUrl} className="btn btn-primary" target="_blank" rel="noopener">
                {p.linkLabel || "ดูรายละเอียด"}
              </a>
            ) : (
              <Link href={p.linkUrl} className="btn btn-primary">
                {p.linkLabel || "ดูรายละเอียด"}
              </Link>
            )
          ) : null
        }
        aside={
          p.coverUrl ? (
            <figure className="sh-img">
              {/* eslint-disable-next-line @next/next/no-img-element -- cover lives in MST's public Blob store */}
              <img src={p.coverUrl} alt="" width={1200} height={900} />
            </figure>
          ) : null
        }
      />
      <section className="pg-body">
        <div className="wrap">
          <div className="pg-doc">
            {hasBody && (
              <div className="md">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: () => null }}>
                  {p.body}
                </ReactMarkdown>
              </div>
            )}
            <p className="pg-foot">
              <span>สมาชิกได้แต้มทุกการซื้อ</span>
              <Link href="/rewards" className="text-link">
                สิทธิ์สมาชิก
              </Link>
              <Link href="/promotions" className="text-link">
                โปรโมชันอื่น
              </Link>
              <Link href="/contact" className="text-link">
                สอบถามร้าน
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
