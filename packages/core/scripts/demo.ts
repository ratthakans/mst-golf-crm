// Fills a NON-production schema with realistic demo data: members from every
// channel, a month of POS bills through the real import, bookings, an article.
//
//   pnpm --filter @mstgolf/core demo        (uses DATABASE_SCHEMA from .env.local)
//
// Refuses to run against the production schema.
import { prisma } from "@mstgolf/database";
import {
  addDays,
  commitImport,
  confirmHold,
  createMemberAtCounter,
  fromLocal,
  getOrgBySlug,
  holdSlot,
  listLanes,
  localParts,
  previewImport,
  savePost,
  signUp,
  staffCreateBooking,
  startOfLocalDay,
  type Actor,
} from "../src";

if (!process.env.DATABASE_SCHEMA || process.env.DATABASE_SCHEMA === "public") {
  console.error("Refusing to write demo data to the production schema. Set DATABASE_SCHEMA=dev.");
  process.exit(1);
}

const FIRST = ["สมชาย", "นภัส", "ธนา", "อรทัย", "กันต์", "ศิริพร", "ณัฐ", "ปิยะ", "วรรณา", "ชัยวัฒน์", "พิมพ์", "ภูมิ", "กมล", "สุดา", "อนุชา", "ธีรพงศ์", "ปวีณา", "เอก", "จิราพร", "ศักดิ์ชัย"];
const LAST = ["ศรีวงศ์", "รุ่งเรือง", "ทองดี", "แก้วมณี", "สุขสวัสดิ์", "พงษ์ไพบูลย์", "วงศ์ใหญ่", "จันทร์เพ็ญ"];
const ITEMS = [
  ["QI35-DR", "TaylorMade Qi35 Driver", "TaylorMade", "Driver", 21900],
  ["P790-IR", "TaylorMade P790 Irons 5-PW", "TaylorMade", "Irons", 52000],
  ["PROV1", "Titleist Pro V1 (โหล)", "Titleist", "Ball", 2100],
  ["GLV-FJ", "FootJoy StaSof Glove", "FootJoy", "Accessory", 890],
  ["SHOE-FJ", "FootJoy Premiere Series", "FootJoy", "Shoes", 7900],
  ["FIT-60", "Club Fitting 60 นาที", "MST", "Service", 2500],
  ["LESSON-1", "บทเรียนกอล์ฟ 1 ชม.", "MST", "Academy", 1800],
  ["POLO-TM", "TaylorMade Polo", "TaylorMade", "Apparel", 2400],
] as const;

