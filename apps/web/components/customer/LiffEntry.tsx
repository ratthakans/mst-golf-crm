"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { initLiff } from "@/lib/client";

export function LiffEntry({ liffId }: { liffId: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const hasState = new URLSearchParams(window.location.search).has("liff.state");
    initLiff(liffId)
      .then(() => {
        // With liff.state the SDK navigates to the deep link itself.
        if (!hasState) router.replace("/app/member");
      })
      .catch(() => setFailed(true));
  }, [liffId, router]);

  return (
    <section className="panel login-panel" aria-live="polite">
      {failed ? (
        <>
          <h1>เปิดหน้าสมาชิกไม่สำเร็จ</h1>
          <p className="muted">ลองปิดแล้วเปิดใหม่จากเมนู LINE หรือเปิดหน้าสมาชิกในเบราว์เซอร์</p>
          <a href="/app/member" className="btn btn-primary btn-block">
            ไปหน้าสมาชิก
          </a>
        </>
      ) : (
        <p className="loading-line">
          <span className="spinner" aria-hidden="true" />
          <span>กำลังเปิด MST Golf…</span>
        </p>
      )}
    </section>
  );
}
