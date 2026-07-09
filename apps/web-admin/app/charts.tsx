// Tiny hand-rolled SVG charts — no external dependency, server-renderable.

export function MiniLine({
  data,
  width = 180,
  height = 34,
  color = "var(--brand)",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const pts = data.map((v, i) => {
    const x = i * step;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.map((v, i) => {
        const x = i * step;
        const y = height - (v / max) * (height - 4) - 2;
        return <circle key={i} cx={x} cy={y} r={2} fill={color} />;
      })}
    </svg>
  );
}

export function BarChart({
  data,
  height = 160,
  color = "var(--brand)",
  format = (n: number) => String(Math.round(n)),
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  color?: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars" style={{ height }}>
      {data.map((d) => (
        <div className="bar-col" key={d.label}>
          <div className="bar-val">{d.value > 0 ? format(d.value) : ""}</div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ height: `${(d.value / max) * 100}%`, background: color }}
            />
          </div>
          <div className="bar-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// Retention heatmap cell colour (0..1 → light→brand green).
export function heatColor(v: number | null): string {
  if (v === null) return "transparent";
  const light = 0.92 - v * 0.55; // higher retention = darker
  return `hsl(152 45% ${Math.round(light * 100)}%)`;
}

// ── Donut ─────────────────────────────────────────────────────────────────
export function Donut({
  data,
  size = 168,
  thickness = 22,
  centerLabel,
  centerSub,
}: {
  data: Array<{ label: string; value: number; color: string }>;
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = Math.max(1, data.reduce((s, d) => s + d.value, 0));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut">
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--line)" strokeWidth={thickness} />
          {data.map((d) => {
            const frac = d.value / total;
            const dash = frac * c;
            const seg = (
              <circle
                key={d.label}
                cx={cx}
                cy={cx}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return seg;
          })}
        </g>
        {centerLabel && (
          <text x={cx} y={cx - 2} textAnchor="middle" className="donut-center">{centerLabel}</text>
        )}
        {centerSub && (
          <text x={cx} y={cx + 16} textAnchor="middle" className="donut-sub">{centerSub}</text>
        )}
      </svg>
    </div>
  );
}

// ── Area chart (gradient fill) ──────────────────────────────────────────────
export function AreaChart({
  data,
  width = 520,
  height = 180,
  color = "var(--brand)",
  labels,
  format = (n: number) => String(Math.round(n)),
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  labels?: string[];
  format?: (n: number) => string;
}) {
  if (data.length === 0) return null;
  const pad = { t: 14, r: 10, b: 22, l: 10 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const xy = data.map((v, i) => {
    const x = pad.l + i * step;
    const y = pad.t + h - (v / max) * h;
    return [x, y] as const;
  });
  const line = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${xy[xy.length - 1]![0].toFixed(1)},${(pad.t + h).toFixed(1)} L${xy[0]![0].toFixed(1)},${(pad.t + h).toFixed(1)} Z`;
  const gid = `area-grad-${Math.round(width)}-${data.length}`;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="area-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {xy.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={3} fill="var(--card)" stroke={color} strokeWidth={2} />
          {labels?.[i] && (
            <text x={x} y={height - 6} textAnchor="middle" className="area-label">{labels[i]}</text>
          )}
        </g>
      ))}
      {format && (
        <text x={pad.l} y={pad.t - 2} className="area-max">{format(max)}</text>
      )}
    </svg>
  );
}

// ── Survival / retention curve (0..1 over days) ─────────────────────────────
export function CurveChart({
  points,
  width = 520,
  height = 180,
  color = "var(--brand)",
  markerDay,
}: {
  points: Array<{ day: number; survival: number }>;
  width?: number;
  height?: number;
  color?: string;
  markerDay?: number | null;
}) {
  if (points.length === 0) return null;
  const pad = { t: 12, r: 12, b: 22, l: 30 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const maxDay = points[points.length - 1]!.day || 1;
  const xOf = (d: number) => pad.l + (d / maxDay) * w;
  const yOf = (s: number) => pad.t + h - s * h;
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.day).toFixed(1)},${yOf(p.survival).toFixed(1)}`).join(" ");
  const area = `${line} L${xOf(maxDay).toFixed(1)},${(pad.t + h).toFixed(1)} L${xOf(0).toFixed(1)},${(pad.t + h).toFixed(1)} Z`;
  const gid = `curve-grad-${width}`;
  const gridY = [0, 0.25, 0.5, 0.75, 1];
  const markerX = markerDay != null ? xOf(markerDay) : null;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="curve-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {gridY.map((g) => (
        <g key={g}>
          <line x1={pad.l} y1={yOf(g)} x2={width - pad.r} y2={yOf(g)} stroke="var(--line)" strokeWidth={1} strokeDasharray="3 4" />
          <text x={4} y={yOf(g) + 3} className="curve-axis">{Math.round(g * 100)}%</text>
        </g>
      ))}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      {markerX != null && (
        <g>
          <line x1={markerX} y1={pad.t} x2={markerX} y2={pad.t + h} stroke="var(--warn)" strokeWidth={1.5} strokeDasharray="4 3" />
          <circle cx={markerX} cy={yOf(0.5)} r={4} fill="var(--warn)" />
        </g>
      )}
      {[0, Math.round(maxDay / 2), maxDay].map((d) => (
        <text key={d} x={xOf(d)} y={height - 6} textAnchor="middle" className="curve-axis">{d}วัน</text>
      ))}
    </svg>
  );
}

// ── Trend arrow (month-over-month) ──────────────────────────────────────────
export function Trend({ delta, suffix = "" }: { delta: number; suffix?: string }) {
  if (!isFinite(delta) || Math.round(delta * 100) === 0) {
    return <span className="trend flat">— 0%</span>;
  }
  const up = delta > 0;
  const pct = Math.abs(Math.round(delta * 100));
  return (
    <span className={`trend ${up ? "up" : "down"}`}>
      {up ? "▲" : "▼"} {pct}%{suffix}
    </span>
  );
}
