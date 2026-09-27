"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorText } from "../../ui/api";

export function ConfirmButton({ itemKey, confirmed }: { itemKey: string; confirmed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/readiness", { method: "POST", body: { key: itemKey, confirmed: !confirmed } });
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" className={confirmed ? "link-btn" : "btn btn-sm"} disabled={busy} onClick={toggle}>
        {busy ? "…" : confirmed ? "ยกเลิกการยืนยัน" : "ยืนยันว่าถูกต้อง"}
      </button>
      {error && <span className="danger-text small">{error}</span>}
    </>
  );
}
