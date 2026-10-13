// Website slots and placeholder copy (docs/PRODUCT.md §7.3). Pure — imported
// by the website (apps/web/lib/content.ts, lib/images.ts) and by the back-office
// editor (เว็บไซต์ › เนื้อหาหน้าเว็บ), so both show the same placeholders.
// MST's text lives in settings.site.copy and wins field by field; the
// placeholders describe the store plainly — no prices beyond the lane price in
// settings, no invented numbers or brand claims.

/** Photo slots on the website (apps/web/lib/images.ts). */
export const SITE_PHOTO_KEYS = ["hero", "proShop", "fitting", "simulator", "simBays", "store"] as const;
export type SitePhotoKey = (typeof SITE_PHOTO_KEYS)[number];

/** Where each photo shows, and the mockup it replaces (apps/web/public/mock). */
// `mock` is the default shown until MST uploads its own photo: MST Golf Group
// imagery from mstgolf.com where it isn't tied to a place, AI mockups for the
// Bangkok store and simulator room (only MST's own photos can show those).
export const SITE_PHOTO_LABEL: Record<SitePhotoKey, { label: string; where: string; mock: string }> = {
  hero: { label: "ภาพหลัก", where: "หน้าแรก ด้านบน", mock: "/photos/mst/coaching.jpg" },
  proShop: { label: "Pro shop", where: "บริการ · หน้าแรกและหน้าบริการ", mock: "/photos/mst/irons.jpg" },
  fitting: { label: "Club fitting", where: "บริการ · หน้าแรกและหน้าบริการ", mock: "/photos/mst/workshop.jpg" },
  simulator: { label: "Golf Simulator (บริการ)", where: "บริการ · หน้าแรกและหน้าบริการ", mock: "/mock/simulator.jpg" },
  simBays: { label: "ห้องซิม", where: "หน้า Golf Simulator", mock: "/mock/sim-bays.jpg" },
  store: { label: "หน้าร้าน", where: "หน้าแรก · แวะมาที่ร้าน", mock: "/photos/mst-th/charn-issara.jpg" },
};

/** Services on the website. */
// MST Golf Thailand runs no golf lessons (owner, 13 Oct 2026): three services.
export const SITE_SERVICE_SLUGS = ["pro-shop", "club-fitting", "golf-simulator"] as const;
export type SiteServiceSlug = (typeof SITE_SERVICE_SLUGS)[number];

export interface Service {
  slug: SiteServiceSlug;
  name: string;
  thai: string;
  short: string;
  body: string[];
  points: string[];
}

