// Website slots and placeholder copy (docs/PRODUCT.md §7.3). Pure — imported
// by the website (apps/web/lib/content.ts, lib/images.ts) and by the back-office
// editor (เว็บไซต์ › เนื้อหาหน้าเว็บ), so both show the same placeholders.
// MST's text lives in settings.site.copy and wins field by field; the
// placeholders describe the store plainly — no prices beyond the lane price in
// settings, no invented numbers or brand claims.

/** Photo slots on the website (apps/web/lib/images.ts). */
export const SITE_PHOTO_KEYS = ["hero", "proShop", "fitting", "academy", "simulator", "simBays", "store"] as const;
export type SitePhotoKey = (typeof SITE_PHOTO_KEYS)[number];

/** Where each photo shows, and the mockup it replaces (apps/web/public/mock). */
export const SITE_PHOTO_LABEL: Record<SitePhotoKey, { label: string; where: string; mock: string }> = {
  hero: { label: "ภาพหลัก", where: "หน้าบริการ ด้านบน", mock: "/mock/hero.jpg" },
  proShop: { label: "Pro shop", where: "บริการ · หน้าแรกและหน้าบริการ", mock: "/mock/proshop.jpg" },
  fitting: { label: "Club fitting", where: "บริการ · หน้าแรกและหน้าบริการ", mock: "/mock/fitting.jpg" },
  academy: { label: "Academy", where: "บริการ · หน้าแรกและหน้าบริการ", mock: "/mock/academy.jpg" },
  simulator: { label: "Golf Simulator (บริการ)", where: "บริการ · หน้าแรกและหน้าบริการ", mock: "/mock/simulator.jpg" },
  simBays: { label: "ห้องซิม", where: "หน้า Golf Simulator", mock: "/mock/sim-bays.jpg" },
  store: { label: "หน้าร้าน", where: "หน้าแรก · แวะมาที่ร้าน", mock: "/mock/store.jpg" },
};

/** Services on the website. */
export const SITE_SERVICE_SLUGS = ["pro-shop", "club-fitting", "academy", "golf-simulator"] as const;
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
    points: ["วิเคราะห์วงสวิงบนเครื่องวัด", "เทียบหัวไม้และก้านหลายรุ่น", "สรุปสเปกที่แนะนำ", "นัดล่วงหน้าผ่าน LINE OA"],
  },
  {
    slug: "academy",
    name: "Academy",
    thai: "คลาสเรียนกอล์ฟ",
    short: "เรียนกับโปรทั้งพื้นฐานและปรับวงสวิง ในห้องที่เห็นตัวเลขทุกช็อต",
    body: [
      "คลาสสำหรับผู้เริ่มต้นที่อยากจับไม้ให้ถูกตั้งแต่แรก และคลาสสำหรับคนที่ออกรอบแล้วแต่อยากแก้จุดที่ค้างอยู่ เช่น ลูกเฟด ลูกสไลซ์ หรือระยะที่ไม่คงที่",
      "การสอนในห้องซิมทำให้เห็นผลของการปรับแต่ละครั้งทันที ไม่ต้องรอออกรอบถึงจะรู้",
    ],
    points: ["คลาสพื้นฐานสำหรับผู้เริ่มต้น", "คลาสปรับวงสวิงรายบุคคล", "ฝึกในห้องซิมพร้อมตัวเลขทุกช็อต", "สอบถามตารางคลาสทาง LINE OA"],
  },
  {
    slug: "golf-simulator",
    name: "Golf Simulator",
    thai: "ซิมกอล์ฟ",
    short: "ซ้อมหรือเล่นสนามจำลองได้ทุกวัน ไม่ต้องห่วงแดดหรือฝน จองออนไลน์ได้ทันที",
    body: [
      "ห้องซิมแยกเป็น lane ใช้ซ้อมไดรฟ์ ซ้อมเหล็ก หรือเล่นสนามจำลองกับเพื่อน จองเป็นรายชั่วโมงผ่าน LINE หรือหน้าเว็บ และชำระเงินที่ร้านตอนเช็กอิน",
      "สมาชิก Silver และ Gold ได้ส่วนลดตามระดับ ระบบแสดงราคาหลังส่วนลดก่อนยืนยันทุกครั้ง",
    ],
    points: ["จองรายชั่วโมงผ่าน LINE หรือเว็บไซต์", "ชำระเงินที่ร้านตอนเช็กอิน", "ส่วนลดตามระดับสมาชิก", "ข้อความยืนยันและเตือนก่อนเวลาใน LINE"],
  },
];

export const DEFAULT_HOME_COPY = {
  heroTitle: "ร้านกอล์ฟที่ให้คุณ",
  heroHighlight: "ลองก่อนเลือก",
  heroLede: (lanes: number) => `อุปกรณ์กอล์ฟ ฟิตติ้งไม้ให้เข้ากับวงสวิง คลาสกับโปร และ Golf Simulator ${lanes} lane — อยู่ในร้านเดียว ใจกลางถนนพระราม 4`,
  servicesTitle: "ครบตั้งแต่เลือกไม้ จนถึงวันออกรอบ",
  servicesLede: "สี่บริการที่ต่อกันเป็นเส้นเดียว ลองไม้บนซิม ฟิตติ้งให้เข้ากับวงสวิง แล้วซ้อมต่อกับโปรได้ในที่เดียว",
};
