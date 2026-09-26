"use client";

import { useState } from "react";
import { api, initLiff } from "@/lib/client";

// Web only (inside LINE the LIFF session belongs to the LINE app).
export function LogoutButton({ liffId }: { liffId: string | null }) {
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    setBusy(true);
    await api("/api/me/session", { method: "DELETE" });
    if (liffId) {
      try {
        const liff = await initLiff(liffId);
        if (!liff.isInClient() && liff.isLoggedIn()) liff.logout();
      } catch {
        // The site cookie is already gone; LIFF's own token just expires.
      }
    }
    window.location.href = "/";
  };

  return (
    <button type="button" className="btn btn-quiet btn-sm" onClick={() => void logout()} disabled={busy}>
      {busy && <span className="spinner" aria-hidden="true" />}
      <span>ออกจากระบบ</span>
    </button>
  );
}
