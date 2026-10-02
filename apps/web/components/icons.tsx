// One small, consistent icon set (1.75px strokes, 24px grid) drawn for this site.

type P = { size?: number; className?: string };

export function LineGlyph({ size = 20 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {/* A plain chat bubble — the official LINE mark can replace it once the brand kit arrives. */}
      <path
        fill="currentColor"
        d="M12 3.5c-5.25 0-9.5 3.42-9.5 7.65 0 3.78 3.38 6.95 7.94 7.55.3.07.72.2.82.47.1.24.06.6.03.84l-.13.8c-.04.24-.19.93.82.5 1-.42 5.44-3.2 7.42-5.48 1.37-1.5 2.1-3.02 2.1-4.68 0-4.23-4.25-7.65-9.5-7.65Z"
      />
    </svg>
  );
}

function Stroke({ size = 20, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

export const IconArrow = (p: P) => (
  <Stroke {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Stroke>
);
export const IconBack = (p: P) => (
  <Stroke {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </Stroke>
);
export const IconClose = (p: P) => (
  <Stroke {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Stroke>
);
export const IconCheck = (p: P) => (
  <Stroke {...p}>
    <path d="M5 12.5 10 17l9-10" />
  </Stroke>
);
export const IconPin = (p: P) => (
  <Stroke {...p}>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Stroke>
);
export const IconClock = (p: P) => (
  <Stroke {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Stroke>
);
export const IconPhone = (p: P) => (
  <Stroke {...p}>
    <path d="M6.5 3.5h3l1.5 4-2 1.3a11 11 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z" />
  </Stroke>
);
export const IconSun = (p: P) => (
  <Stroke {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Stroke>
);
export const IconUsers = (p: P) => (
  <Stroke {...p}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M2.5 19.5c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c1.8.6 3 2.2 3.5 4.7" />
  </Stroke>
);
export const IconMinus = (p: P) => (
  <Stroke {...p}>
    <path d="M6 12h12" />
  </Stroke>
);
export const IconPlus = (p: P) => (
  <Stroke {...p}>
    <path d="M12 6v12M6 12h12" />
  </Stroke>
);
export const IconCalendar = (p: P) => (
  <Stroke {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Stroke>
);
export const IconGift = (p: P) => (
  <Stroke {...p}>
    <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
    <path d="M5 12.5v8h14v-8M12 8.5v12M12 8.5c-1.5-3.5-5.5-3.5-5.5-1.25S9.5 8.5 12 8.5zM12 8.5c1.5-3.5 5.5-3.5 5.5-1.25S14.5 8.5 12 8.5z" />
  </Stroke>
);