async function main() {
  const org = await getOrgBySlug();
  const admin = await prisma.user.findFirst({ where: { orgId: org.id, role: "SUPER_ADMIN" } });
  if (!admin) throw new Error("Run db:seed with ADMIN_EMAIL/ADMIN_PASSWORD first");
  const actor: Actor = { kind: "staff", userId: admin.id, role: "SUPER_ADMIN" };
  const store = await prisma.store.findFirst({ where: { orgId: org.id } });
  if (!store) throw new Error("No store — run db:seed");
  const rand = (n: number) => Math.floor(Math.random() * n);

  const phones: string[] = [];
  for (let i = 0; i < 36; i++) {
    const phone = `08${String(10_000_000 + i * 7919 + rand(999)).slice(0, 8)}`;
    const fullName = `${FIRST[i % FIRST.length]} ${LAST[rand(LAST.length)]}`;
    try {
      if (i % 3 === 0) await createMemberAtCounter(org.id, actor, { fullName, phone, consentConfirmed: true, marketing: i % 2 === 0 });
      else await signUp(org.id, { lineUserId: `Udemo${i.toString(16).padStart(8, "0")}${rand(1e6)}`, channel: i % 5 === 0 ? "WEB" : "LINE", fullName, phone, birthday: i % 4 === 0 ? `19${70 + (i % 25)}-${String(1 + (i % 12)).padStart(2, "0")}-15` : null, acceptTerms: true, marketing: i % 2 === 1 });
      phones.push(phone);
    } catch (e) {
      console.warn("skip member", phone, (e as Error).message);
    }
  }

  // 30 days of bills: most with a member phone in the remark, some without.
  const rows = ["เลขที่บิล,วันที่,เวลา,ประเภท,บิลอ้างอิง,รหัสสินค้า,ชื่อสินค้า,ยี่ห้อ,หมวด,จำนวน,ราคาต่อหน่วย,ยอดสุทธิ,หมายเหตุ"];
  const today = startOfLocalDay(new Date());
  let n = 1;
  for (let d = 30; d >= 1; d--) {
    const day = addDays(today, -d);
    const p = localParts(day);
    const date = `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}/${p.year}`;
    for (let b = 0; b < 3 + rand(5); b++) {
      const inv = `D${p.year}${String(p.month).padStart(2, "0")}${String(p.day).padStart(2, "0")}-${String(n++).padStart(4, "0")}`;
      const remark = Math.random() < 0.8 ? `MSTMEMBER:${phones[rand(phones.length)]}` : "";
      const time = `${10 + rand(11)}:${String(rand(60)).padStart(2, "0")}`;
      for (let l = 0; l < 1 + rand(3); l++) {
        const it = ITEMS[Math.random() < 0.08 ? 1 : rand(ITEMS.length)]!;
        const qty = it[4] < 3000 ? 1 + rand(2) : 1;
        rows.push([inv, date, time, "ขาย", "", it[0], it[1], it[2], it[3], qty, it[4], it[4] * qty, l === 0 ? remark : ""].join(","));
      }
    }
  }
  const csv = rows.join("\n");
  const preview = await previewImport(org.id, actor, { storeId: store.id, fileName: `demo-${Date.now()}.csv`, bytes: new TextEncoder().encode(csv) });
  const counts = await commitImport(org.id, actor, preview.batchId);
  console.log("import", { bills: preview.counts.bills, pointsAwarded: counts.pointsAwarded, tierUps: counts.tierUps });

  // Bookings for today and the next days.
  const lanes = await listLanes(org.id);
  const members = await prisma.member.findMany({ where: { orgId: org.id, status: "ACTIVE", identities: { some: { type: "LINE" } } }, take: 12 });
  const now = new Date();
  let made = 0;
  for (let i = 0; i < members.length; i++) {
    const day = addDays(today, rand(4));
    const p = localParts(day);
    const start = fromLocal(p.year, p.month, p.day, 12 + rand(9));
    if (start <= now) continue;
    try {
      const h = await holdSlot(org.id, { memberId: members[i]!.id, laneId: lanes[rand(lanes.length)]!.id, startAt: start.toISOString(), partySize: 1 + rand(3), source: i % 3 ? "LINE" : "WEB" }, now);
      await confirmHold(org.id, members[i]!.id, h.id, now);
      made++;
    } catch {
      /* slot taken — fine */
    }
  }
  for (let i = 0; i < 4; i++) {
    const p = localParts(addDays(today, rand(3)));
    const start = fromLocal(p.year, p.month, p.day, 13 + rand(8));
    if (start <= now) continue;
    await staffCreateBooking(org.id, actor, { laneId: lanes[rand(lanes.length)]!.id, startAt: start.toISOString(), partySize: 2, source: i % 2 ? "PHONE" : "WALKIN", guestName: `ลูกค้า walk-in ${i + 1}`, guestPhone: null }, now).then(() => made++).catch(() => undefined);
  }
  console.log("bookings", made);

  await savePost(org.id, actor, null, {
    title: "วิธีเลือกไดรเวอร์ให้เหมาะกับวงสวิง",
    slug: "how-to-choose-a-driver",
    excerpt: "ความเร็วหัวไม้ มุมเปิดหน้าไม้ และก้าน — สามเรื่องที่ควรรู้ก่อนเลือกไดรเวอร์ตัวใหม่",
    body: "## เริ่มจากความเร็วหัวไม้\n\nถ้าความเร็วหัวไม้ต่ำกว่า 90 mph ลองดูไดรเวอร์ loft 10.5° ขึ้นไป\n\n## ก้านสำคัญพอ ๆ กับหัว\n\n- ก้านอ่อนเกินไป ลูกโด่งและเลี้ยว\n- ก้านแข็งเกินไป ลูกต่ำและสั้น\n\n> ที่ MST เรามีบริการ Club Fitting ช่วยหาไดรเวอร์ที่ใช่ในหนึ่งชั่วโมง",
    category: "ARTICLE",
    status: "PUBLISHED",
    coverUrl: "/mock/fitting.jpg", // sample covers are the website's mockup photos
  }).catch((e) => console.warn("post", (e as Error).message));
  await savePost(org.id, actor, null, {
    title: "จองซิมกอล์ฟออนไลน์ได้แล้ว",
    slug: "book-golf-simulator-online",
    excerpt: "เลือกวัน เวลา และ lane เองผ่าน LINE หรือเว็บไซต์ สมาชิก Silver และ Gold ได้ส่วนลดอัตโนมัติ",
    body: "## จองอย่างไร\n\n1. เปิดหน้า **จองซิม** แล้วล็อกอินด้วย LINE\n2. เลือกวัน เวลา และ lane ที่ว่าง\n3. ได้ข้อความยืนยันใน LINE และข้อความเตือนก่อนถึงเวลา\n\nชำระเงินที่ร้านตอนเช็กอิน",
    category: "SERVICE",
    status: "PUBLISHED",
    coverUrl: "/mock/sim-bays.jpg",
  }).catch((e) => console.warn("post", (e as Error).message));
  await savePost(org.id, actor, null, {
    title: "สมัครสมาชิก MST Golf ด้วย LINE",
    slug: "join-mst-golf-membership",
    excerpt: "บัตรสมาชิกในมือถือ สะสมแต้มทุกการซื้อ และระดับ Silver / Gold จากยอดซื้อ 12 เดือน",
    body: "สมัครได้ในไม่กี่ขั้นตอนผ่าน LINE แล้วแจ้งเบอร์โทรที่เคาน์เตอร์ทุกครั้งที่ซื้อสินค้าเพื่อสะสมแต้ม",
    category: "NEWS",
    status: "PUBLISHED",
    coverUrl: "/mock/store.jpg",
  }).catch((e) => console.warn("post", (e as Error).message));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
