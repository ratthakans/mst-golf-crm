import { cache } from "react";
import { getOrgBySlug, lineConfig, listLanes, listStores, type OrgRecord } from "@mstgolf/core";

// Server-only data helpers shared by pages. `cache` de-duplicates within one
// render so the layout, the page and generateMetadata hit the database once.

export const getOrg = cache((): Promise<OrgRecord> => getOrgBySlug());

export const getStore = cache(async () => {
  const org = await getOrg();
  const stores = await listStores(org.id);
  return stores.find((s) => s.isActive) ?? stores[0] ?? null;
});

export const getLanes = cache(async () => listLanes((await getOrg()).id));

/** Public origin for canonical URLs, the sitemap and Open Graph. */
export async function siteOrigin(): Promise<string> {
  let fromSettings: string | undefined;
  try {
    fromSettings = (await getOrg()).settings.site.siteUrl;
  } catch {
    fromSettings = undefined;
  }
  const raw = fromSettings || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3200";
  return raw.replace(/\/$/, "");
}

export interface LoginSetup {
  /** LINE Login through LIFF is ready (LIFF id + LINE Login channel id are configured). */
  lineReady: boolean;
  liffId: string | null;
  /** Local-only fake login for development without a LINE channel. */
  devLogin: boolean;
}

export function devLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.LINE_DEV_LOGIN === "1";
}

/** What the customer pages need to know to sign someone in. Only the LIFF id ever reaches the browser. */
export async function loginSetup(orgId: string): Promise<LoginSetup> {
  const line = await lineConfig(orgId);
  const lineReady = !!(line?.liffId && line.loginChannelId);
  return { lineReady, liffId: lineReady ? line!.liffId : null, devLogin: !lineReady && devLoginEnabled() };
}
