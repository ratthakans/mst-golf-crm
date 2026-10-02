import type { NotificationKind } from "@mstgolf/shared";
import { formatBaht } from "../money";
import { formatHm, formatThaiDate } from "../time";
import type { LineMessage } from "./line-api";

// Flex messages for every notification kind. Rendered at send time from the
// stored payload, so wording and branding changes apply to queued messages too.

export interface RenderContext {
  brandColor: string;
  storeName: string;
  memberUrl: string | null; // LIFF link to the member card
  bookingUrl: string | null; // LIFF link to booking
  rewardsUrl?: string | null; // LIFF link to rewards
}

export interface WelcomePayload {
  displayName: string;
  code: string;
  points: number;
}
export interface PointsPayload {
  bills: number;
  spentSatang: number;
  earned: number;
  balance: number;
  tierName: string;
  nextTierName: string | null;
  remainingBaht: number | null;
  storeName?: string; // the batch's store — the online shop for online orders
}
export interface TierUpPayload {
  tierName: string;
  pointRate: number;
  discountPct: number;
  simDiscountPct: number;
}
export interface BookingPayload {
  bookingId: string;
  laneName: string;
  startAt: string; // ISO
  partySize: number;
  priceSatang: number;
  previousStartAt?: string;
  previousLaneName?: string;
  reason?: string | null;
}

export interface RedemptionReceivedPayload {
  code: string;
  kind: "COUPON" | "PHYSICAL";
  rewardName: string;
  points: number;
  balance: number;
  couponCode: string | null;
  valueSatang: number | null;
  expiresAt: string | null;
  fulfilment: string | null;
}
export interface RedemptionStatusPayload {
  code: string;
  kind: "COUPON" | "PHYSICAL";
  rewardName: string;
  status: string;
  note: string | null;
  carrier: string | null;
  trackingNo: string | null;
  refunded: number;
  method: "PICKUP" | "SHIP" | null;
}

type Row = { label: string; value: string; strong?: boolean };

function bubble(ctx: RenderContext, title: string, lead: string, rows: Row[], button: { label: string; url: string | null }, foot?: string): LineMessage {
  const body: unknown[] = [
    { type: "text", text: "MST GOLF", size: "xs", color: ctx.brandColor, weight: "bold" },
    { type: "text", text: title, size: "lg", weight: "bold", wrap: true, margin: "sm" },
  ];
  if (lead) body.push({ type: "text", text: lead, size: "sm", color: "#555555", wrap: true, margin: "sm" });
  if (rows.length) {
    body.push({ type: "separator", margin: "lg" });
    body.push({
      type: "box",
      layout: "vertical",
      margin: "lg",
      spacing: "sm",
      contents: rows.map((r) => ({
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: r.label, size: "sm", color: "#777777", flex: 4, wrap: true },
          {
            type: "text",
            text: r.value,
            size: "sm",
            align: "end",
            flex: 5,
            wrap: true,
            weight: r.strong ? "bold" : "regular",
            color: r.strong ? ctx.brandColor : "#111111",
          },
        ],
      })),
    });
  }
  if (foot) body.push({ type: "text", text: foot, size: "xs", color: "#777777", wrap: true, margin: "lg" });
  const bubbleJson: Record<string, unknown> = {
    type: "bubble",
    body: { type: "box", layout: "vertical", contents: body },
  };
  if (button.url) {
    bubbleJson.footer = {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "button", style: "primary", color: ctx.brandColor, height: "sm", action: { type: "uri", label: button.label, uri: button.url } },
      ],
    };
  }
  return { type: "flex", altText: `${title} — ${lead}`.slice(0, 390), contents: bubbleJson };
}

const n = (v: number) => v.toLocaleString("en-US");
const when = (iso: string) => {
  const d = new Date(iso);
  return `${formatThaiDate(d, { weekday: true, year: false })} · ${formatHm(d)} น.`;
};

