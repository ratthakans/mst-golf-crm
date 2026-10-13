import type { Metadata } from "next";
import { SheetHead } from "@/components/SheetHead";
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
      <SheetHead
        label="Journal"
        title="บทความและข่าวจากร้าน"
        lede="เทคนิคการซ้อม เรื่องไม้กอล์ฟ บริการในร้าน และข่าวสารจาก MST Golf"
      />
      <section className="pg-body">
        <div className="wrap">
          <BlogIndex posts={posts} />
        </div>
      </section>
    </>
  );
}
