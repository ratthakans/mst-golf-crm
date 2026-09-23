"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resizeToSquareJpeg } from "../../../lib/resize-image";
import { MemberAvatar } from "../MemberAvatar";

// Member 360 header photo: click to upload or replace, with a remove option.
export function PhotoUploader({
  memberId,
  name,
  version,
}: {
  memberId: string;
  name: string;
  version: string | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("photo", await resizeToSquareJpeg(file), "photo.jpg");
      const res = await fetch(`/api/members/${memberId}/photo`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "อัปโหลดไม่สำเร็จ");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    if (!confirm(`ลบรูปของ ${name}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/members/${memberId}/photo`, { method: "DELETE" });
      if (!res.ok) throw new Error("ลบรูปไม่สำเร็จ");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="photo-up">
      <button
        type="button"
        className="photo-up-btn"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={version ? "เปลี่ยนรูปโปรไฟล์" : "อัปโหลดรูปโปรไฟล์"}
      >
        <MemberAvatar id={memberId} name={name} version={version} size={64} />
        <span className="photo-up-overlay">{busy ? "…" : version ? "เปลี่ยน" : "+ รูป"}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      {version && !busy && (
        <button type="button" className="photo-up-remove" onClick={remove}>
          ลบรูป
        </button>
      )}
      {error && <div className="photo-up-error" role="alert">{error}</div>}
    </div>
  );
}
