import type { Metadata } from "next";
import { publishedPosts } from "@/lib/posts";
import { BlogIndex } from "./BlogIndex";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "บทความ — เทคนิค บริการ และข่าวสารจาก MST Golf",
  description: "บทความเทคนิคการซ้อม ความรู้เรื่องไม้กอล์ฟและการฟิตติ้ง บริการของร้าน และข่าวสารจาก MST Golf",
  alternates: { canonical: "/blog" },
  openGraph: { title: "บทความ | MST Golf", url: "/blog" },
};

export default async function BlogPage() {
  const posts = await publishedPosts(100);
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <h1>บทความ</h1>
          <p className="lede">เทคนิคการซ้อม เรื่องไม้กอล์ฟ บริการในร้าน และข่าวสารจาก MST Golf</p>
        </div>
      </section>
      <section className="section section-tight">
        <div className="wrap">
          <BlogIndex posts={posts} />
        </div>
      </section>
    </>
  );
}
