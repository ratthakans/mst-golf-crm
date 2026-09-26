"use client";

import { useState } from "react";
import { SaveBar, useSave } from "../useSave";

export function LineForm({ status }: { status: { channelId: string; liffId: string; loginChannelId: string } | null }) {
  const [f, setF] = useState({ channelId: status?.channelId ?? "", channelSecret: "", accessToken: "", liffId: status?.liffId ?? "", loginChannelId: status?.loginChannelId ?? "" });
  const s = useSave("line");
  return (
    <form className="card" onSubmit={async (e) => { e.preventDefault(); if (await s.save(f)) setF({ ...f, channelSecret: "", accessToken: "" }); }} autoComplete="off">
      <h3>{status ? "แก้ไขการเชื่อม LINE" : "เชื่อม LINE"}</h3>
      <div className="form-grid">
        <label className="field"><span>Messaging API · Channel ID</span><input value={f.channelId} onChange={(e) => setF({ ...f, channelId: e.target.value.trim() })} inputMode="numeric" required /></label>
        <label className="field"><span>Channel secret {status && <span className="hint">— เว้นว่าง = ใช้ค่าเดิม</span>}</span><input type="password" value={f.channelSecret} onChange={(e) => setF({ ...f, channelSecret: e.target.value })} autoComplete="new-password" /></label>
        <label className="field" style={{ gridColumn: "1 / -1" }}><span>Channel access token (long-lived) {status && <span className="hint">— เว้นว่าง = ใช้ค่าเดิม</span>}</span><input type="password" value={f.accessToken} onChange={(e) => setF({ ...f, accessToken: e.target.value })} autoComplete="new-password" /></label>
        <label className="field"><span>LINE Login · Channel ID</span><input value={f.loginChannelId} onChange={(e) => setF({ ...f, loginChannelId: e.target.value.trim() })} inputMode="numeric" /></label>
        <label className="field"><span>LIFF ID</span><input value={f.liffId} onChange={(e) => setF({ ...f, liffId: e.target.value.trim() })} placeholder="2000000000-AbCdEfGh" /></label>
      </div>
      <p className="muted small">secret และ token เก็บแบบเข้ารหัส และไม่แสดงกลับมาที่หน้านี้อีก</p>
      <SaveBar {...s} />
    </form>
  );
}
