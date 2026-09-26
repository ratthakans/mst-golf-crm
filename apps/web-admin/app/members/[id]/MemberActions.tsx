"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorText } from "../../ui/api";
import { formatPhone, num } from "../../ui/format";
import { Modal } from "../../ui/Modal";

interface MemberBrief {
  id: string;
  code: string;
  displayName: string;
  phone: string | null;
  birthday: string | null;
  email: string | null;
  points: number;
}

type Dialog = "edit" | "points" | "merge" | "erase" | "request" | null;
const LIMIT: Record<string, number | null> = { SUPER_ADMIN: null, STORE_MANAGER: 1000, CUSTOMER_SERVICE: 1000 };

export function MemberActions({
  member,
  can,
  role,
}: {
  member: MemberBrief;
  can: { edit: boolean; adjust: boolean; merge: boolean; erase: boolean; request: boolean; book: boolean };
  role: string;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  return (
    <div className="actions-bar">
      {can.edit && <button className="btn btn-ghost btn-sm" onClick={() => setDialog("edit")}>แก้ไขข้อมูล</button>}
      {can.adjust && <button className="btn btn-ghost btn-sm" onClick={() => setDialog("points")}>ปรับแต้ม</button>}
      {can.book && <a className="btn btn-ghost btn-sm" href={`/simulator?member=${member.id}`}>จองซิมให้</a>}
      {can.merge && <button className="btn btn-ghost btn-sm" onClick={() => setDialog("merge")}>รวมบัญชีซ้ำ</button>}
      {can.request && <button className="btn btn-ghost btn-sm" onClick={() => setDialog("request")}>ขอรวมบัญชี / ขอลบข้อมูล</button>}
      {can.erase && <button className="btn btn-ghost btn-sm danger-text" onClick={() => setDialog("erase")}>ลบข้อมูล (PDPA)</button>}
      {dialog === "edit" && <EditDialog member={member} onClose={close} />}
      {dialog === "points" && <PointsDialog member={member} limit={LIMIT[role] ?? null} onClose={close} />}
      {dialog === "merge" && <MergeDialog member={member} onClose={close} />}
      {dialog === "erase" && <EraseDialog member={member} onClose={close} />}
      {dialog === "request" && <RequestDialog member={member} onClose={close} />}
    </div>
  );
}

function useSubmit(onDone: () => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone();
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function EditDialog({ member, onClose }: { member: MemberBrief; onClose: () => void }) {
  const [f, setF] = useState({ fullName: member.displayName, phone: member.phone ?? "", birthday: member.birthday ?? "", email: member.email ?? "" });
  const { busy, error, run } = useSubmit(onClose);
  return (
    <Modal title="แก้ไขข้อมูลสมาชิก" sub={member.code} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); void run(() => api(`/api/members/${member.id}`, { method: "PATCH", body: f })); }}>
        <label className="field"><span>ชื่อ-นามสกุล</span><input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} required /></label>
        <label className="field">
          <span>เบอร์มือถือ <span className="hint">— เปลี่ยนแล้วถือว่ายืนยันที่ร้าน</span></span>
          <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" required />
        </label>
        <div className="form-grid">
          <label className="field"><span>วันเกิด</span><input type="date" value={f.birthday} onChange={(e) => setF({ ...f, birthday: e.target.value })} /></label>
          <label className="field"><span>อีเมล</span><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="btn-row">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
        </div>
      </form>
    </Modal>
  );
}