export const DEFAULT_SERVICES: Service[] = [
  {
    slug: "pro-shop",
    name: "Pro shop",
    thai: "ร้านอุปกรณ์กอล์ฟ",
    short: "ไม้กอล์ฟ ลูก ถุงมือ รองเท้า และเครื่องแต่งกาย จับของจริงได้ก่อนตัดสินใจ",
    body: [
      "หน้าร้านจัดวางไม้กอล์ฟตามประเภทและระดับผู้เล่น ตั้งแต่ชุดเริ่มต้นไปจนถึงไม้สำหรับนักกอล์ฟที่ซ้อมสม่ำเสมอ พร้อมอุปกรณ์และเครื่องแต่งกายสำหรับออกรอบ",
      "ไม่แน่ใจว่าไม้รุ่นไหนเหมาะ ลองตีบน Golf Simulator ในร้านก่อนได้ พนักงานช่วยเทียบให้เห็นความต่างจากตัวเลขจริงของวงสวิงคุณ",
    ],
    points: ["ไม้กอล์ฟครบชุดและแยกชิ้น", "ลูก ถุงมือ กระเป๋า และรองเท้า", "เครื่องแต่งกายสำหรับออกรอบ", "สะสมแต้มทุกการซื้อเมื่อแจ้งเบอร์สมาชิก"],
  },
  {
    slug: "club-fitting",
    name: "Club fitting",
    thai: "ฟิตติ้งไม้กอล์ฟ",
    short: "วัดวงสวิงแล้วเลือกก้าน หัวไม้ และสเปกที่เข้ากับคุณ แทนการเดา",
    body: [
      "ฟิตเตอร์ดูตัวเลขวงสวิงจากเครื่องวัดในห้องซิม เช่น ความเร็วหัวไม้ มุมยิง และอัตราการหมุนของลูก แล้วเทียบหัวไม้และก้านหลายแบบให้เห็นผลกันตรงหน้า",
      "ผลลัพธ์คือสเปกไม้ที่อธิบายได้ว่าทำไมถึงเหมาะกับคุณ จะสั่งทำชุดใหม่หรือปรับไม้เดิมก็ได้",
    ],
    points: ["วิเคราะห์วงสวิงบนเครื่องวัด", "เทียบหัวไม้และก้านหลายรุ่น", "สรุปสเปกที่แนะนำ", "นัดล่วงหน้าที่ร้านหรือทางโทรศัพท์"],
  },
  {
    slug: "golf-simulator",
    name: "Golf Simulator",
    thai: "ซิมกอล์ฟ",
    short: "ซ้อมหรือเล่นสนามจำลองได้ทุกวัน ไม่ต้องห่วงแดดหรือฝน จองออนไลน์ได้ทันที",
    body: [
      "ห้องซิมแยกเป็น lane ใช้ซ้อมไดรฟ์ ซ้อมเหล็ก หรือเล่นสนามจำลองกับเพื่อน จองเป็นรายชั่วโมงบนหน้าเว็บ และชำระเงินที่ร้านตอนเช็กอิน",
      "สมาชิก Silver และ Gold ได้ส่วนลดตามระดับ ระบบแสดงราคาหลังส่วนลดก่อนยืนยันทุกครั้ง",
    ],
    points: ["จองรายชั่วโมงบนเว็บไซต์", "ชำระเงินที่ร้านตอนเช็กอิน", "ส่วนลดตามระดับสมาชิก", "ยืนยันและเตือนก่อนเวลา"],
  },
];

export const DEFAULT_HOME_COPY = {
  heroTitle: "เลือกไม้จากวงสวิง",
  heroHighlight: "ของคุณเอง",
  heroLede: (lanes: number) => `อุปกรณ์กอล์ฟ ฟิตติ้งไม้ให้เข้ากับวงสวิง และ Golf Simulator ${lanes} lane — อยู่ในร้านเดียว ใจกลางถนนพระราม 4`,
  servicesTitle: "ทุกอย่างอยู่ในร้านเดียว",
  servicesLede: "สามบริการที่ต่อกันเป็นเส้นเดียว เลือกของในร้าน ฟิตติ้งไม้ให้เข้ากับวงสวิง แล้วซ้อมต่อบนซิมได้ในที่เดียว",
  // Placeholder from the MST Golf group's line-up — MST Thailand confirms what this store carries.
  // The brands on mstgolf.co.th ("The biggest brands in golf, all in one store"), Oct 2026.
  brands: ["Titleist", "TaylorMade", "Callaway", "PING", "Mizuno", "Srixon", "XXIO", "ONOFF", "Majesty", "Fourteen", "Bettinardi", "FootJoy", "ECCO", "adidas", "Under Armour", "PUMA", "Sun Day Red", "Fore All", "WAAC", "Malbon", "Cutter & Buck", "Disney"].join("\n"),
};

/** Brands MST Golf Thailand carries exclusively (mstgolf.co.th, Oct 2026). */
export const EXCLUSIVE_BRANDS: Array<{ name: string; line: string; image: string; position?: string }> = [
  { name: "Sun Day Red", line: "แบรนด์ของ Tiger Woods เสื้อผ้ากอล์ฟสายเพอร์ฟอร์มานซ์", image: "/photos/mst-th/sun-day-red.jpg", position: "25% 30%" },
  { name: "Fore All", line: "เสื้อผ้ากอล์ฟผู้หญิง ออกแบบมาเพื่อนักกอล์ฟหญิงทุกคน", image: "/photos/mst-th/fore-all.jpg", position: "50% 30%" },
  { name: "WAAC", line: "แบรนด์เสื้อผ้ากอล์ฟที่มาแรงที่สุดจากเกาหลี", image: "/photos/mst-th/waac.jpg" },
  { name: "ONOFF", line: "ไม้กอล์ฟจากญี่ปุ่น สมดุลระหว่างประสิทธิภาพกับเทคโนโลยีพรีเมียม", image: "/photos/mst-th/onoff.jpg" },
];
