"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorText } from "../ui/api";

/** Saves one settings section (PUT /api/settings/<section>) and refreshes the page. */
export function useSave(section: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const save = async (body: unknown): Promise<boolean> => {
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      await api(`/api/settings/${section}`, { method: "PUT", body });
      setOk(true);
      router.refresh();
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, ok, save };
}

export function SaveBar({ busy, error, ok, label = "บันทึก" }: { busy: boolean; error: string | null; ok: boolean; label?: string }) {
  return (
    <>
      {error && <p className="form-error">{error}</p>}
      {ok && <div className="form-ok">บันทึกแล้ว</div>}
      <div className="btn-row">
        <button className="btn" type="submit" disabled={busy}>{busy ? "กำลังบันทึก…" : label}</button>
      </div>
    </>
  );
}