function PointsDialog({ member, limit, onClose }: { member: MemberBrief; limit: number | null; onClose: () => void }) {
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const { busy, error, run } = useSubmit(onClose);
  const delta = sign * Math.trunc(Number(amount) || 0);
  return (
    <Modal title="ปรับแต้ม" sub={`${member.displayName} · คงเหลือ ${num(member.points)} แต้ม${limit ? ` · ตำแหน่งนี้ปรับได้ครั้งละไม่เกิน ±${num(limit)}` : ""}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); void run(() => api(`/api/members/${member.id}/points`, { body: { delta, note } })); }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <button type="button" className={`chip${sign === 1 ? " chip-on" : ""}`} onClick={() => setSign(1)}>+ เพิ่มแต้ม</button>
          <button type="button" className={`chip${sign === -1 ? " chip-on" : ""}`} onClick={() => setSign(-1)}>− หักแต้ม</button>
        </div>
        <label className="field"><span>จำนวนแต้ม</span><input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} required /></label>
        <label className="field"><span>เหตุผล <b>*</b> <span className="hint">— ลูกค้าเห็นในประวัติแต้ม</span></span><input value={note} onChange={(e) => setNote(e.target.value)} required maxLength={140} /></label>
        {delta !== 0 && <p className="muted small">หลังปรับ: {num(member.points + delta)} แต้ม</p>}
        {error && <p className="form-error">{error}</p>}
        <div className="btn-row">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn" disabled={busy || !delta}>{busy ? "กำลังบันทึก…" : "ยืนยันปรับแต้ม"}</button>
        </div>
      </form>
    </Modal>
  );
}

interface Hit { id: string; code: string; name: string; phone: string | null; points: number; hasLine: boolean }

function MergeDialog({ member, onClose }: { member: MemberBrief; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [other, setOther] = useState<Hit | null>(null);
  const [keep, setKeep] = useState<"this" | "other">("this");
  const [reason, setReason] = useState("");
  const { busy, error, run } = useSubmit(onClose);
  const router = useRouter();

  useEffect(() => {
    if (q.trim().length < 2) return setHits([]);
    const t = setTimeout(() => {
      api<{ rows: Hit[] }>(`/api/members/search?q=${encodeURIComponent(q.trim())}`).then((d) => setHits(d.rows.filter((r) => r.id !== member.id))).catch(() => setHits([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q, member.id]);

  return (
    <Modal title="รวมบัญชีซ้ำ" sub="ย้ายบิล แต้ม การจอง และตัวตนมารวมที่บัญชีเดียว — ย้อนกลับไม่ได้" onClose={onClose} wide>
      <label className="field"><span>ค้นหาอีกบัญชี (ชื่อ เบอร์ หรือรหัส)</span><input value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></label>
      <div className="picker-list">
        {hits.map((h) => (
          <button key={h.id} type="button" className={`picker-item${other?.id === h.id ? " on" : ""}`} onClick={() => setOther(h)}>
            <span><b>{h.name}</b> <span className="muted mono small">{h.code} · {formatPhone(h.phone)}{h.hasLine ? " · LINE" : ""}</span></span>
            <span className="mono small">{num(h.points)} แต้ม</span>
          </button>
        ))}
      </div>
      {other && (
        <>
          <p className="small" style={{ margin: "10px 0 6px" }}><b>เก็บบัญชีไหนไว้?</b> (อีกบัญชีจะถูกปิด)</p>
          <div className="row">
            <button type="button" className={`chip${keep === "this" ? " chip-on" : ""}`} onClick={() => setKeep("this")}>{member.displayName} · {member.code}</button>
            <button type="button" className={`chip${keep === "other" ? " chip-on" : ""}`} onClick={() => setKeep("other")}>{other.name} · {other.code}</button>
          </div>
          <label className="field" style={{ marginTop: 12 }}><span>เหตุผล <b>*</b></span><input value={reason} onChange={(e) => setReason(e.target.value)} required /></label>
          <p className="muted small">แต้มต้อนรับที่ได้ซ้ำจะไม่ถูกนับรวม · ถ้าทั้งสองบัญชีผูก LINE คนละบัญชี รวมไม่ได้</p>
        </>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
        <button
          type="button"
          className="btn"
          disabled={busy || !other || !reason.trim()}
          onClick={() =>
            run(async () => {
              const r = await api<{ member: { id: string } }>(`/api/members/${member.id}/merge`, { body: { otherId: other!.id, keep, reason } });
              if (r.member.id !== member.id) router.push(`/members/${r.member.id}`);
            })
          }
        >
          {busy ? "กำลังรวม…" : "รวมบัญชี"}
        </button>
      </div>
    </Modal>
  );
}

function EraseDialog({ member, onClose }: { member: MemberBrief; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const { busy, error, run } = useSubmit(onClose);
  return (
    <Modal title="ลบข้อมูลส่วนบุคคล (PDPA)" sub={`${member.displayName} · ${member.code}`} onClose={onClose}>
      <p className="small" style={{ lineHeight: 1.6 }}>
        ลบชื่อ เบอร์ LINE วันเกิด อีเมล และรูป · ยกเลิกการจองที่ยังไม่ถึงเวลา · บิลยังเก็บไว้เพื่อบัญชีแต่ไม่ผูกกับตัวบุคคล · <b>ย้อนกลับไม่ได้</b>
      </p>
      <label className="field"><span>เหตุผล / อ้างอิงคำขอ <b>*</b></span><input value={reason} onChange={(e) => setReason(e.target.value)} required /></label>
      <label className="field"><span>พิมพ์ <b>ลบข้อมูล</b> เพื่อยืนยัน</span><input value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
      {error && <p className="form-error">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
        <button type="button" className="btn btn-danger" disabled={busy || confirm !== "ลบข้อมูล" || !reason.trim()} onClick={() => run(() => api(`/api/members/${member.id}/erase`, { body: { reason, confirm } }))}>
          {busy ? "กำลังลบ…" : "ลบข้อมูลถาวร"}
        </button>
      </div>
    </Modal>
  );
}

function RequestDialog({ member, onClose }: { member: MemberBrief; onClose: () => void }) {
  const [kind, setKind] = useState<"MERGE_REQUEST" | "ERASE_REQUEST">("MERGE_REQUEST");
  const [otherCode, setOtherCode] = useState("");
  const [note, setNote] = useState("");
  const { busy, error, run } = useSubmit(onClose);
  return (
    <Modal title="ส่งคำขอให้ผู้ดูแลระบบ" sub={`${member.displayName} · ${member.code}`} onClose={onClose}>
      <div className="row" style={{ marginBottom: 12 }}>
        <button type="button" className={`chip${kind === "MERGE_REQUEST" ? " chip-on" : ""}`} onClick={() => setKind("MERGE_REQUEST")}>ขอรวมบัญชีซ้ำ</button>
        <button type="button" className={`chip${kind === "ERASE_REQUEST" ? " chip-on" : ""}`} onClick={() => setKind("ERASE_REQUEST")}>ลูกค้าขอลบข้อมูล</button>
      </div>
      {kind === "MERGE_REQUEST" && (
        <label className="field"><span>รหัสสมาชิกอีกบัญชี</span><input value={otherCode} onChange={(e) => setOtherCode(e.target.value.toUpperCase())} placeholder="MST00000000" /></label>
      )}
      <label className="field"><span>รายละเอียด <b>*</b></span><textarea value={note} onChange={(e) => setNote(e.target.value)} required /></label>
      {error && <p className="form-error">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
        <button type="button" className="btn" disabled={busy || !note.trim()} onClick={() => run(() => api("/api/reviews", { body: { kind, memberId: member.id, otherCode, note } }))}>
          {busy ? "กำลังส่ง…" : "ส่งคำขอ"}
        </button>
      </div>
    </Modal>
  );
}
