import Link from "next/link";
import type { Service } from "@/lib/content";

// The store drawn as one golf hole, the way a yardage book draws it: tee at the
// bottom, fairway bending right, a bunker, the green and flag at the top. The
// four services are the stops a customer makes on the way round. Hand-built SVG
// for the drawing; the labels are HTML so they wrap, take the page's fonts and
// stay real links. Positions are percentages of the drawing (viewBox 400 × 520).

const STOPS: Array<{ slug: Service["slug"]; x: number; y: number; side: "left" | "right" }> = [
  { slug: "pro-shop", x: 22, y: 86, side: "right" },
  { slug: "club-fitting", x: 40, y: 62, side: "right" },
  { slug: "golf-simulator", x: 64, y: 40, side: "left" },
  { slug: "academy", x: 74, y: 17, side: "left" },
];

const href = (slug: string) => (slug === "golf-simulator" ? "/golf-simulator" : `/services#${slug}`);

export function YardageMap({ services, title, lede }: { services: Service[]; title: string; lede: string }) {
  const bySlug = new Map(services.map((s) => [s.slug, s]));
  return (
    <figure className="yardage" aria-labelledby="yardage-cap">
      <div className="yardage-plot">
        <svg viewBox="0 0 400 520" className="yardage-svg" aria-hidden="true" focusable="false">
          {/* rough and fairway */}
          <path className="y-fairway" d="M52 500 C 40 430, 90 360, 150 322 C 215 280, 265 245, 262 190 C 258 140, 300 92, 330 64 L 372 96 C 342 128, 316 168, 318 214 C 322 280, 262 330, 196 366 C 132 402, 104 450, 118 506 Z" />
          {/* bunker */}
          <path className="y-bunker" d="M318 170 c 16 -8 34 -2 36 12 c 2 14 -14 22 -28 20 c -14 -2 -22 -24 -8 -32 Z" />
          {/* green + flag */}
          <ellipse className="y-green" cx="298" cy="86" rx="58" ry="42" />
          <line className="y-pin" x1="298" y1="86" x2="298" y2="36" />
          <path className="y-flag" d="M298 36 L 322 44 L 298 52 Z" />
          {/* tee box */}
          <rect className="y-tee" x="64" y="462" width="44" height="26" rx="4" />
          {/* ball flight between the stops */}
          <path className="y-flight" d="M88 448 C 110 390, 150 340, 160 322 C 190 270, 240 230, 256 208 C 272 180, 284 120, 296 90" />
        </svg>
        {STOPS.map((stop, i) => {
          const svc = bySlug.get(stop.slug);
          if (!svc) return null;
          return (
            <Link
              key={stop.slug}
              href={href(stop.slug)}
              className={`y-stop y-stop-${stop.side}`}
              style={{ left: `${stop.x}%`, top: `${stop.y}%` }}
            >
              <span className="y-dot mono" aria-hidden="true">{i + 1}</span>
              <span className="y-label">
                <b>{svc.name}</b>
                <span>{svc.thai}</span>
              </span>
            </Link>
          );
        })}
      </div>
      <figcaption id="yardage-cap" className="yardage-cap">
        <b>{title}</b> {lede}
        <span className="y-legend">
          <span className="y-legend-line" aria-hidden="true" /> เส้นทางในร้าน · แตะแต่ละจุดเพื่อดูรายละเอียด
        </span>
      </figcaption>
    </figure>
  );
}
