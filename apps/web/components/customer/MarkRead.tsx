"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/client";

// Opening the inbox marks everything read; the bell's count clears on refresh.
export function MarkRead() {
  const router = useRouter();
  useEffect(() => {
    void api("/api/me/notifications/read", { method: "POST" }).then((r) => r.ok && router.refresh());
  }, [router]);
  return null;
}
