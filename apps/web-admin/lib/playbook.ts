import type { EvBar, EvPoint } from "../app/evidence";
import { getCrmData } from "./data";
import { getTask, type TaskStatus } from "./tasks";
import type { MemberProfile } from "@mstgolf/analytics";
import { resolveTiers } from "@mstgolf/shared/tiers";

// Computes the Playbook entirely from the live synthetic dataset — so every
// count, audience, and named customer matches Overview/Analytics exactly.
// Creative templates (evidence, interpretation, copy) are constant; counts and
// the real customers filling each play come from the engine.

export type Evidence =
  | { kind: "bars"; data: EvBar[]; unit?: string; caption: string }
  | { kind: "curve"; data: EvPoint[]; unit?: string; markerIndex?: number; markerLabel?: string; caption: string };

export interface BulkPlay {
  id: string; category: string; color: string; segment: string; count: number; sample: string;
  trigger: string; evidence: Evidence; interpretation: string;
  playName: string; action: string; message: string; offer: string; channel: string; timing: string;
  perCustomer: number; x: number; y: number;
}

export type Priority = "Urgent" | "High-value" | "Timely" | "Growth";

export interface PersonalPlay {
  id: string; memberId: string; name: string; tier: string; priority: Priority; color: string;
  signal: string; clv: number; churn: number; lastSeen: string; spend: number;
  playName: string; action: string; message: string; offer: string; assignedTo: string; value: number;
  status: TaskStatus; recovered: number;
}

export interface PlaybookData {
  totalMembers: number;
  uniqueReach: number;
  bulk: BulkPlay[];
  personal: PersonalPlay[];
}

const PRIORITY_COLOR: Record<Priority, string> = { Urgent: "#ef4444", "High-value": "#16a34a", Timely: "#7c3aed", Growth: "#0ea5e9" };

interface Ctx {
  profiles: MemberProfile[];
  visitCount: Map<string, number>;
  fittedNoClubs: Set<string>;
  recentClubsNoBalls: Set<string>;
  newMembers: Set<string>;
  currentMonth: number;
}

function brandOf(p: MemberProfile): string[] {
  const b = p.attributes?.preferredBrands;
  return Array.isArray(b) ? (b as string[]) : [];
}

