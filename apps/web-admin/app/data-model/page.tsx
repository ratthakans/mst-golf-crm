interface Table {
  name: string;
  tag: string;
  desc: string;
  columns: Array<{ name: string; type: string; note?: string }>;
}

const TABLES: Table[] = [
  {
    name: "Organization",
    tag: "รากของ tenant",
    desc: "องค์กร (MST Golf) — พฤติกรรมปรับผ่าน settings JSONB ไม่ต้องแก้โค้ด",
    columns: [
      { name: "id", type: "cuid", note: "PK" },
      { name: "slug", type: "string", note: "unique" },
      { name: "plan", type: "enum", note: "STARTER/GROWTH/PRO" },
      { name: "settings", type: "jsonb", note: "แต้ม ระดับ ฟีเจอร์ ข้อความ crm" },
    ],
  },
  {
    name: "Member",
    tag: "ลูกค้า",
    desc: "ลูกค้า 1 คน — โปรไฟล์กอล์ฟเก็บใน attributes JSONB (ไม่มีคอลัมน์ตายตัว)",
    columns: [
      { name: "id", type: "cuid", note: "PK" },
      { name: "orgId", type: "cuid", note: "→ Organization" },
      { name: "lineUserId", type: "string", note: "unique ต่อ org" },
      { name: "attributes", type: "jsonb", note: "แฮนดิแคป แบรนด์ ความสนใจ…" },
      { name: "points", type: "int", note: "แคชของ ledger" },
      { name: "tier", type: "string" },
      { name: "consentAt", type: "datetime", note: "ธงย่อ PDPA" },
    ],
  },
  {
    name: "Event",
    tag: "บันทึกพฤติกรรม",
    desc: "ทุกพฤติกรรม — RFM กรวย churn cohort คำนวณจากตรงนี้ทั้งหมด",
    columns: [
      { name: "id", type: "cuid", note: "PK" },
      { name: "orgId", type: "cuid", note: "→ Organization" },
      { name: "memberId", type: "cuid", note: "→ Member" },
      { name: "type", type: "enum", note: "REGISTER, PURCHASE, VISIT…" },
      { name: "payload", type: "jsonb", note: "PURCHASE = {amount, currency, items}" },
      { name: "occurredAt", type: "datetime" },
    ],
  },
  {
    name: "PointTransaction",
    tag: "บัญชีแต้ม",
    desc: "แหล่งความจริงของแต้ม — Member.points เป็นแค่แคชของตารางนี้",
    columns: [
      { name: "id", type: "cuid", note: "PK" },
      { name: "orgId", type: "cuid", note: "→ Organization" },
      { name: "memberId", type: "cuid", note: "→ Member" },
      { name: "delta", type: "int", note: "+/- แต้ม" },
      { name: "reason", type: "string", note: "signup_bonus, purchase…" },
    ],
  },
  {
    name: "FieldDefinition",
    tag: "config",
    desc: "ขับฟอร์มสมัครแบบ dynamic — เพิ่มฟิลด์ได้โดยไม่ต้องแก้โค้ด",
    columns: [
      { name: "orgId", type: "cuid", note: "→ Organization" },
      { name: "key", type: "string", note: "คีย์ใน attributes" },
      { name: "type", type: "enum", note: "TEXT/NUMBER/SELECT/MULTISELECT…" },
      { name: "required", type: "bool" },
      { name: "options", type: "jsonb" },
    ],
  },
  {
    name: "Consent",
    tag: "PDPA",
    desc: "ประวัติความยินยอมแบบมีเวอร์ชัน — ตรวจสอบย้อนหลังและสิทธิ์ขอลบข้อมูล",
    columns: [
      { name: "orgId", type: "cuid", note: "→ Organization" },
      { name: "memberId", type: "cuid", note: "→ Member" },
      { name: "purpose", type: "string" },
      { name: "version", type: "string" },
      { name: "textSnapshot", type: "string", note: "ข้อความที่แสดง" },
    ],
  },
  {
    name: "LineChannel",
    tag: "ความลับ",
    desc: "credential LINE ต่อ org เข้ารหัส AES-256-GCM ตอนเก็บ",
    columns: [
      { name: "orgId", type: "cuid", note: "→ Organization" },
      { name: "channelSecretEnc", type: "string", note: "เข้ารหัส" },
      { name: "channelAccessTokenEnc", type: "string", note: "เข้ารหัส" },
    ],
  },
  {
    name: "User",
    tag: "พนักงาน",
    desc: "บัญชีล็อกอิน dashboard (OWNER/ADMIN/STAFF)",
    columns: [
      { name: "orgId", type: "cuid", note: "→ Organization" },
      { name: "email", type: "string", note: "unique ต่อ org" },
      { name: "role", type: "enum" },
    ],
  },
];

const PRINCIPLES = [
  { icon: "📝", title: "Event-driven", body: "ทุกพฤติกรรมเขียนเป็น Event — วิเคราะห์ทั้งหมดต่อยอดจากตรงนี้ ไม่ต้องย้อนเติมข้อมูลทีหลัง" },
  { icon: "🏢", title: "Multi-tenant", body: "ทุกตารางมี orgId ทุก query ผ่าน forOrg(orgId) ข้อมูลข้ามองค์กรไม่หลุดหากัน" },
  { icon: "🧩", title: "Config-driven", body: "ความต่างของแต่ละองค์กรอยู่ใน settings และ FieldDefinition JSONB — รับลูกค้าใหม่ = ตั้งค่า ไม่ใช่ fork โค้ด" },
  { icon: "📒", title: "บัญชีแต้ม", body: "PointTransaction คือแหล่งความจริง Member.points เป็นแคชที่ sync ตลอด" },
  { icon: "🔒", title: "พร้อม PDPA", body: "ประวัติ Consent มีเวอร์ชัน + ความลับเข้ารหัส (LineChannel) ตั้งแต่วันแรก" },
];

export default function DataModelPage() {
  return (
    <>
      <div className="page-head">
        <h1>โครงสร้างข้อมูล</h1>
        <p>ดีไซน์ฐานข้อมูล — event-driven, multi-tenant และ config-driven เพื่อให้ข้อมูลนำไปใช้ต่อได้จริง</p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        {PRINCIPLES.map((p) => (
          <div className="card principle" key={p.title}>
            <div className="p-icon">{p.icon}</div>
            <strong>{p.title}</strong>
            <p>{p.body}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-2">
        {TABLES.map((t) => (
          <div className="card table-card" key={t.name}>
            <div className="table-head">
              <span className="table-name">{t.name}</span>
              <span className="table-tag">{t.tag}</span>
            </div>
            <p className="table-desc">{t.desc}</p>
            <div className="cols">
              {t.columns.map((c) => (
                <div className="col-row" key={c.name}>
                  <code className="col-name">{c.name}</code>
                  <span className="col-type">{c.type}</span>
                  {c.note && <span className="col-note">{c.note}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
