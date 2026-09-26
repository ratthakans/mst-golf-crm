// Site photography, in one place. Every file under /public/mock is an
// AI-generated MOCKUP (Higgsfield · gpt_image_2_5, 26 Sep 2026) standing in
// until MST sends real photos — replace the file (same name) or the path here.
// Never ship the mockups as MST's real store once real photos exist.

export interface SitePhoto {
  src: string;
  alt: string;
  width: number;
  height: number;
}

const photo = (src: string, alt: string, width = 1600, height = 1205): SitePhoto => ({ src, alt, width, height });

export const PHOTOS = {
  hero: photo("/mock/hero.jpg", "นักกอล์ฟตีไดรฟ์ในห้อง Golf Simulator ของร้าน"),
  proShop: photo("/mock/proshop.jpg", "ผนังจัดแสดงไม้กอล์ฟ ลูก และถุงมือในร้าน"),
  fitting: photo("/mock/fitting.jpg", "ฟิตเตอร์วัดวงสวิงด้วยเครื่องวัดระหว่างฟิตติ้งไม้กอล์ฟ"),
  academy: photo("/mock/academy.jpg", "โปรช่วยปรับการจับไม้ให้นักเรียนในคลาสกอล์ฟ"),
  simulator: photo("/mock/simulator.jpg", "เพื่อนสามคนเล่น Golf Simulator ด้วยกันในห้องซิม"),
  simBays: photo("/mock/sim-bays.jpg", "ห้อง Golf Simulator สามช่องเรียงกัน", 1600, 895),
  store: photo("/mock/store.jpg", "หน้าร้าน MST Golf ยามเย็น", 1600, 895),
} as const;

/** Photo for each service in lib/content.ts, by slug. */
export const SERVICE_PHOTO: Record<string, SitePhoto> = {
  "pro-shop": PHOTOS.proShop,
  "club-fitting": PHOTOS.fitting,
  academy: PHOTOS.academy,
  "golf-simulator": PHOTOS.simulator,
};