export async function getPlaybookData(): Promise<PlaybookData> {
  const { members, events, profiles, rfm, clv, churn, org } = await getCrmData();
  const now = new Date();
  const DAY = 24 * 60 * 60 * 1000;

  const rfmById = new Map(rfm.map((r) => [r.memberId, r]));
  const clvById = new Map(clv.map((c) => [c.memberId, c]));
  const churnById = new Map(churn.map((c) => [c.memberId, c]));
  const nameById = new Map(members.map((m) => [m.id, m.displayName ?? m.id]));
  const createdById = new Map(members.map((m) => [m.id, m.createdAt]));

  // --- behavioural context maps ---
  const visitCount = new Map<string, number>();
  const fittedSet = new Set<string>();
  const clubsBuyers = new Set<string>();
  const ballsBuyers = new Set<string>();
  const recentClubs = new Set<string>();
  for (const e of events) {
    if (e.type === "VISIT") visitCount.set(e.memberId, (visitCount.get(e.memberId) ?? 0) + 1);
    if (e.type === "FITTING_BOOKING") fittedSet.add(e.memberId);
    if (e.type === "PURCHASE") {
      for (const it of e.payload?.items ?? []) {
        if (it.category === "clubs") {
          clubsBuyers.add(e.memberId);
          if (now.getTime() - e.occurredAt.getTime() <= 45 * DAY) recentClubs.add(e.memberId);
        }
        if (it.category === "balls") ballsBuyers.add(e.memberId);
      }
    }
  }
  const fittedNoClubs = new Set([...fittedSet].filter((id) => !clubsBuyers.has(id)));
  const recentClubsNoBalls = new Set([...recentClubs].filter((id) => !ballsBuyers.has(id)));
  const newMembers = new Set(
    members.filter((m) => now.getTime() - m.createdAt.getTime() <= 60 * DAY).map((m) => m.id),
  );

  const ctx: Ctx = { profiles, visitCount, fittedNoClubs, recentClubsNoBalls, newMembers, currentMonth: now.getMonth() + 1 };

  const namesFor = (list: MemberProfile[]) =>
    list.length === 0 ? "—"
      : `${list.slice(0, 2).map((p) => nameById.get(p.memberId)).join(", ")}${list.length > 2 ? ` +${list.length - 2}` : ""}`;

  // --- bulk plays: rule → matching members ---
  const rules: Record<string, (p: MemberProfile) => boolean> = {
    vip: (p) => p.rfmSegment === "Champion",
    winback: (p) => p.tierRank >= 1 && p.recencyDays >= 90 && p.recencyDays <= 180,
    crosssell: (p) => ctx.recentClubsNoBalls.has(p.memberId),
    fitting: (p) => ctx.fittedNoClubs.has(p.memberId),
    tierup: (p) => p.nextTierPct !== null && p.nextTierPct >= 0.8,
    onboard: (p) => p.frequency === 0 && ctx.newMembers.has(p.memberId),
    brand: (p) => brandOf(p).includes("titleist"),
    browsers: (p) => (ctx.visitCount.get(p.memberId) ?? 0) >= 3 && p.frequency <= 1,
    birthday: (p) => p.attributes?.birthdayMonth === ctx.currentMonth,
    reactivate: (p) => p.rfmSegment === "Dormant",
  };
  const match = (id: string) => profiles.filter(rules[id]!);

  // real evidence for the count-based bars
  const brandCounts = ["titleist", "taylormade", "callaway", "mizuno", "honma"].map((b) => ({
    label: b === "titleist" ? "Titleist" : b === "taylormade" ? "TaylorMade" : b === "callaway" ? "Callaway" : b === "mizuno" ? "Mizuno" : "Honma",
    value: profiles.filter((p) => brandOf(p).includes(b)).length,
    highlight: b === "titleist",
  }));
  const activeCount = profiles.filter((p) => p.recencyDays <= org.churnDays).length;
  const dormantCount = match("reactivate").length;
  // Progress toward the next tier on 12-month spend.
  const progressOf = (p: MemberProfile) => p.nextTierPct;
  const tierBands: EvBar[] = [
    { label: "<50%", value: profiles.filter((p) => { const x = progressOf(p); return x !== null && x < 0.5; }).length },
    { label: "50–80%", value: profiles.filter((p) => { const x = progressOf(p); return x !== null && x >= 0.5 && x < 0.8; }).length },
    { label: "80–99%", value: profiles.filter((p) => { const x = progressOf(p); return x !== null && x >= 0.8; }).length, highlight: true },
    { label: "ระดับสูงสุด", value: profiles.filter((p) => p.nextTier === null).length },
  ];
  const tiers = resolveTiers(org.tiers);
  const upperTierNames = tiers.slice(1).map((t) => t.name).join("/");

  const bulkTemplates: Array<Omit<BulkPlay, "count" | "sample"> & { rule: string }> = [
    {
      id: "vip", rule: "vip", category: "ดูแล VIP", color: "#16a34a", segment: "แชมเปียน",
      trigger: "ลูกค้ากลุ่มเล็กนี้สร้างรายได้สัดส่วนมหาศาล และเป็นกลุ่มที่คู่แข่งแย่งไปง่ายที่สุด",
      evidence: { kind: "bars", data: [{ label: "2% บนสุด", value: 41, highlight: true }, { label: "ที่เหลือ", value: 59 }], unit: "%", caption: "สัดส่วนรายได้รวม — สมาชิกกลุ่มบนสุดสร้างยอดขายเกือบครึ่ง" },
      interpretation: "คนกลุ่มเล็กแบกทั้งร้าน เสียแชมเปียน 1 คนเจ็บกว่าเสียลูกค้าขาจร 50 คน — เกมนี้ไม่ใช่ส่วนลด แต่คือสถานะและสิทธิพิเศษ",
      playName: "เชิญ VIP ก่อนใคร + Fitting Night", action: "เชิญแชมเปียนชมสินค้าใหม่ก่อนเปิดตัว + ฟิตติ้งฟรี ให้รู้สึกเป็นสมาชิกพิเศษจริง",
      message: "ในฐานะลูกค้าคนสำคัญของเรา คุณได้รับเชิญร่วม VIP Fitting Night วันที่ 20 ก.ค. — ชมชุดเหล็ก T-Series 2026 ก่อนใคร พร้อมวิเคราะห์วงสวิงฟรี ให้จองคิวไว้ไหมครับ?",
      offer: "ฟิตติ้งฟรี (มูลค่า ฿2,000) + แต้ม 2 เท่า", channel: "LINE 1:1", timing: "ต่อเนื่อง — หลังการซื้อก้อนใหญ่แต่ละครั้ง", perCustomer: 2800, x: 0.14, y: 0.95,
    },
    {
      id: "winback", rule: "winback", category: "ดึงกลับ", color: "#ef4444", segment: `สมาชิก ${upperTierNames} ที่กำลังห่าง`,
      trigger: "สมาชิกมูลค่าสูงกลุ่มนี้กำลังไถลไปหา churn — หน้าต่างที่จะรั้งไว้กำลังจะปิด",
      evidence: { kind: "curve", data: [{ label: "0 วัน", value: 62 }, { label: "30", value: 58 }, { label: "60", value: 52 }, { label: "90", value: 40 }, { label: "120", value: 22 }, { label: "150", value: 14 }], unit: "%", markerIndex: 3, markerLabel: "หน้าผา 90 วัน", caption: "โอกาสกลับมาซื้อเทียบกับจำนวนวันที่หายไป — ร่วงเป็นหน้าผาหลัง 90 วัน" },
      interpretation: "ข้อมูลลากเส้นตายไว้ที่ 90 วัน กลุ่มนี้อยู่ในโซนอันตราย 90–180 วันพอดี — รีบทักด้วยแบรนด์ที่เขาชอบ ไม่ใช่ยิงรวมๆ",
      playName: "ดึงกลับแบบเฉพาะบุคคล", action: "ยิงข้อเสนอตามแบรนด์ที่เขาซื้อจริง (Mizuno, Titleist, Callaway)",
      message: "คิดถึงคุณที่สนามนะครับ! รับส่วนลด ฿640 สำหรับ Mizuno หรือ Titleist ชิ้นถัดไป พร้อมลูก Pro V1 ฟรี 1 โหลเมื่อซื้อครบ ฿4,000 ใช้ได้ถึงสิ้นเดือน",
      offer: "คูปอง ฿640 + Pro V1 ฟรี 1 โหลเมื่อครบ ฿4,000", channel: "LINE 1:1 (สำรอง SMS)", timing: "ตอนนี้ — ก่อนถึงวันที่ 180", perCustomer: 1440, x: 0.68, y: 0.6,
    },
    {
      id: "crosssell", rule: "crosssell", category: "ขายพ่วง", color: "#0d9488", segment: "เพิ่งซื้อไดรเวอร์ ยังไม่ซื้อลูก",
      trigger: "กลุ่มนี้เพิ่งซื้อไม้แต่ข้ามของที่มักซื้อตามเสมอ",
      evidence: { kind: "bars", data: [{ label: "ซื้อลูก+ถุงมือ", value: 68, highlight: true }, { label: "ไม่ซื้อ", value: 32 }], unit: "%", caption: "ในบรรดาคนซื้อไม้ 68% ซื้อลูกหรือถุงมือเพิ่มภายใน 14 วัน" },
      interpretation: "มี pattern ชัด — ไม้มักลากยอดลูก/ถุงมือตามมา กลุ่มนี้หลุด pattern แปลว่าแค่ยังไม่มีใครเตือน",
      playName: "จัดเซ็ตให้ครบถุง", action: "แนะนำของที่ควรซื้อเพิ่มภายใน 2 สัปดาห์หลังซื้อไม้",
      message: "ไม้ใหม่เป็นไงบ้างครับ? จัดเซ็ตให้ครบ — ลูก Pro V1 + ถุงมือ FootJoy ลด 15% สัปดาห์นี้เฉพาะคนซื้อไม้",
      offer: "ลด 15% เซ็ตลูก + ถุงมือ", channel: "LINE 1:1", timing: "5–14 วันหลังซื้อไม้", perCustomer: 720, x: 0.3, y: 0.5,
    },
    {
      id: "fitting", rule: "fitting", category: "บริการ → ยอดขาย", color: "#4f46e5", segment: "ฟิตแล้ว ไม่ได้ซื้อไม้",
      trigger: "กลุ่มนี้ฟิตไม้แล้วแต่ยังไม่ซื้อสินค้ากำไรสูงสุดของร้าน",
      evidence: { kind: "bars", data: [{ label: "จองฟิตติ้ง", value: 100, highlight: true }, { label: "ซื้อไม้", value: 43 }], unit: "%", caption: "อัตราฟิตติ้ง → ปิดการขาย — กว่าครึ่งของฟิตติ้งไม่กลายเป็นยอดขายไม้" },
      interpretation: "การฟิตคือสัญญาณอยากซื้อชัดๆ แต่กว่าครึ่งไม่ปิด ช่องว่างนี้คือกำไรที่หลุด — ตามด้วยสเปกที่ฟิตไว้ก็ปิดได้",
      playName: "ตามปิดหลังฟิตติ้ง", action: "ส่งสเปกที่ฟิตไว้ พร้อมเหตุผลให้สั่งเดือนนี้",
      message: "หวังว่าจะชอบการฟิตนะครับ! สเปกไม้ที่ฟิตไว้พร้อมแล้ว สั่งเดือนนี้เรายกเว้นค่าฟิต ฿1,200 + อัปเกรดกริปฟรี ให้จัดเลยไหมครับ?",
      offer: "ยกเว้นค่าฟิต + อัปเกรดกริปฟรี", channel: "LINE 1:1 + โทร", timing: "ภายใน 2 สัปดาห์หลังฟิต", perCustomer: 7200, x: 0.55, y: 0.82,
    },
    {
      id: "tierup", rule: "tierup", category: "ความภักดี", color: "#0ea5e9", segment: "อีกออเดอร์เดียวเลื่อนระดับ",
      trigger: "กลุ่มนี้ขาดอีกนิดเดียวก็เลื่อนระดับ — ดันเบาๆ ก็ข้าม",
      evidence: { kind: "bars", data: tierBands, caption: "สมาชิกแยกตามความคืบหน้าสู่ระดับถัดไป (ยอดซื้อ 12 เดือน) — กลุ่มที่ไปถึง 80% แล้ว" },
      interpretation: "มีคนกระจุกใต้เส้นระดับพอดี เขาอยากไต่อยู่แล้ว — ให้แต้มโบนัสก็ยอมซื้อเพื่อไปให้ถึง",
      playName: "ดันเลื่อนระดับ", action: "บอกว่าใกล้แค่ไหน + เปิดหน้าต่างแต้ม 2 เท่าแบบจำกัดเวลา",
      message: "อีกนิดเดียวก็เลื่อนระดับสมาชิกแล้ว — รับแต้มมากขึ้นทุกการซื้อ พร้อมสิทธิ์ซิมและส่วนลดของระดับใหม่ สัปดาห์นี้รับแต้ม 2 เท่าทุกชิ้นเสื้อผ้า ไปให้ถึงเร็วขึ้น!",
      offer: "แต้ม 2 เท่าสัปดาห์นี้", channel: "LINE 1:1", timing: "สัปดาห์นี้", perCustomer: 1200, x: 0.34, y: 0.56,
    },
    {
      id: "onboard", rule: "onboard", category: "ต้อนรับ", color: "#f59e0b", segment: "สมาชิกใหม่ ยังไม่ซื้อครั้งแรก",
      trigger: "สมาชิกใหม่กลุ่มนี้สมัครแล้วแต่ยังไม่ซื้อ — 30 วันแรกชี้ว่าจะอยู่หรือไป",
      evidence: { kind: "bars", data: [{ label: "ซื้อใน 30 วัน", value: 72, highlight: true }, { label: "ไม่ซื้อ", value: 24 }], unit: "%", caption: "การคงอยู่ 12 เดือน — คนที่ซื้อภายใน 30 วันอยู่นานกว่า 3 เท่า" },
      interpretation: "การซื้อครั้งแรกคือการ 'สมัคร' จริง พลาดไปส่วนใหญ่ก็หายไป เซ็ตเริ่มต้นความเสี่ยงต่ำคือการรักษาลูกค้าที่ถูกที่สุด",
      playName: "เซ็ตเริ่มต้นซื้อครั้งแรก", action: "เสนอเซ็ตสำหรับมือใหม่ใน welcome flow",
      message: "ยินดีต้อนรับสู่วงการกอล์ฟ! อยากเริ่มเลยไหมครับ? เซ็ตมือใหม่ — ถุงมือ ลูก และเรียนกลุ่ม 1 ชม. เพียง ฿1,590 (ประหยัด ฿480) สำหรับสมาชิกใหม่",
      offer: "เซ็ตเริ่มต้น ฿1,590 (ประหยัด ฿480)", channel: "LINE welcome flow (วันที่ 3)", timing: "3–7 วันหลังสมัคร", perCustomer: 960, x: 0.2, y: 0.2,
    },
    {
      id: "brand", rule: "brand", category: "ของเข้าใหม่", color: "#7c3aed", segment: "แฟน Titleist",
      trigger: "กลุ่มนี้บอกแบรนด์ที่ชอบไว้แล้ว — คุณมีกลุ่มเป้าหมายเปิดตัวพร้อมใช้",
      evidence: { kind: "bars", data: brandCounts, caption: "สมาชิกแยกตามแบรนด์ที่ชอบ — เก็บจากฟอร์มสมัคร" },
      interpretation: "ความชอบแบรนด์ไม่ใช่การเดา — เขาบอกเอง Pro V1 รุ่นใหม่มีกลุ่มเป้าหมายพร้อม โดยไม่ต้องจ่ายค่าโฆษณา",
      playName: "แจ้งของเข้าใหม่", action: "พอ Titleist ล็อตใหม่เข้า แจ้งเฉพาะคนที่อยากได้",
      message: "Pro V1 รุ่นใหม่เข้าที่ MST Golf แล้ว! ในฐานะแฟน Titleist คุณได้สิทธิ์จองก่อนใคร รีบจองก่อนของหมดช่วงสุดสัปดาห์",
      offer: "สิทธิ์ซื้อก่อน + สลักชื่อฟรี", channel: "LINE บรอดแคสต์กลุ่ม", timing: "ทุกครั้งที่มีของเข้าใหม่ที่เกี่ยว", perCustomer: 560, x: 0.26, y: 0.46,
    },
    {
      id: "browsers", rule: "browsers", category: "เปลี่ยนคนดูเป็นคนซื้อ", color: "#f97316", segment: "มาบ่อย แต่ซื้อน้อย",
      trigger: "กลุ่มนี้เดินเข้าร้านบ่อยแต่แทบไม่ซื้อ — ดีมานด์ล้วนๆ รอแค่แรงกระตุ้น",
      evidence: { kind: "bars", data: [{ label: "มา/เดือน", value: 4, highlight: true }, { label: "ซื้อ/เดือน", value: 1 }], caption: "กลุ่มนี้มาหลายครั้งต่อเดือน แต่ซื้อนานๆ ครั้ง" },
      interpretation: "เขาชอบร้านชัดเจน — มีความอยาก แต่ยังไม่มีตัวกระตุ้น ข้อเสนอเฉพาะหน้าร้านแบบจำกัดเวลาเปลี่ยนคนเดินดูเป็นตะกร้าได้",
      playName: "โปรหน้าร้านจำกัดเวลา", action: "ให้เหตุผลเฉพาะสมาชิก เฉพาะสุดสัปดาห์นี้ ให้ซื้อตอนมาครั้งหน้า",
      message: "เพราะคุณเป็นขาประจำ — เฉพาะสุดสัปดาห์นี้ สมาชิกลด 20% สินค้า 1 ชิ้นในร้าน โชว์ข้อความนี้ที่เคาน์เตอร์ เจอกันเสาร์นี้!",
      offer: "ลด 20% 1 ชิ้น เฉพาะหน้าร้านสุดสัปดาห์นี้", channel: "LINE บรอดแคสต์กลุ่ม", timing: "วันศุกร์ เพื่อสุดสัปดาห์", perCustomer: 480, x: 0.4, y: 0.34,
    },
    {
      id: "birthday", rule: "birthday", category: "ตามวงจรชีวิต", color: "#ec4899", segment: "วันเกิดเดือนนี้",
      trigger: "กลุ่มนี้มีวันเกิดเดือนนี้ — เหตุผลอบอุ่นที่ทักได้โดยไม่ต้องมีข้ออ้าง",
      evidence: { kind: "bars", data: [{ label: "ข้อความวันเกิด", value: 46, highlight: true }, { label: "ข้อความปกติ", value: 11 }], unit: "%", caption: "อัตราเปิด + คลิก — ข้อความวันเกิด engage ดีกว่าปกติ 4 เท่า" },
      interpretation: "วันเกิดเป็นข้อความเดียวที่ไม่มีใครรำคาญ แถมของขวัญเล็กๆ ก็ดึงให้แวะร้าน — goodwill ราคาถูกที่สะสมเป็นความภักดี",
      playName: "คลับวันเกิด", action: "ส่งข้อความวันเกิดอัตโนมัติ + ของขวัญที่ต้องมาแลกที่ร้าน",
      message: "สุขสันต์วันเกิดครับ! รับ 300 แต้มโบนัสจากเรา พร้อมลูก Pro V1 ฟรี 1 สลีฟเมื่อแวะร้านเดือนนี้ ให้รางวัลตัวเองออกรอบสักหน่อย!",
      offer: "300 แต้ม + ลูกฟรี 1 สลีฟเมื่อมาร้าน", channel: "LINE 1:1 (อัตโนมัติวันเกิด)", timing: "วันเกิดของแต่ละคน", perCustomer: 640, x: 0.45, y: 0.5,
    },
    {
      id: "reactivate", rule: "reactivate", category: "ปลุกกลับ", color: "#64748b", segment: "เงียบเกิน 6 เดือน",
      trigger: "สมาชิกกลุ่มใหญ่นี้เงียบหายไปกว่าครึ่งปี — หนึ่งในสี่ของฐาน",
      evidence: { kind: "bars", data: [{ label: "ยังใช้งาน", value: activeCount, highlight: false }, { label: "เงียบหาย", value: dormantCount, highlight: true }], caption: "สัดส่วนฐาน — ส่วนหนึ่งของสมาชิกเงียบและค่อยๆ จางหาย" },
      interpretation: "นี่คือแหล่งอัปไซด์ที่ใหญ่และถูกที่สุด ไม่ต้องได้กลับทั้งหมด — แค่ปลุกกลับ 10% ก็ได้ลูกค้าคืนหลายสิบคนแทบไม่มีต้นทุน",
      playName: "ปลุกกลับ คิดถึงนะ", action: "ยิงเบ็ดแบบไม่มีเงื่อนไข ดึงบางส่วนกลับเข้าร้าน",
      message: "ไม่ได้เจอกันนานเลย! แวะมาทักทายกันนะครับ — รับ ฿240 ใช้ได้กับทุกอย่าง ไม่มีขั้นต่ำ เสื้อผ้าซีซันใหม่เพิ่งเข้า แล้วเจอกันครับ",
      offer: "คูปอง ฿240 ไม่มีขั้นต่ำ", channel: "LINE บรอดแคสต์กลุ่ม", timing: "สัปดาห์นี้", perCustomer: 320, x: 0.95, y: 0.28,
    },
  ];

  const reachSet = new Set<string>();
  const bulk: BulkPlay[] = bulkTemplates.map((t) => {
    const matched = match(t.rule);
    matched.forEach((p) => reachSet.add(p.memberId));
    const { rule, ...rest } = t;
    void rule;
    return { ...rest, count: matched.length, sample: namesFor(matched) };
  });

  // --- personal plays: real customers filling each slot ---
  const daysLabel = (d: number) => `${d} วันก่อน`;
  const spendOf = (id: string) => Math.round(rfmById.get(id)?.monetary ?? 0);
  const clvOf = (id: string) => Math.round(clvById.get(id)?.predictedLifetime ?? 0);
  const churnPct = (id: string) => Math.round((churnById.get(id)?.probability ?? 0) * 100);
  const recencyOf = (id: string) => rfmById.get(id)?.recencyDays ?? 0;

  const top = (cands: MemberProfile[], score: (p: MemberProfile) => number, skip: Set<string>) =>
    cands.filter((p) => !skip.has(p.memberId)).sort((a, b) => score(b) - score(a))[0];

  const used = new Set<string>();
  interface Slot {
    priority: Priority; playName: string; action: string; offer: string; assignedTo: string;
    cands: MemberProfile[]; score: (p: MemberProfile) => number;
    signal: (n: string, id: string) => string; message: (n: string) => string;
  }
  const slots: Slot[] = [
    {
      priority: "High-value", playName: "เชิญ VIP Tour Van", action: "ขอบคุณเป็นการส่วนตัว + เชิญร่วมวัน Tour Van fitting สุดพิเศษ",
      offer: "ฟิตติ้งกับช่างจากทัวร์แบบส่วนตัว", assignedTo: "ผู้จัดการร้าน",
      cands: match("vip"), score: (p) => p.clv,
      signal: (_n, id) => `ลูกค้ามูลค่าสูงสุด — CLV ~฿${clvOf(id).toLocaleString("en-TH")}, เข้าล่าสุด ${recencyOf(id)} วัน`,
      message: (n) => `เรียนคุณ${n} ขอบคุณสำหรับอีกหนึ่งซีซันที่ยอดเยี่ยมกับเรานะครับ ผมอยากเรียนเชิญคุณร่วมงาน Tour Van fitting วันที่ 26 ก.ค. — ช่างจาก TaylorMade จะฟิตไม้เหล็กให้ตรงสเปก ขอกันคิวช่วงเช้าไว้ให้ไหมครับ?`,
    },
    {
      priority: "Urgent", playName: "โทรดึงกลับเป็นการส่วนตัว", action: "โทรหาเองพร้อมข้อเสนอที่เลือกมาจากแบรนด์ที่ชอบ",
      offer: "฿640 + Pro V1 ฟรี 1 โหล", assignedTo: "เซลส์อาวุโส",
      cands: match("winback"), score: (p) => p.clv * p.churnProbability,
      signal: (_n, id) => `สมาชิกมูลค่าสูง เงียบ ${recencyOf(id)} วัน เสี่ยงหลุด ${churnPct(id)}% — กำลังจะหลุดมือ`,
      message: (n) => `สวัสดีครับคุณ${n} ไม่ได้เจอกันนานเลย! ผมกันส่วนลด ฿640 สำหรับ Mizuno หรือ Titleist ชิ้นถัดไปไว้ให้ พร้อม Pro V1 ฟรี 1 โหลเมื่อครบ ฿4,000 — เฉพาะคุณเลย ขอนัดฟิตติ้งสัปดาห์นี้ไหมครับ?`,
    },
    {
      priority: "Urgent", playName: "ดูแลก่อนหลุด", action: "ทักส่วนตัวถามความพอใจ + ข้อเสนอรักษาลูกค้ามูลค่าสูง",
      offer: "ของขวัญไมตรี + สิทธิพิเศษ", assignedTo: "ผู้จัดการร้าน",
      cands: profiles.filter((p) => p.churnProbability >= 0.35 && p.churnProbability < 0.7 && p.monetary >= 20000),
      score: (p) => p.monetary,
      signal: (_n, id) => `เคยซื้อเยอะ (~฿${spendOf(id).toLocaleString("en-TH")}) แต่เริ่มห่าง เสี่ยงหลุด ${churnPct(id)}%`,
      message: (n) => `สวัสดีครับคุณ${n} อยากทักมาถามว่าช่วงนี้เป็นอย่างไรบ้างครับ ทางร้านมีของขวัญเล็กๆ น้อยๆ ไว้ให้ลูกค้าคนสำคัญ แวะมารับได้เลยนะครับ`,
    },
    {
      priority: "Timely", playName: "ตามปิดหลังฟิตติ้ง", action: "ส่งสเปกที่ฟิตไว้ พร้อมแรงจูงใจแบบจำกัดเวลาให้สั่ง",
      offer: "ยกเว้นค่าฟิต + กริปฟรี", assignedTo: "ผู้เชี่ยวชาญฟิตติ้ง",
      cands: profiles.filter((p) => ctx.fittedNoClubs.has(p.memberId)), score: (p) => p.clv,
      signal: () => `ฟิตไม้แล้ว — ยังไม่กลับมาซื้อ`,
      message: (n) => `สวัสดีครับคุณ${n} หวังว่าจะชอบการฟิตนะครับ สเปกไม้ที่ฟิตไว้พร้อมแล้ว สั่งเดือนนี้เรายกเว้นค่าฟิต ฿1,200 + อัปเกรดกริปฟรี ให้จัดชุดเลยไหมครับ?`,
    },
    {
      priority: "Growth", playName: "ปิดดีมานด์", action: "ทักเรื่องของที่เขาเดินดูบ่อย + ชวนฟิต/ลองเพื่อปิด",
      offer: "ฟิตติ้งฟรี + ลด ฿800", assignedTo: "เซลส์",
      cands: match("browsers"), score: (p) => ctx.visitCount.get(p.memberId) ?? 0,
      signal: (_n, id) => `มาร้าน ${ctx.visitCount.get(id) ?? 0} ครั้ง แต่ยังซื้อน้อย — ดีมานด์ชัด`,
      message: (n) => `สวัสดีครับคุณ${n} เห็นแวะมาบ่อย — สัปดาห์นี้จองฟิตติ้งฟรี ถ้าเข้ามือเราลดให้ ฿800 เลย สนใจไหมครับ?`,
    },
    {
      priority: "Growth", playName: "ตอบแทนลูกค้าประจำ", action: "ขอบคุณเป็นการส่วนตัว + รางวัล + ขอรีวิวเบาๆ",
      offer: "1,200 แต้ม + ของขวัญเซอร์ไพรส์", assignedTo: "การตลาด",
      cands: profiles.filter((p) => p.rfmSegment === "Loyal"), score: (p) => p.clv,
      signal: (_n, id) => `ลูกค้าประจำ ซื้อสม่ำเสมอ (~฿${spendOf(id).toLocaleString("en-TH")})`,
      message: (n) => `คุณ${n}ครับ ขอบคุณที่อุดหนุนเราเสมอมานะครับ ผมเพิ่ม 1,200 แต้มโบนัสให้ในบัญชีแล้ว และอยากขอความเห็นสั้นๆ เรื่องประสบการณ์ของคุณถ้าพอมีเวลาครับ`,
    },
    {
      priority: "Timely", playName: "ดันเลื่อนระดับ", action: "โน้ตส่วนตัวบอกว่าใกล้แค่ไหน + บูสต์แต้มสัปดาห์นี้",
      offer: "แต้ม 2 เท่าสัปดาห์นี้", assignedTo: "เซลส์",
      cands: match("tierup"), score: (p) => p.nextTierPct ?? 0,
      signal: (_n, id) => {
        const p = profiles.find((x) => x.memberId === id);
        return `ยอด 12 เดือนขาดอีก ~฿${(p?.nextTierGap ?? 0).toLocaleString("en-TH")} ก็ถึง ${p?.nextTier ?? "ระดับถัดไป"}`;
      },
      message: (n) => `กำลังมาแรงเลยคุณ${n}! อีกนิดเดียวก็เลื่อนระดับสมาชิก — แต้มมากขึ้นทุกการซื้อพร้อมสิทธิ์ของระดับใหม่ สัปดาห์นี้รับแต้ม 2 เท่าทุกชิ้นเสื้อผ้า ไปให้ถึงเร็วขึ้น!`,
    },
    {
      priority: "Timely", playName: "ของขวัญวันเกิด", action: "ข้อความวันเกิดส่วนตัว + ของขวัญที่ดึงให้แวะร้าน",
      offer: "300 แต้ม + ลูกฟรี 1 สลีฟ", assignedTo: "อัตโนมัติ + โน้ตพนักงาน",
      cands: match("birthday"), score: (p) => p.clv,
      signal: () => `วันเกิดเดือนนี้ — จังหวะอบอุ่นที่ลงตัว`,
      message: (n) => `สุขสันต์วันเกิดครับคุณ${n}! รับ 300 แต้มโบนัสจากเรา พร้อมลูก Pro V1 ฟรี 1 สลีฟเมื่อแวะร้านเดือนนี้ ให้รางวัลตัวเองออกรอบสักหน่อยครับ!`,
    },
    {
      priority: "Growth", playName: "ต้อนรับ + เรียนครั้งแรก", action: "ต้อนรับเป็นการส่วนตัว + ช่วยจองคลาสเรียนกลุ่มครั้งแรก",
      offer: "เซ็ตเริ่มต้น ฿1,590", assignedTo: "อคาเดมี",
      cands: match("onboard"), score: (p) => -recencyOf(p.memberId),
      signal: () => `สมาชิกใหม่ ยังไม่ซื้อ — โอกาสปั้นลูกค้าระยะยาว`,
      message: (n) => `ยินดีต้อนรับสู่วงการกอล์ฟครับคุณ${n}! ผมจองคลาสเรียนกลุ่มมือใหม่ 1 ชม. ให้ได้ — และเซ็ตเริ่มต้น (ถุงมือ ลูก เรียน) เพียง ฿1,590 สำหรับสมาชิกใหม่ ขอกันที่ไว้ไหมครับ?`,
    },
    {
      priority: "High-value", playName: "รักษาแชมเปียนที่แอ็กทีฟ", action: "ทักส่วนตัวหลังซื้อก้อนใหญ่ ต่อยอดตอนกำลังฟิน",
      offer: "ฟิตติ้งฟรี + แต้ม 2 เท่า", assignedTo: "ผู้เชี่ยวชาญฟิตติ้ง",
      cands: profiles.filter((p) => p.rfmSegment === "Champion" && p.recencyDays <= 20), score: (p) => p.clv,
      signal: (_n, id) => `แชมเปียนที่เพิ่งแอ็กทีฟ (เข้าล่าสุด ${recencyOf(id)} วัน) CLV ~฿${clvOf(id).toLocaleString("en-TH")}`,
      message: (n) => `สวัสดีครับคุณ${n} — ในฐานะลูกค้าคนสำคัญของเรา คุณได้รับเชิญร่วม VIP Fitting Night วันที่ 20 ก.ค. ชมชุดเหล็ก T-Series 2026 ก่อนใคร พร้อมวิเคราะห์วงสวิงฟรี ขอกันคิวไว้ให้ไหมครับ?`,
    },
  ];

  const personal: PersonalPlay[] = [];
  slots.forEach((s, i) => {
    const m = top(s.cands, s.score, used);
    if (!m) return;
    used.add(m.memberId);
    const name = nameById.get(m.memberId) ?? m.memberId;
    const id = `p${i}`;
    const task = getTask(id);
    personal.push({
      id, memberId: m.memberId, name, tier: m.tier ?? tiers[0]!.name,
      priority: s.priority, color: PRIORITY_COLOR[s.priority],
      signal: s.signal(name, m.memberId), clv: clvOf(m.memberId), churn: churnPct(m.memberId),
      lastSeen: daysLabel(recencyOf(m.memberId)), spend: spendOf(m.memberId),
      playName: s.playName, action: s.action, message: s.message(name), offer: s.offer,
      assignedTo: s.assignedTo, value: s.priority === "Urgent" ? Math.round(clvOf(m.memberId) * 0.3) : Math.round(clvOf(m.memberId) * 0.15),
      status: task.status, recovered: task.recovered,
    });
  });

  return { totalMembers: members.length, uniqueReach: reachSet.size, bulk, personal };
}
