// Evidence charts for the Playbook — the "relationship graph" that justifies a
// campaign. Pure SVG, server-renderable, no dependencies.

export interface Bubble {
  x: number; // 0 (active/recent) .. 1 (lapsed)
  y: number; // 0 (low value) .. 1 (high value)
  count: number;
  label: string;
  color: string;
}

// Portfolio "opportunity map": every segment plotted by engagement × value,
// sized by how many customers it holds. Shows the whole landscape at a glance.
export function BubbleMap({ bubbles }: { bubbles: Bubble[] }) {
  const W = 680, H = 340, padL = 54, padR = 24, padT = 20, padB = 46;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxCount = Math.max(...bubbles.map((b) => b.count));
  const rFor = (c: number) => 12 + (Math.sqrt(c) / Math.sqrt(maxCount)) * 34;
  const px = (x: number) => padL + x * plotW;
  const py = (y: number) => padT + (1 - y) * plotH;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" style={{ maxWidth: "100%" }}>
      {/* grid */}
      <rect x={padL} y={padT} width={plotW} height={plotH} fill="#f8faf9" rx={8} />
      <line x1={px(0.5)} y1={padT} x2={px(0.5)} y2={padT + plotH} stroke="#e2e8e4" strokeDasharray="4 4" />
      <line x1={padL} y1={py(0.5)} x2={padL + plotW} y2={py(0.5)} stroke="#e2e8e4" strokeDasharray="4 4" />

      {/* axis labels */}
      <text x={padL} y={H - 14} fontSize="11" fill="#6b7a72">← เพิ่งแอ็กทีฟ</text>
      <text x={padL + plotW} y={H - 14} fontSize="11" fill="#6b7a72" textAnchor="end">ห่างหาย →</text>
      <text x={16} y={padT + 10} fontSize="11" fill="#6b7a72" transform={`rotate(-90 16 ${padT + 10})`} textAnchor="end">มูลค่าสูง ↑</text>
      <text x={16} y={padT + plotH} fontSize="11" fill="#6b7a72" transform={`rotate(-90 16 ${padT + plotH})`}>มูลค่าต่ำ</text>

      {bubbles.map((b) => {
        const r = rFor(b.count);
        const cx = px(b.x), cy = py(b.y);
        return (
          <g key={b.label}>
            <circle cx={cx} cy={cy} r={r} fill={b.color} fillOpacity={0.22} stroke={b.color} strokeWidth={1.5} />
            <text x={cx} y={cy + 4} fontSize="13" fontWeight={700} fill={b.color} textAnchor="middle">{b.count}</text>
            <text x={cx} y={cy + r + 13} fontSize="11" fill="#17211c" textAnchor="middle">{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export interface EvBar {
  label: string;
  value: number;
  highlight?: boolean;
}

// Comparison / distribution bars (e.g. "68% cross-buy vs 32% don't").
export function MiniBars({
  data,
  unit = "",
  color = "var(--brand)",
  height = 130,
}: {
  data: EvBar[];
  unit?: string;
  color?: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="ev-bars" style={{ height }}>
      {data.map((d) => (
        <div className="ev-col" key={d.label}>
          <div className="ev-val">{d.value}{unit}</div>
          <div className="ev-track">
            <div
              className="ev-fill"
              style={{
                height: `${(d.value / max) * 100}%`,
                background: d.highlight ? color : "#d7e2db",
              }}
            />
          </div>
          <div className="ev-lab">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export interface EvPoint {
  label: string;
  value: number;
}

// Trend / survival curve with an optional "cliff" marker.
export function MiniCurve({
  data,
  color = "var(--brand)",
  unit = "",
  markerIndex,
  markerLabel,
  height = 140,
}: {
  data: EvPoint[];
  color?: string;
  unit?: string;
  markerIndex?: number;
  markerLabel?: string;
  height?: number;
}) {
  const W = 320, H = height, padT = 14, padB = 26, padX = 8;
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = data.length > 1 ? (W - padX * 2) / (data.length - 1) : 0;
  const xy = (i: number, v: number): [number, number] => [
    padX + i * step,
    padT + (1 - v / max) * (H - padT - padB),
  ];
  const line = data.map((d, i) => xy(i, d.value).join(",")).join(" ");
  const area = `${padX},${H - padB} ${line} ${padX + (data.length - 1) * step},${H - padB}`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 420 }}>
      <polygon points={area} fill={color} fillOpacity={0.1} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      {data.map((d, i) => {
        const [x, y] = xy(i, d.value);
        return (
          <g key={d.label}>
            <circle cx={x} cy={y} r={3} fill={color} />
            <text x={x} y={y - 8} fontSize="10" fill="#6b7a72" textAnchor="middle">{d.value}{unit}</text>
            <text x={x} y={H - 8} fontSize="10" fill="#6b7a72" textAnchor="middle">{d.label}</text>
          </g>
        );
      })}
      {markerIndex !== undefined && (
        <g>
          <line
            x1={padX + markerIndex * step} y1={padT - 4}
            x2={padX + markerIndex * step} y2={H - padB}
            stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 3"
          />
          {markerLabel && (
            <text x={padX + markerIndex * step} y={padT - 6} fontSize="10" fill="#ef4444" textAnchor="middle" fontWeight={700}>
              {markerLabel}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
