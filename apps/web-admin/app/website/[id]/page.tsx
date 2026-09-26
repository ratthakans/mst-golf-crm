import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost } from "@mstgolf/core";
import { allowPage } from "../../../lib/auth";
import { currentOrg } from "../../../lib/org";
import { Forbidden } from "../../Forbidden";
import { PostEditor } from "./PostEditor";

export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: { id: string } }) {
  const user = await allowPage("posts.manage");
  if (!user) return <Forbidden />;
  const org = await currentOrg();
  const post = params.id === "new" ? null : await getPost(org.id, { id: params.id });
  if (params.id !== "new" && !post) notFound();
  return (
    <>
      <div className="page-head">
        <Link href="/website" className="back-link">← บทความเว็บไซต์</Link>
        <h1 style={{ marginTop: 6 }}>{post ? "แก้ไขบทความ" : "เขียนบทความ"}</h1>
      </div>
      <PostEditor
        post={post ? { ...post, publishedAt: post.publishedAt?.toISOString() ?? null, updatedAt: post.updatedAt.toISOString() } : null}
        siteUrl={org.settings.site.siteUrl ?? null}
        uploadsEnabled={!!process.env.PUBLIC_BLOB_READ_WRITE_TOKEN}
      />
    </>
  );
}
