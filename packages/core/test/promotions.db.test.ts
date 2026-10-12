import { beforeAll, describe, expect, it } from "vitest";
import { activePromotions, listPosts, savePost } from "../src";
import { fromLocal } from "../src/time";
import { makeOrg } from "./fixtures";

let t: Awaited<ReturnType<typeof makeOrg>>;
beforeAll(async () => {
  t = await makeOrg("promos");
});

describe("promotions", () => {
  it("shows a promotion only inside its Bangkok date window, and keeps it out of the blog", async () => {
    await savePost(t.orgId, t.actor, null, { title: "Oct sale", slug: "oct-sale", category: "PROMOTION", status: "PUBLISHED", startsAt: "2027-01-10", endsAt: "2027-01-20", linkUrl: "https://mstgolf.co.th/sale" });
    await savePost(t.orgId, t.actor, null, { title: "Article", slug: "an-article", category: "ARTICLE", status: "PUBLISHED", startsAt: "2026-01-01" });
    const at = (d: number, h: number) => fromLocal(2027, 1, d, h, 0); // after the post was published (today)
    expect(await activePromotions(t.orgId, at(9, 23))).toHaveLength(0);
    expect(await activePromotions(t.orgId, at(10, 0))).toHaveLength(1);
    expect(await activePromotions(t.orgId, at(20, 23))).toHaveLength(1); // the last day counts in full
    expect(await activePromotions(t.orgId, at(21, 0))).toHaveLength(0);
    const blog = await listPosts(t.orgId, { publishedOnly: true, excludeCategory: "PROMOTION" });
    expect(blog.map((p) => p.slug)).toEqual(["an-article"]);
    expect(blog[0]!.startsAt).toBeNull(); // dates only apply to promotions
  });

  it("refuses a bad link or an end before the start", async () => {
    await expect(savePost(t.orgId, t.actor, null, { title: "Bad", category: "PROMOTION", linkUrl: "javascript:alert(1)" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(savePost(t.orgId, t.actor, null, { title: "Bad dates", category: "PROMOTION", startsAt: "2026-10-20", endsAt: "2026-10-19" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
