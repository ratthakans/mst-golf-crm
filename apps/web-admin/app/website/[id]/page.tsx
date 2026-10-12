import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, promoDateKey } from "@mstgolf/core";
import { allowPage } from "../../../lib/auth";
import { currentOrg } from "../../../lib/org";
import { webOrigin } from "../../../lib/web-origin";
import { Forbidden } from "../../Forbidden";
import { PostEditor } from "./PostEditor";

export const dynamic = "force-dynamic";

export default async function PostPage({ params, searchParams }: { params: { id: string }; searchParams: { type?: string } }) {
  const user = await allowPage("posts.manage");
  if (!user) return <Forbidden />;
  const org = await currentOrg();
  const post = params.id === "new" ? null : await getPost(org.id, { id: params.id });
  if (params.id !== "new" && !post) notFound();
  const promo = post ? post.category === "PROMOTION" : searchParams.type === "promotion";
  return (
    <>
      <div className="page-head">
        <Link href={promo ? "/website/promotions" : "/website"} className="back-link">{promo ? "← โปรโมชัน" : "← บทความเว็บไซต์"}</Link>
        <h1 style={{ marginTop: 6 }}>{promo ? (post ? "แก้ไขโปรโมชัน" : "เพิ่มโปรโมชัน") : post ? "แก้ไขบทความ" : "เขียนบทความ"}</h1>
      </div>
      <PostEditor
        post={post ? { ...post, publishedAt: post.publishedAt?.toISOString() ?? null, updatedAt: post.updatedAt.toISOString(), startsAt: promoDateKey(post.startsAt), endsAt: promoDateKey(post.endsAt, true) } : null}
        defaultCategory={promo ? "PROMOTION" : "ARTICLE"}
        siteUrl={webOrigin(org.settings.site.siteUrl)}
        uploadsEnabled={!!process.env.PUBLIC_BLOB_READ_WRITE_TOKEN}
      />
    </>
  );
}
