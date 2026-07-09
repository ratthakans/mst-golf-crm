"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BubbleMap, MiniBars, MiniCurve } from "../evidence";
import { AiCopy } from "../AiCopy";
import { CountUp } from "../CountUp";
import type { BulkPlay, PersonalPlay, Priority } from "../../lib/playbook";
import type { TaskStatus } from "../../lib/tasks";

const STATUS_LABEL: Record<TaskStatus, string> = { pending: "รอดำเนินการ", contacted: "ติดต่อแล้ว", won: "ปิดได้", lost: "ไม่สำเร็จ" };
const STATUS_CLASS: Record<TaskStatus, string> = { pending: "pending", contacted: "contacted", won: "won", lost: "lost" };

const PRIORITY_RANK: Record<Priority, number> = { Urgent: 0, "High-value": 1, Timely: 2, Growth: 3 };
const PRIORITY_COLOR: Record<Priority, string> = { Urgent: "#ef4444", "High-value": "#16a34a", Timely: "#7c3aed", Growth: "#0ea5e9" };
const PRIORITY_LABEL: Record<Priority, string> = { Urgent: "ด่วน", "High-value": "มูลค่าสูง", Timely: "ทันเวลา", Growth: "เติบโต" };

const NUM = (n: number) => n.toLocaleString("en-TH");

