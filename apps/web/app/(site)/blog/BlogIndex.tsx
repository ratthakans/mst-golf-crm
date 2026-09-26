"use client";

import { useEffect, useState } from "react";
import { PostList, type PostItem } from "@/components/PostList";
import { CATEGORY_LABEL } from "@/lib/format";

type Cat = "ALL" | PostItem["category"];
const CATS: Cat[] = ["ALL", "ARTICLE", "SERVICE", "NEWS"];
const PARAM: Record<string, Cat> = { article: "ARTICLE", service: "SERVICE", news: "NEWS" };

// Filtering happens in the browser so /blog stays a cached static page;
// ?category=article|service|news still deep-links to a filter.
export function BlogIndex({ posts }: { posts: PostItem[] }) {
  const [cat, setCat] = useState<Cat>("ALL");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("category");
    if (q && PARAM[q]) setCat(PARAM[q]);
  }, []);

  const choose = (c: Cat) => {
    setCat(c);
    const url = new URL(window.location.href);
    if (c === "ALL") url.searchParams.delete("category");
    else url.searchParams.set("category", c.toLowerCase());
    window.history.replaceState(null, "", url);
  };

  const shown = cat === "ALL" ? posts : posts.filter((p) => p.category === cat);

  return (
    <>
      <div className="chips" role="group" aria-label="กรองตามหมวด">
        {CATS.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => choose(c)}>
            {c === "ALL" ? "ทั้งหมด" : CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      {shown.length ? (
        <PostList posts={shown} />
      ) : (
        <p className="empty">{posts.length ? "ยังไม่มีบทความในหมวดนี้" : "บทความชุดแรกกำลังจะมา — ติดตามเทคนิคการซ้อมและข่าวจากร้านได้ที่นี่"}</p>
      )}
    </>
  );
}
