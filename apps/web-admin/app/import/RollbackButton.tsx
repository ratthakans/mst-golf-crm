"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorText } from "../ui/api";
import { Modal } from "../ui/Modal";

export function RollbackButton({ id, fileName }: { id: string; fileName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button className="link-btn danger-text" onClick={() => setOpen(true)}>ยกเลิกรอบนี้</button>
      {open && (
        <Modal title="ยกเลิกการนำเข้า" sub={fileName} onClose={() => setOpen(false)}>
          <p className="small" style={{ lineHeight: 1.6 }}>
            บิลทั้งหมดในรอบนี้จะถูกนำออก แต้มที่ให้ไปจะถูกหักคืน และระดับสมาชิกคำนวณใหม่ · หลังยกเลิกแล้วนำเข้าไฟล์ที่ถูกต้องได้ทันที
          </p>
          <label className="field"><span>เหตุผล <b>*</b></span><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น เลือกไฟล์ผิดวัน" /></label>
          {error && <p className="form-error">{error}</p>}
          <div className="btn-row">
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>ปิด</button>
            <button
              className="btn btn-danger"
              disabled={busy || !reason.trim()}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await api(`/api/import/${id}/rollback`, { body: { reason } });
                  setOpen(false);
                  router.refresh();
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "กำลังยกเลิก…" : "ยกเลิกรอบนำเข้า"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
