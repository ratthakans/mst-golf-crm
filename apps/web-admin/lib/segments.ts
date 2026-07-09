import type { RfmSegment } from "@mstgolf/analytics";

export const SEGMENT_ORDER: RfmSegment[] = [
  "Champion",
  "Loyal",
  "Potential",
  "New",
  "At-Risk",
  "Dormant",
  "Regular",
];

export const SEGMENT_COLOR: Record<RfmSegment, string> = {
  Champion: "var(--champion)",
  Loyal: "var(--loyal)",
  Potential: "var(--potential)",
  New: "var(--new)",
  "At-Risk": "var(--atrisk)",
  Dormant: "var(--dormant)",
  Regular: "var(--regular)",
};

export const SEGMENT_HINT: Record<RfmSegment, string> = {
  Champion: "มาถี่ ซื้อบ่อย ยอดสูง — ให้รางวัลและเสนอของพรีเมียม",
  Loyal: "ซื้อสม่ำเสมอ — รักษาความผูกพันไว้",
  Potential: "มูลค่าดี กระตุ้นให้กลับมาซื้ออีก",
  New: "เพิ่งสมัคร — ดูแลเริ่มต้นและดันซื้อครั้งแรก",
  "At-Risk": "เคยแอ็กทีฟ กำลังห่างหาย — ดึงกลับ",
  Dormant: "เงียบมานาน — แคมเปญปลุกกลับมา",
  Regular: "ยังไม่มีสัญญาณชัด",
};

// Thai display labels (the RfmSegment keys stay English internally).
export const SEGMENT_LABEL: Record<RfmSegment, string> = {
  Champion: "แชมเปียน",
  Loyal: "ภักดี",
  Potential: "มีศักยภาพ",
  New: "สมาชิกใหม่",
  "At-Risk": "เสี่ยงหลุด",
  Dormant: "เงียบหาย",
  Regular: "ทั่วไป",
};
