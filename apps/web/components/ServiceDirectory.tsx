import Link from "next/link";
import type { Service } from "@mstgolf/shared";

// The services as a store directory: name, Thai name, one line, an arrow.
// On /services the rows jump to each section; elsewhere they link there.
export function ServiceDirectory({ services, onPage = false }: { services: Service[]; onPage?: boolean }) {
  return (
    <ul className="dir">
      {services.map((svc) => {
        const href = onPage ? `#${svc.slug}` : svc.slug === "golf-simulator" ? "/golf-simulator" : `/services#${svc.slug}`;
        return (
          <li key={svc.slug}>
            <Link href={href} className="dir-row">
              <span className="dir-name">{svc.name}</span>
              <span className="dir-thai">{svc.thai}</span>
              <span className="dir-short">{svc.short}</span>
              <span className="dir-go" aria-hidden="true">
                {onPage ? "↓" : "→"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
