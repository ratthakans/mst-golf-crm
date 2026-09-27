"use client";

import DOMPurify from "dompurify";
import { marked } from "marked";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, errorText } from "../../ui/api";
import { CATEGORY_LABEL, formatDateTime } from "../../ui/format";

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  body: string;
  category: "ARTICLE" | "SERVICE" | "NEWS";
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  updatedAt: string;
}

export function PostEditor({ post, siteUrl, uploadsEnabled }: { post: Post | null; siteUrl: string | null; uploadsEnabled: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    coverUrl: post?.coverUrl ?? "",
    body: post?.body ?? "",
    category: post?.category ?? "ARTICLE",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // DOMPurify needs a DOM, so the preview renders after mount (no hydration mismatch).
  const [html, setHtml] = useState("");
  useEffect(() => {
    setHtml(DOMPurify.sanitize(marked.parse(f.body || "_เนื้อหาจะแสดงที่นี่_", { async: false }) as string));
  }, [f.body]);

  async function save(status: "DRAFT" | "PUBLISHED") {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const body = { ...f, coverUrl: f.coverUrl || null, status };
      const r = post
        ? await api<{ post: Post }>(`/api/posts/${post.id}`, { method: "PATCH", body })
        : await api<{ post: Post }>("/api/posts", { body });
      setSaved(status === "PUBLISHED" ? "เผยแพร่แล้ว — ขึ้นเว็บภายใน 5 นาที" : "บันทึกฉบับร่างแล้ว");
      if (!post) router.replace(`/website/${r.post.id}`);
      else router.refresh();
      setF((x) => ({ ...x, slug: r.post.slug }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await api<{ url: string }>("/api/posts/upload", { form: fd });
      setF((x) => ({ ...x, coverUrl: r.url }));
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function remove() {
    if (!post || !window.confirm(`ลบบทความ “${post.title}”? ลบแล้วกู้คืนไม่ได้`)) return;
    try {
      await api(`/api/posts/${post.id}`, { method: "DELETE" });
      router.push("/website");
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="form-grid">
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span>ชื่อบทความ <b>*</b></span>
            <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={160} />
          </label>
          <label className="field">
            <span>หมวด</span>
            <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Post["category"] })}>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>ลิงก์ (slug) <span className="hint">— a-z 0-9 และขีด เว้นว่างให้ระบบตั้งให้</span></span>
            <input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} placeholder="how-to-choose-a-driver" />
          </label>
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span>คำโปรย <span className="hint">— แสดงในหน้ารวมบทความและตอนแชร์</span></span>
            <textarea value={f.excerpt} onChange={(e) => setF({ ...f, excerpt: e.target.value })} maxLength={300} style={{ minHeight: 64 }} />
          </label>
        </div>
        <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
          <div style={{ width: 240, maxWidth: "100%" }}>
            {f.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.coverUrl.startsWith("/") && siteUrl ? `${siteUrl}${f.coverUrl}` : f.coverUrl} alt="" className="cover-preview" />
            ) : (
              <div className="cover-preview" style={{ display: "grid", placeItems: "center", color: "var(--muted)", fontSize: 13 }}>ไม่มีรูปปก</div>
            )}
          </div>
          <div className="stack" style={{ gap: 8, flex: 1, minWidth: 220 }}>
            <label className="field" style={{ margin: 0 }}>
              <span>รูปปก <span className="hint">— อัตราส่วน 16:9</span></span>
              <input value={f.coverUrl} onChange={(e) => setF({ ...f, coverUrl: e.target.value })} placeholder="https://… หรืออัปโหลด" />
            </label>
            <div className="row">
              {uploadsEnabled && <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>อัปโหลดรูป</button>}
              {f.coverUrl && <button type="button" className="link-btn" onClick={() => setF({ ...f, coverUrl: "" })}>เอารูปออก</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
          </div>
        </div>
      </div>

      <div className="editor">
        <div className="card">
          <label className="field" style={{ margin: 0 }}>
            <span>เนื้อหา (Markdown) <span className="hint">— # หัวข้อ, **ตัวหนา**, - รายการ, [ลิงก์](https://…), ![รูป](https://…)</span></span>
            <textarea className="body" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          </label>
        </div>
        <div className="card">
          <div className="muted small" style={{ marginBottom: 8 }}>ตัวอย่างบนเว็บ</div>
          <h2 style={{ marginTop: 0 }}>{f.title || "ชื่อบทความ"}</h2>
          <div className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {saved && <div className="form-ok">{saved}</div>}
      <div className="card row between">
        <span className="muted small">
          {post ? (post.status === "PUBLISHED" ? `เผยแพร่แล้ว ${formatDateTime(post.publishedAt)}` : "ฉบับร่าง — ยังไม่ขึ้นเว็บ") : "ยังไม่ได้บันทึก"}
          {post?.status === "PUBLISHED" && siteUrl && (
            <>
              {" "}· <a href={`${siteUrl}/blog/${f.slug}`} target="_blank" rel="noreferrer">ดูบนเว็บ ↗</a>
            </>
          )}
        </span>
        <div className="row">
          {post && <button className="btn btn-ghost danger-text" onClick={remove} disabled={busy}>ลบ</button>}
          <button className="btn btn-ghost" disabled={busy || !f.title.trim()} onClick={() => save("DRAFT")}>
            {post?.status === "PUBLISHED" ? "ถอนกลับเป็นร่าง" : "บันทึกร่าง"}
          </button>
          <button className="btn" disabled={busy || !f.title.trim()} onClick={() => save("PUBLISHED")}>
            {post?.status === "PUBLISHED" ? "บันทึกและเผยแพร่" : "เผยแพร่"}
          </button>
        </div>
      </div>
    </div>
  );
}