export function renderNotification(kind: NotificationKind, payload: unknown, ctx: RenderContext): LineMessage[] {
  switch (kind) {
    case "WELCOME": {
      const p = payload as WelcomePayload;
      return [
        bubble(
          ctx,
          "ยินดีต้อนรับสู่ MST Golf",
          `คุณ${p.displayName} สมัครสมาชิกเรียบร้อย`,
          [
            { label: "รหัสสมาชิก", value: p.code },
            { label: "แต้มต้อนรับ", value: `+${n(p.points)} แต้ม`, strong: true },
          ],
          { label: "เปิดบัตรสมาชิก", url: ctx.memberUrl },
          "แสดงบัตรสมาชิกหรือแจ้งเบอร์โทรตอนชำระเงิน เพื่อรับแต้มทุกครั้ง",
        ),
      ];
    }
    case "POINTS": {
      const p = payload as PointsPayload;
      const rows: Row[] = [
        { label: "ร้าน", value: p.storeName ?? ctx.storeName },
        { label: p.bills > 1 ? `ยอดซื้อ (${p.bills} บิล)` : "ยอดซื้อ", value: formatBaht(p.spentSatang) },
        { label: "แต้มที่ได้", value: `${p.earned >= 0 ? "+" : ""}${n(p.earned)}`, strong: true },
        { label: "แต้มคงเหลือ", value: n(p.balance) },
      ];
      const foot =
        p.nextTierName && p.remainingBaht !== null
          ? `ยอดซื้อ 12 เดือนอีก ฿${n(Math.ceil(p.remainingBaht))} ขึ้นเป็น ${p.nextTierName}`
          : `ระดับ ${p.tierName}`;
      return [bubble(ctx, "ได้รับแต้มแล้ว", "", rows, { label: "ดูแต้มของฉัน", url: ctx.memberUrl }, foot)];
    }
    case "TIER_UP": {
      const p = payload as TierUpPayload;
      const rows: Row[] = [{ label: "แต้มต่อ 1 บาท", value: `${p.pointRate} แต้ม`, strong: true }];
      if (p.discountPct) rows.push({ label: "ส่วนลดร้าน", value: `${p.discountPct}%` });
      if (p.simDiscountPct) rows.push({ label: "ส่วนลดซิมกอล์ฟ", value: `${p.simDiscountPct}%` });
      return [bubble(ctx, `ยินดีด้วย คุณเป็นสมาชิก ${p.tierName} แล้ว`, "สิทธิประโยชน์ใหม่ใช้ได้ตั้งแต่วันนี้", rows, { label: "เปิดบัตรสมาชิก", url: ctx.memberUrl })];
    }
    case "REDEMPTION_RECEIVED": {
      const p = payload as RedemptionReceivedPayload;
      const url = ctx.rewardsUrl ?? ctx.memberUrl;
      if (p.kind === "COUPON") {
        const rows: Row[] = [
          { label: "คูปอง", value: p.rewardName, strong: true },
          { label: "รหัสคูปอง", value: p.couponCode ?? "—" },
          { label: "ใช้ได้ถึง", value: p.expiresAt ? formatThaiDate(new Date(p.expiresAt)) : "—" },
          { label: "แต้มที่ใช้", value: `−${n(p.points)}` },
          { label: "แต้มคงเหลือ", value: n(p.balance) },
        ];
        return [bubble(ctx, "ได้รับคูปองแล้ว", "เปิดคูปองแล้วให้พนักงานสแกน QR ตอนชำระเงิน", rows, { label: "เปิดคูปอง", url }, `Redemption ID ${p.code}`)];
      }
      const rows: Row[] = [
        { label: "รางวัล", value: p.rewardName, strong: true },
        { label: "Redemption ID", value: p.code },
        { label: "แต้มที่ใช้", value: `−${n(p.points)}` },
        { label: "แต้มคงเหลือ", value: n(p.balance) },
      ];
      const foot = `${p.fulfilment ? `ระยะเวลาโดยประมาณ ${p.fulfilment} ` : ""}ขึ้นอยู่กับสต็อกและการยืนยันการจัดส่ง · ถ้าคำขอไม่ผ่าน แต้มจะคืนเข้าบัญชีทั้งหมด`;
      return [bubble(ctx, "ได้รับคำขอแลกรางวัลแล้ว", "ทีมงานจะตรวจสอบและแจ้งขั้นตอนถัดไปทาง LINE", rows, { label: "ติดตามสถานะ", url }, foot)];
    }
    case "REDEMPTION_STATUS": {
      const p = payload as RedemptionStatusPayload;
      const url = ctx.rewardsUrl ?? ctx.memberUrl;
      const titles: Record<string, string> = {
        UNDER_REVIEW: "กำลังตรวจสอบคำขอของคุณ",
        APPROVED: "คำขอแลกรางวัลได้รับการอนุมัติ",
        PROCESSING: p.method === "PICKUP" ? "กำลังเตรียมของให้มารับ" : "กำลังเตรียมจัดส่ง",
        SHIPPED: "จัดส่งรางวัลแล้ว",
        COMPLETED: p.method === "PICKUP" ? "รับรางวัลเรียบร้อย" : "ส่งถึงเรียบร้อย",
        REJECTED: "คำขอแลกรางวัลไม่ได้รับการอนุมัติ",
        CANCELLED: p.kind === "COUPON" ? "คูปองถูกยกเลิก" : "ยกเลิกคำขอแลกรางวัลแล้ว",
        USED: "ใช้คูปองแล้ว",
      };
      const rows: Row[] = [
        { label: p.kind === "COUPON" ? "คูปอง" : "รางวัล", value: p.rewardName, strong: true },
        { label: "Redemption ID", value: p.code },
      ];
      if (p.status === "SHIPPED" && p.trackingNo) rows.push({ label: p.carrier ? `เลขพัสดุ (${p.carrier})` : "เลขพัสดุ", value: p.trackingNo });
      if (p.refunded) rows.push({ label: "คืนแต้ม", value: `+${n(p.refunded)}`, strong: true });
      const lead = p.note ?? (p.status === "USED" ? "ขอบคุณที่ใช้บริการ MST Golf" : "");
      return [bubble(ctx, titles[p.status] ?? "อัปเดตสถานะการแลกรางวัล", lead, rows, { label: "ดูรายละเอียด", url })];
    }
    case "BOOKING_CONFIRMED":
    case "BOOKING_REMINDER":
    case "BOOKING_CANCELLED":
    case "BOOKING_MOVED": {
      const p = payload as BookingPayload;
      const rows: Row[] = [
        { label: "วันเวลา", value: when(p.startAt), strong: kind !== "BOOKING_CANCELLED" },
        { label: "Lane", value: p.laneName },
        { label: "จำนวนคน", value: `${p.partySize} คน` },
      ];
      if (kind !== "BOOKING_CANCELLED") rows.push({ label: "ค่าบริการ (ชำระที่ร้าน)", value: formatBaht(p.priceSatang) });
      const title = {
        BOOKING_CONFIRMED: "ยืนยันการจองซิมกอล์ฟ",
        BOOKING_REMINDER: "อีก 2 ชั่วโมงถึงเวลาจอง",
        BOOKING_CANCELLED: "ยกเลิกการจองแล้ว",
        BOOKING_MOVED: "เปลี่ยนเวลาการจองแล้ว",
      }[kind];
      const lead =
        kind === "BOOKING_MOVED" && p.previousStartAt
          ? `จากเดิม ${when(p.previousStartAt)}${p.previousLaneName ? ` · ${p.previousLaneName}` : ""}`
          : kind === "BOOKING_CANCELLED"
            ? p.reason
              ? `เหตุผล: ${p.reason}`
              : "ช่องเวลานี้เปิดให้คนอื่นจองแล้ว"
            : ctx.storeName;
      const foot = kind === "BOOKING_CANCELLED" ? undefined : "มาถึงแล้วแจ้งชื่อที่เคาน์เตอร์เพื่อเช็กอิน · เกิน 15 นาทีถือว่าไม่มาตามนัด";
      return [bubble(ctx, title, lead, rows, { label: kind === "BOOKING_CANCELLED" ? "จองเวลาใหม่" : "ดูการจองของฉัน", url: ctx.bookingUrl }, foot)];
    }
  }
}
