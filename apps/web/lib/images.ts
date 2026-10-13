import type { SitePhotoKey, SiteSettings } from "@mstgolf/shared";
import { SITE_PHOTO_LABEL as M } from "@mstgolf/shared/site";

// Site photography, in one place. Photos MST uploads in the back office
// (เว็บไซต์ › เนื้อหาหน้าเว็บ, settings.site.photos) always win. Until then:
// - /public/photos/mst: MST Golf Group's own imagery from mstgolf.com, used only
//   where the picture isn't tied to a place (coaching, workshop, clubs, a swing);
// - /public/mock: AI-generated MOCKUPS (Higgsfield · gpt_image_2_5, 26 Sep 2026)
//   for the Bangkok store and simulator room, which only MST's photos can show.

export interface SitePhoto {
  src: string;
  alt: string;
  width: number;
  height: number;
  mock?: boolean; // still the AI mockup
}

const photo = (src: string, alt: string, width = 1600, height = 1205): SitePhoto => ({ src, alt, width, height, mock: src.startsWith("/mock/") });

export const PHOTOS = {
  hero: photo(M.hero.mock, "โค้ชดูวงสวิงของนักกอล์ฟในห้องซิม", 2000, 2000),
  proShop: photo(M.proShop.mock, "ไม้กอล์ฟชุดเหล็ก Mizuno ในถุงกอล์ฟ", 1400, 1750),
  fitting: photo(M.fitting.mock, "ช่างประกอบไม้กอล์ฟในเวิร์กช็อปฟิตติ้ง", 1600, 1600),
  academy: photo(M.academy.mock, "นักกอล์ฟตีลูกบนสนาม", 1122, 838),
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
