"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "../../../lib/permissions";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

type Issued = { email: string; password: string };

export function UsersAdmin({
  rows,
  meId,
  roles,
}: {
  rows: UserRow[];
  meId: string;
  roles: Array<{ value: Role; label: string }>;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("STORE_STAFF");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const label = (r: Role) => roles.find((x) => x.value === r)?.label ?? r;

  async function call(key: string, url: string, init: RequestInit): Promise<Record<string, unknown> | null> {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "ทำรายการไม่สำเร็จ");
        return null;
      }
      router.refresh();
      return data;
    } finally {
      setBusy(null);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const data = await call("create", "/api/admin/users", { method: "POST", body: JSON.stringify({ email, name, role }) });
    if (data?.tempPassword) {
      setIssued({ email: email.trim().toLowerCase(), password: String(data.tempPassword) });
      setEmail("");
      setName("");
    }
  }

  const patch = (u: UserRow, body: object) =>
    call(u.id, `/api/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify(body) });

  async function reset(u: UserRow) {
    if (!confirm(`ตั้งรหัสผ่านชั่วคราวใหม่ให้ ${u.email}? รหัสเดิมจะใช้ไม่ได้ทันที`)) return;
    const data = await patch(u, { action: "reset_password" });
    if (data?.tempPassword) setIssued({ email: u.email, password: String(data.tempPassword) });
  }

  return (
    <>
      {error && <div className="form-error" role="alert">{error}</div>}

      {issued && (
        <div className="card issued-card" role="status">
          <strong>รหัสผ่านชั่วคราวของ {issued.email}</strong>
          <div className="issued-row">
            <code>{issued.password}</code>
            <button type="button" className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(issued.password)}>คัดลอก</button>
            <button type="button" className="btn btn-ghost" onClick={() => setIssued(null)}>ปิด</button>
          </div>
          <p>แสดงครั้งเดียวเท่านั้น — ส่งให้พนักงานทางช่องทางส่วนตัว พนักงานจะต้องตั้งรหัสใหม่ตอนเข้าครั้งแรก</p>
        </div>
      )}

      <form className="card user-create" onSubmit={create}>
        <h3>เพิ่มผู้ใช้</h3>
        <div className="user-create-row">
          <label className="field">
            <span>อีเมล</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@mstgolf.com" />
          </label>
          <label className="field">
            <span>ชื่อ</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อที่แสดงในระบบ" />
          </label>
          <label className="field">
            <span>สิทธิ์</span>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <button className="btn" type="submit" disabled={busy === "create"}>
            {busy === "create" ? "กำลังสร้าง…" : "สร้างบัญชี"}
          </button>
        </div>
      </form>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>ผู้ใช้</th><th>สิทธิ์</th><th>สถานะ</th><th>เข้าล่าสุด</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const me = u.id === meId;
                return (
                  <tr key={u.id} className={u.isActive ? undefined : "row-muted"}>
                    <td>
                      <div className="member-name">{u.name || u.email}{me && <span className="you-tag">คุณ</span>}</div>
                      <div className="user-email">{u.email}</div>
                    </td>
                    <td>
                      <select
                        className="role-select"
                        value={u.role}
                        disabled={me || busy === u.id}
                        onChange={(e) => patch(u, { action: "role", role: e.target.value })}
                        aria-label={`สิทธิ์ของ ${u.email}`}
                      >
                        {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </td>
                    <td>
                      {!u.isActive ? <span className="status-pill off">ปิดใช้งาน</span>
                        : u.mustChangePassword ? <span className="status-pill warn">รอตั้งรหัส</span>
                          : <span className="status-pill on">ใช้งาน</span>}
                    </td>
                    <td className="mono">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-GB") : "—"}</td>
                    <td className="user-actions">
                      <button type="button" className="link-btn" disabled={busy === u.id} onClick={() => reset(u)}>ตั้งรหัสชั่วคราว</button>
                      {!me && (
                        <button
                          type="button"
                          className="link-btn"
                          disabled={busy === u.id}
                          onClick={() => patch(u, { action: u.isActive ? "deactivate" : "activate" })}
                        >
                          {u.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="users-foot">สิทธิ์: {roles.map((r) => label(r.value)).join(" · ")} — รายละเอียดสิทธิ์แต่ละระดับอยู่ใน MST-DEV-PLAN §10</p>
    </>
  );
}
