import Link from "next/link";

export function WebsiteTabs({ on }: { on: "posts" | "promotions" | "content" }) {
  return (
    <div className="tabs">
      <Link href="/website/promotions" className={`tab${on === "promotions" ? " on" : ""}`}>โปรโมชัน</Link>
      <Link href="/website" className={`tab${on === "posts" ? " on" : ""}`}>บทความ</Link>
      <Link href="/website/content" className={`tab${on === "content" ? " on" : ""}`}>เนื้อหาหน้าเว็บ</Link>
    </div>
  );
}
