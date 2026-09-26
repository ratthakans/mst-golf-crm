"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorText } from "../ui/api";

export function ResolveButtons({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = async (status: "DONE" | "DISMISSED") => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/reviews/${id}`, { method: "PATCH", body: { status, note } });
      router.refresh();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row">
        <input className="link-input" placeholder="บันทึกสั้น ๆ ว่าทำอะไรไป (ไม่บังคับ)" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn btn-sm" disabled={busy} onClick={() => close("DONE")}>ดำเนินการแล้ว</button>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => close("DISMISSED")}>ไม่ต้องทำ</button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
