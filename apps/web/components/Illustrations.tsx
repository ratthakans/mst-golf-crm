// Hand-built SVG illustrations in brand colours. They stand in until MST's
// photography arrives and still read well afterwards as diagrams.

/** Simulator screen: fairway in perspective, distance boards and one ball flight. */
export function BallFlight() {
  const boards = [
    { y: 212, w: 64, label: "50" },
    { y: 176, w: 46, label: "100" },
    { y: 152, w: 34, label: "150" },
    { y: 136, w: 26, label: "200" },
  ];
  return (
    <svg className="ill-flight" viewBox="0 0 480 360" role="img" aria-label="ภาพประกอบ: วิถีลูกกอล์ฟบนจอ Golf Simulator">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b3d29" />
          <stop offset="1" stopColor="#0f5436" />
        </linearGradient>
        <linearGradient id="turf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d7a4b" />
          <stop offset="1" stopColor="#0e6a40" />
        </linearGradient>
      </defs>
      <rect width="480" height="360" rx="22" fill="url(#sky)" />
      {/* distant tree line */}
      <path d="M0 128 Q40 112 80 124 T160 118 T240 122 T320 114 T400 124 T480 116 V136 H0Z" fill="#0a4a30" />
      {/* fairway */}
      <path d="M0 136 H480 V360 H0Z" fill="url(#turf)" />
      <path d="M200 136 L280 136 L400 360 L80 360Z" fill="#2a8a57" opacity="0.55" />
      {[0.18, 0.36, 0.56, 0.78].map((t) => {
        const y = 136 + (360 - 136) * t;
        return <line key={t} x1="0" x2="480" y1={y} y2={y} stroke="#eaf4ee" strokeOpacity={0.08 + t * 0.06} />;
      })}
      <line x1="240" y1="136" x2="240" y2="360" stroke="#eaf4ee" strokeOpacity="0.18" strokeDasharray="4 8" />
      {/* distance boards */}
      {boards.map((b) => (
        <g key={b.label} transform={`translate(${372 - (212 - b.y) * 0.9} ${b.y - 18})`}>
          <rect width={b.w * 0.62} height={b.w * 0.34} rx="3" fill="#f4faf6" />
          <text
            x={(b.w * 0.62) / 2}
            y={b.w * 0.25}
            textAnchor="middle"
            fontSize={b.w * 0.2}
            fontWeight="700"
            fill="#0b3d29"
            fontFamily="Anuphan, sans-serif"
          >
            {b.label}
          </text>
        </g>
      ))}
      {/* pin */}
      <line x1="262" y1="118" x2="262" y2="140" stroke="#f4faf6" strokeWidth="1.5" />
      <path d="M262 118 l12 4 -12 4Z" fill="#efe6d2" />
      {/* ball flight */}
      <path className="ill-arc" d="M240 344 C 236 250, 250 96, 262 132" fill="none" stroke="#f4faf6" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 7" />
      <circle cx="240" cy="344" r="7" fill="#f4faf6" />
      <circle cx="262" cy="132" r="3.5" fill="#f4faf6" />
    </svg>
  );
}

/** Top-down plan of the simulator bays. */
export function LanePlan({ lanes }: { lanes: Array<{ id: string; name: string }> }) {
  const n = Math.max(1, lanes.length);
  const w = 420;
  const bay = w / n;
  return (
    <svg className="ill-plan" viewBox={`0 0 ${w} 300`} role="img" aria-label={`ผังห้อง Golf Simulator ${n} lane`}>
      <rect x="0.5" y="0.5" width={w - 1} height="299" rx="16" fill="none" stroke="#b9d4c4" strokeOpacity="0.35" />
      {lanes.map((l, i) => {
        const x = i * bay;
        return (
          <g key={l.id}>
            {i > 0 && <line x1={x} x2={x} y1="16" y2="284" stroke="#b9d4c4" strokeOpacity="0.35" />}
            {/* screen */}
            <rect x={x + 16} y="22" width={bay - 32} height="10" rx="3" fill="#f4faf6" />
            {/* hitting mat */}
            <rect x={x + bay / 2 - 26} y="190" width="52" height="64" rx="6" fill="#1d7a4b" stroke="#7fc49b" strokeOpacity="0.5" />
            <circle cx={x + bay / 2} cy="206" r="4" fill="#f4faf6" />
            {/* flight to screen */}
            <path d={`M${x + bay / 2} 202 L ${x + bay / 2 + 6} 36`} stroke="#f4faf6" strokeOpacity="0.45" strokeDasharray="2 6" strokeWidth="2" strokeLinecap="round" />
            <text x={x + bay / 2} y="280" textAnchor="middle" fontSize="15" fontWeight="600" fill="#eaf4ee" fontFamily="Anuphan, sans-serif">
              {l.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
