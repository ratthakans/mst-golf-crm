import type { SitePhotoKey, SiteSettings } from "@mstgolf/shared";
import { SITE_PHOTO_LABEL as M } from "@mstgolf/shared/site";

// Site photography, in one place. Every file under /public/mock is an
// AI-generated MOCKUP (Higgsfield · gpt_image_2_5, 26 Sep 2026) standing in
// until MST uploads real photos in the back office (เว็บไซต์ › เนื้อหาหน้าเว็บ),
// which are stored in settings.site.photos and win over the mockups here.

export interface SitePhoto {
  src: string;
  alt: string;
  width: number;
  height: number;
  mock?: boolean; // still the AI mockup
}

const photo = (src: string, alt: string, width = 1600, height = 1205): SitePhoto => ({ src, alt, width, height, mock: true });

export const PHOTOS = {
  hero: photo(M.hero.mock, "นักกอล์ฟตีไดรฟ์ในห้อง Golf Simulator ของร้าน"),
  proShop: photo(M.proShop.mock, "ผนังจัดแสดงไม้กอล์ฟ ลูก และถุงมือในร้าน"),
  fitting: photo(M.fitting.mock, "ฟิตเตอร์วัดวงสวิงด้วยเครื่องวัดระหว่างฟิตติ้งไม้กอล์ฟ"),
  academy: photo(M.academy.mock, "โปรช่วยปรับการจับไม้ให้นักเรียนในคลาสกอล์ฟ"),
  simulator: photo(M.simulator.mock, "เพื่อนสามคนเล่น Golf Simulator ด้วยกันในห้องซิม"),
  simBays: photo(M.simBays.mock, "ห้อง Golf Simulator สามช่องเรียงกัน", 1600, 895),
  store: photo(M.store.mock, "หน้าร้าน MST Golf ยามเย็น", 1600, 895),
} as const;

export type Photos = Record<SitePhotoKey, SitePhoto>;

/** The site's photos with MST's uploads in place of the mockups. */
export function sitePhotos(site: SiteSettings | undefined): Photos {
  const out = { ...PHOTOS } as Photos;
  for (const [key, src] of Object.entries(site?.photos ?? {}) as Array<[SitePhotoKey, string | undefined]>) {
    if (src && out[key]) out[key] = { ...out[key], src, mock: false };
  }
  return out;
}

/** Photo for each service in lib/content.ts, by slug. */
export function servicePhotos(p: Photos): Record<string, SitePhoto> {
  return { "pro-shop": p.proShop, "club-fitting": p.fitting, academy: p.academy, "golf-simulator": p.simulator };
}
