"use client";

import { useState } from "react";
import { SaveBar, useSave } from "../useSave";

/** The menus outside the Phase 1 contract: off by default, on for a demo or once MST takes Phase 2. */
export function IntelligenceForm({ on: initial }: { on: boolean }) {
  const [on, setOn] = useState(initial);
  const s = useSave("intelligence");
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void s.save({ on }); }}>
      <h3>เมนูวิเคราะห์ลูกค้า (นอกขอบเขต Phase 1)</h3>
      <label className="toggle-row">
        <span>
          <b>แสดงเมนู แผนลงมือ · กลุ่มลูกค้า · ระบบอัตโนมัติ</b>
          <span>
            {on
              ? "เปิดอยู่: ผู้ดูแลระบบและการตลาดเห็นเมนูเหล่านี้ ตัวเลขคำนวณจากยอดขายและการจองในระบบ — ข้อมูลน้อยหรือเป็นข้อมูลทดลอง ผลจะยังไม่มีความหมาย"
              : "ปิดอยู่: ซ่อนเมนูวิเคราะห์ลูกค้า เปิดเพื่อดูตัวอย่าง หรือเมื่อเริ่มใช้งาน Phase 2"}
          </span>
        </span>
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
      </label>
      <SaveBar {...s} />
    </form>
  );
}
