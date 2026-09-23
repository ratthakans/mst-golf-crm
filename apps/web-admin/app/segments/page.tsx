import { allowPage } from "../../lib/auth";
import { getCrmData } from "../../lib/data";
import { Forbidden } from "../Forbidden";
import { SEGMENT_ORDER, SEGMENT_COLOR, SEGMENT_HINT, SEGMENT_LABEL } from "../../lib/segments";

export const dynamic = "force-dynamic";

export default async function SegmentsPage() {
  if (!(await allowPage("segments.view"))) return <Forbidden />;
  const { rfm } = await getCrmData();

  return (
    <>
      <div className="page-head">
        <h1>กลุ่มลูกค้า</h1>
        <p>กลุ่มที่แบ่งด้วย RFM — ยิงแคมเปญต่างกันได้ตามแต่ละกลุ่ม</p>
      </div>

      <div className="grid grid-2">
        {SEGMENT_ORDER.map((seg) => {
          const members = rfm.filter((r) => r.segment === seg);
          if (members.length === 0) return null;
          return (
            <div className="card" key={seg}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span className="dot" style={{ background: SEGMENT_COLOR[seg] }} />
                <strong style={{ fontSize: 16 }}>{SEGMENT_LABEL[seg]}</strong>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>
                  · {members.length} คน
                </span>
              </div>
              <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: 13 }}>
                {SEGMENT_HINT[seg]}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {members.map((m) => (
                  <div
                    key={m.memberId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      padding: "8px 10px",
                      background: "var(--brand-tint)",
                      borderRadius: 8,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{m.displayName}</span>
                    <span className="mono" style={{ color: "var(--muted)" }}>
                      R{m.r} F{m.f} M{m.m}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
