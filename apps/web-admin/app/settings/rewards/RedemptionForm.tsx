"use client";

import { useState } from "react";
import { SaveBar, useSave } from "../useSave";

export function RedemptionForm({ alertEmails, backofficeUrl, mailer }: { alertEmails: string[]; backofficeUrl: string | null; mailer: boolean }) {
  const [emails, setEmails] = useState(alertEmails.join("\n"));
  const s = useSave("rewards");
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void s.save({ alertEmails: emails.split(/[\s,;]+/).filter(Boolean) }); }}>
      <h3>อีเมลแจ้งคำขอแลกของ</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        ทุกครั้งที่สมาชิกขอแลกรางวัลที่เป็นของ (เช่น iPad) ระบบส่งอีเมลไปที่รายชื่อนี้ทันที · ในอีเมลมีแค่ Redemption ID รหัสสมาชิก และลิงก์เปิดเคสในหลังบ้าน ไม่มีชื่อ เบอร์ หรือที่อยู่ลูกค้า · คูปองไม่ส่งอีเมล เพราะออกให้ทันทีและใช้ได้ที่ร้าน
      </p>
      <label className="field">
        <span>อีเมลผู้รับ <span className="hint">— บรรทัดละ 1 อีเมล ไม่เกิน 10</span></span>
        <textarea value={emails} onChange={(e) => setEmails(e.target.value)} placeholder={"marketing@mstgolf.co.th"} rows={3} />
      </label>
      <p className="muted small">
        ลิงก์ในอีเมลชี้ไปที่ <span className="mono">{backofficeUrl ?? "(บันทึกครั้งแรกแล้วจะใช้โดเมนของหลังบ้านนี้)"}</span>
        {!mailer && <> · <b className="danger-text">ยังไม่ได้ตั้งบริการส่งอีเมล</b> คำขอยังเข้าคิวในหลังบ้านตามปกติ แต่จะไม่มีอีเมลออกไปจนกว่า ORIONS จะตั้งค่า</>}
      </p>
      <SaveBar {...s} />
    </form>
  );
}
