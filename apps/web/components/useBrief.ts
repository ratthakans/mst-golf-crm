"use client";

import { useEffect, useState } from "react";

// The signed-in summary for the public pages (header chip, "แต้มของฉัน").
// Fetched once per page load and shared by every component that asks.

export type Brief =
  | { signedIn: false }
  | { signedIn: true; name: string; member: null }
  | {
      signedIn: true;
      name: string;
      member: { points: number; tierKey: string; tierName: string; nextBooking: { startAt: string; laneName: string } | null };
    };

let pending: Promise<Brief | null> | null = null;

function loadBrief(): Promise<Brief | null> {
  pending ??= fetch("/api/me/brief", { credentials: "same-origin", cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Brief>) : null))
    .catch(() => null);
  return pending;
}

/** undefined while loading, null when it could not be loaded. */
export function useBrief(): Brief | null | undefined {
  const [brief, setBrief] = useState<Brief | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void loadBrief().then((b) => {
      if (live) setBrief(b);
    });
    return () => {
      live = false;
    };
  }, []);
  return brief;
}