export function PlaybookView({
  totalMembers,
  uniqueReach,
  bulk,
  personal,
}: {
  totalMembers: number;
  uniqueReach: number;
  bulk: BulkPlay[];
  personal: PersonalPlay[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"bulk" | "personal">("bulk");
  const [open, setOpen] = useState<string | null>(bulk[0]?.id ?? null);
  const [openP, setOpenP] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: TaskStatus, recovered = 0) {
    setBusy(id);
    await fetch("/api/plays/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, recovered }),
    });
    router.refresh(); // re-render server component with updated task state
    setBusy(null);
  }

  const bubbles = bulk.map((p) => ({ x: p.x, y: p.y, count: p.count, label: p.category, color: p.color }));
  const bulkReach = bulk.reduce((s, p) => s + p.count, 0);
  const bulkOpportunity = bulk.reduce((s, p) => s + p.count * p.perCustomer, 0);
  const personalSorted = [...personal].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.value - a.value,
  );
  const personalValue = personal.reduce((s, p) => s + p.value, 0);
  const urgent = personal.filter((p) => p.priority === "Urgent").length;
  const wonCount = personal.filter((p) => p.status === "won").length;
  const recoveredTotal = personal.reduce((s, p) => s + p.recovered, 0);

  return (
    <>
      <div className="page-head">
        <h1>แผนลงมือ</h1>
        <p>
          ลูกค้าของคุณมาทั้งแบบ &quot;กลุ่ม&quot; และ &quot;รายคน&quot; — ระบบจับได้ทั้งคู่ ทั้งแคมเปญกลุ่มไว้ยิงทีละมากๆ
          และแอ็กชัน 1:1 สำหรับลูกค้าที่ควรดูแลเป็นพิเศษ (คำนวณจากฐานสมาชิกจริง {NUM(totalMembers)} คน)
        </p>
      </div>

      <div className="pb-tabs">
        <button className={`pb-tab${mode === "bulk" ? " active" : ""}`} onClick={() => setMode("bulk")}>
          แคมเปญกลุ่ม <span>{bulk.length}</span>
        </button>
        <button className={`pb-tab${mode === "personal" ? " active" : ""}`} onClick={() => setMode("personal")}>
          รายบุคคล <span>{personal.length}</span>
        </button>
      </div>

      {mode === "bulk" ? (
        <>
          <div className="pb-summary">
            <div className="pb-sum-item"><div className="pb-sum-num">{NUM(totalMembers)}</div><div className="pb-sum-label">สมาชิก</div></div>
            <div className="pb-sum-item"><div className="pb-sum-num">{bulk.length}</div><div className="pb-sum-label">แคมเปญพร้อมยิง</div></div>
            <div className="pb-sum-item"><div className="pb-sum-num">{NUM(uniqueReach)}</div><div className="pb-sum-label">ลูกค้าที่มี action ({Math.round((uniqueReach / Math.max(1, totalMembers)) * 100)}% ของฐาน)</div></div>
            <div className="pb-sum-item"><div className="pb-sum-num accent"><CountUp value={bulkOpportunity} prefix="฿" /></div><div className="pb-sum-label">โอกาสเดือนนี้</div></div>
          </div>

          <div className="card pb-map">
            <h3>แผนที่โอกาส</h3>
            <p className="muted-sub">วางทุกกลุ่มตาม engagement × มูลค่า — ขนาดฟองคือจำนวนลูกค้า ไม่มีใครหลุดรอด</p>
            <BubbleMap bubbles={bubbles} />
          </div>

          <div className="pb-list">
            {bulk.map((p) => {
              const isOpen = open === p.id;
              return (
                <div className={`pb-card${isOpen ? " open" : ""}`} key={p.id} style={{ borderLeftColor: p.color }}>
                  <button className="pb-cardhead" onClick={() => setOpen(isOpen ? null : p.id)}>
                    <div className="pb-who">
                      <span className="pb-cat" style={{ background: p.color }}>{p.category}</span>
                      <span className="pb-name">{p.segment}</span>
                      <span className="pb-count">{NUM(p.count)} คน</span>
                    </div>
                    <div className="pb-trigger">{p.trigger}</div>
                    <div className="pb-cta">{isOpen ? "ซ่อนแผน" : "ดูแผน"}</div>
                  </button>
                  {isOpen && (
                    <div className="pb-detail">
                      <div className="pb-cols">
                        <div className="pb-evidence">
                          <span className="pb-tag">หลักฐาน</span>
                          {p.evidence.kind === "bars" ? (
                            <MiniBars data={p.evidence.data} unit={p.evidence.unit} color={p.color} />
                          ) : (
                            <MiniCurve data={p.evidence.data} unit={p.evidence.unit} color={p.color} markerIndex={p.evidence.markerIndex} markerLabel={p.evidence.markerLabel} />
                          )}
                          <div className="pb-caption">{p.evidence.caption}</div>
                        </div>
                        <div className="pb-read">
                          <span className="pb-tag">การตีความเชิงครีเอทีฟ</span>
                          <div className="pb-interp">{p.interpretation}</div>
                          <div className="pb-sample">ตัวอย่าง: {p.sample}</div>
                        </div>
                      </div>
                      <span className="pb-tag">แผน — {p.playName}</span>
                      <div className="pb-action-text">{p.action}</div>
                      <span className="pb-tag">ข้อความพร้อมส่ง</span>
                      <div className="msg-bubble">{p.message}</div>
                      <AiCopy audience={p.segment} signal={p.trigger} offer={p.offer} kind="bulk" />
                      <div className="pb-grid">
                        <div><span className="pb-k">ข้อเสนอ</span>{p.offer}</div>
                        <div><span className="pb-k">ช่องทาง</span>{p.channel}</div>
                        <div><span className="pb-k">จังหวะ</span>{p.timing}</div>
                        <div><span className="pb-k">โอกาส</span>฿{NUM(p.count * p.perCustomer)} · {NUM(p.count)} × ฿{NUM(p.perCustomer)}</div>
                      </div>
                      <div className="pb-actions">
                        <button className="btn">ยิงหา {NUM(p.count)} คน</button>
                        <button className="btn btn-ghost">บันทึกเป็นแคมเปญ</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pb-foot">
            ถ้าไม่มีข้อมูล ก็มองไม่เห็น pattern พวกนี้ · ถ้าไม่มีการตีความเชิงครีเอทีฟ ข้อมูลก็เป็นแค่ตัวเลข —{" "}
            <strong>รวมกันถึงเปลี่ยนลูกค้า {NUM(uniqueReach)} คนเป็นรายได้เดือนนี้</strong>
          </div>
        </>
      ) : (
        <>
          <div className="pb-summary">
            <div className="pb-sum-item"><div className="pb-sum-num">{personal.length}</div><div className="pb-sum-label">ลูกค้าที่ต้องดูแลรายคน</div></div>
            <div className="pb-sum-item"><div className="pb-sum-num warn">{urgent}</div><div className="pb-sum-label">ด่วน — ทำวันนี้</div></div>
            <div className="pb-sum-item"><div className="pb-sum-num">{wonCount}</div><div className="pb-sum-label">ปิดได้แล้ว</div></div>
            <div className="pb-sum-item"><div className="pb-sum-num accent">฿{NUM(recoveredTotal)}</div><div className="pb-sum-label">รายได้ที่กู้กลับ (จาก ฿{NUM(personalValue)} โอกาส)</div></div>
          </div>

          <div className="pb-list">
            {personalSorted.map((p) => {
              const isOpen = openP === p.id;
              const initials = p.name.replace(/^คุณ/, "").trim().slice(0, 2);
              const firstName = p.name.replace(/^คุณ/, "").split(" ")[0];
              return (
                <div className={`pp-card${isOpen ? " open" : ""}`} key={p.id} style={{ borderLeftColor: PRIORITY_COLOR[p.priority] }}>
                  <button className="pb-cardhead" onClick={() => setOpenP(isOpen ? null : p.id)}>
                    <div className="pp-head">
                      <span className="pp-avatar" style={{ background: p.color }}>{initials}</span>
                      <div className="pp-id">
                        <div className="pp-nameline">
                          <span className="pb-name">{p.name}</span>
                          <span className={`badge tier-${p.tier}`}>{p.tier}</span>
                          <span className="pp-priority" style={{ background: PRIORITY_COLOR[p.priority] }}>{PRIORITY_LABEL[p.priority]}</span>
                          {p.status !== "pending" && (
                            <span className={`task-pill task-${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                          )}
                        </div>
                        <div className="pb-trigger">{p.signal}</div>
                      </div>
                      <span className="pp-value">฿{NUM(p.value)}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="pb-detail">
                      <div className="pp-stats">
                        <div className="pp-chip"><span>CLV คาดการณ์</span>฿{NUM(p.clv)}</div>
                        <div className="pp-chip"><span>เสี่ยงหลุด</span>{p.churn}%</div>
                        <div className="pp-chip"><span>เข้าล่าสุด</span>{p.lastSeen}</div>
                        <div className="pp-chip"><span>ยอดซื้อสะสม</span>฿{NUM(p.spend)}</div>
                      </div>
                      <span className="pb-tag">แผน — {p.playName}</span>
                      <div className="pb-action-text">{p.action}</div>
                      <span className="pb-tag">ข้อความถึงลูกค้า</span>
                      <div className="msg-bubble">{p.message}</div>
                      <AiCopy audience={p.name} signal={p.signal} offer={p.offer} kind="personal" />
                      <div className="pb-grid">
                        <div><span className="pb-k">ข้อเสนอ</span>{p.offer}</div>
                        <div><span className="pb-k">มอบหมาย</span>{p.assignedTo}</div>
                        <div><span className="pb-k">โอกาส</span>฿{NUM(p.value)}</div>
                        <div><span className="pb-k">ความสำคัญ</span>{PRIORITY_LABEL[p.priority]}</div>
                      </div>
                      <div className="pb-actions">
                        <button className="btn">ทักหา {firstName}</button>
                        <button className="btn btn-ghost">มอบหมายพนักงาน</button>
                      </div>

                      <span className="pb-tag">สถานะงาน</span>
                      <div className="task-row">
                        <span className={`task-pill task-${STATUS_CLASS[p.status]}`}>
                          {STATUS_LABEL[p.status]}
                          {p.status === "won" ? ` · กู้กลับ ฿${NUM(p.recovered)}` : ""}
                        </span>
                        <div className="task-btns">
                          {(p.status === "pending") && (
                            <button className="task-btn" disabled={busy === p.id} onClick={() => setStatus(p.id, "contacted")}>ติดต่อแล้ว</button>
                          )}
                          {(p.status === "pending" || p.status === "contacted") && (
                            <>
                              <button className="task-btn won" disabled={busy === p.id} onClick={() => setStatus(p.id, "won", p.value)}>ปิดได้ (฿{NUM(p.value)})</button>
                              <button className="task-btn lost" disabled={busy === p.id} onClick={() => setStatus(p.id, "lost")}>ไม่สำเร็จ</button>
                            </>
                          )}
                          {(p.status === "won" || p.status === "lost") && (
                            <button className="task-btn" disabled={busy === p.id} onClick={() => setStatus(p.id, "pending")}>รีเซ็ต</button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pb-foot">
            ลูกค้าเหล่านี้สเปรดชีตไม่มีทางเจอทัน — <strong>ระบบส่งลิสต์รายชื่อจัดอันดับให้ทีมทุกเช้า มูลค่าสูงและเสี่ยงสูงมาก่อน</strong>
          </div>
        </>
      )}
    </>
  );
}
