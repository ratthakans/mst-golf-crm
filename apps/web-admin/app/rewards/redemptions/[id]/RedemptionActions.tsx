"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorText } from "../../../ui/api";

type Status = string;

const HINT: Record<string, string> = {
  UNDER_REVIEW: "รับเรื่องแล้ว กำลังตรวจสิทธิ์และสต็อก",
  APPROVED: "ผ่านการตรวจ — ลูกค้าได้รับแจ้งว่าอนุมัติแล้ว",
  PROCESSING: "สั่งซื้อ/แพ็กของ",
  SHIPPED: "ต้องมีเลขพัสดุ",
  COMPLETED: "ลูกค้าได้รับของแล้ว",
  REJECTED: "คืนแต้มให้ลูกค้า — ต้องใส่เหตุผล",
  CANCELLED: "คืนแต้มให้ลูกค้า — ต้องใส่เหตุผล",
};

export function RedemptionActions(props: {
  id: string;
  kind: "COUPON" | "PHYSICAL";
  status: Status;
  next: Array<{ status: Status; label: string }>;
  carrier: string | null;
  trackingNo: string | null;
  mine: boolean;
  method: "PICKUP" | "SHIP" | null;
  points: number;
}) {
  const router = useRouter();
  const [to, setTo] = useState<Status>(props.next[0]?.status ?? "");
  const [note, setNote] = useState("");
  const [carrier, setCarrier] = useState(props.carrier ?? "");
  const [trackingNo, setTrackingNo] = useState(props.trackingNo ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRefund, setConfirmRefund] = useState(false);
  const refund = to === "REJECTED" || to === "CANCELLED";
  const needsTracking = to === "SHIPPED";

  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/redemptions/${props.id}`, { method: "PATCH", body });
      setNote("");
      setConfirmRefund(false);
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (refund && !confirmRefund) {
      setConfirmRefund(true);
      return;
    }
    const body: Record<string, unknown> = { status: to, note };
    if (props.kind === "PHYSICAL") Object.assign(body, { carrier, trackingNo });
    void send(body);
  };

  return (
    <form onSubmit={submit} style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>เปลี่ยนสถานะ</h3>
      <div className="chips" role="radiogroup" aria-label="สถานะถัดไป">
        {props.next.map((n) => (
          <button
            key={n.status}
            type="button"
            role="radio"
            aria-checked={to === n.status}
            className={`chip${to === n.status ? " chip-on" : ""}`}
            onClick={() => {
              setTo(n.status);
              setConfirmRefund(false);
            }}
          >
            {n.label}
          </button>
        ))}
      </div>
      {HINT[to] && <p className="muted small">{HINT[to]}</p>}
      {props.kind === "PHYSICAL" && props.method !== "PICKUP" && (needsTracking || to === "PROCESSING") && (
        <div className="form-grid">
          <label className="field"><span>ขนส่ง</span><input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Kerry · Flash · ไปรษณีย์ไทย" /></label>
          <label className="field"><span>เลขพัสดุ{needsTracking ? "" : " (ถ้ามี)"}</span><input value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} className="mono" /></label>
        </div>
      )}
      <label className="field">
        <span>ข้อความถึงลูกค้า {refund ? "(ต้องใส่)" : <span className="hint">— ไม่บังคับ ลูกค้าเห็นใน LINE</span>}</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={refund ? "เช่น สินค้าหมด ขออภัยในความไม่สะดวก" : "เช่น ของพร้อมรับที่สาขาตั้งแต่วันศุกร์"} />
      </label>
      {confirmRefund && (
        <p className="notice">
          ยืนยันอีกครั้ง: ระบบจะคืน {props.points.toLocaleString("en-US")} แต้มให้ลูกค้า คืนสต็อก 1 ชิ้น และแจ้งลูกค้าทาง LINE — ย้อนกลับไม่ได้
        </p>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="btn-row">
        <button className={`btn${refund ? " btn-danger" : ""}`} disabled={busy || !to}>
          {busy ? "กำลังบันทึก…" : confirmRefund ? "ยืนยัน คืนแต้ม" : `เปลี่ยนเป็น "${props.next.find((n) => n.status === to)?.label ?? ""}"`}
        </button>
        {!props.mine && props.kind === "PHYSICAL" && (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void send({ takeOwnership: true })}>
            รับเป็นเจ้าของเคส
          </button>
        )}
      </div>
    </form>
  );
}
