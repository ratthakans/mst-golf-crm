// Website copy (docs/PRODUCT.md §7.3). Placeholders live in @mstgolf/shared/site; MST writes the final text in the back
// office (เว็บไซต์ › เนื้อหาหน้าเว็บ → settings.site.copy); any field left blank
// falls back to the placeholder.

import type { SiteCopy } from "@mstgolf/shared";
import { DEFAULT_HOME_COPY, DEFAULT_SERVICES, type Service } from "@mstgolf/shared/site";

export type { Service };
export const SERVICES = DEFAULT_SERVICES;
export const HOME_COPY = DEFAULT_HOME_COPY;

const lines = (v: string | undefined, sep: RegExp) => (v ? v.split(sep).map((x) => x.trim()).filter(Boolean) : []);

/** Services with MST's text over the placeholders, field by field. */
export function siteServices(copy: SiteCopy | undefined): Service[] {
  return SERVICES.map((svc) => {
    const c = copy?.services?.[svc.slug as keyof NonNullable<SiteCopy["services"]>];
    const body = lines(c?.body, /\n\s*\n/);
    const points = lines(c?.points, /\n/);
    return { ...svc, short: c?.short || svc.short, body: body.length ? body : svc.body, points: points.length ? points : svc.points };
  });
}

/** Home page headline and intro with MST's text over the placeholders. */
export function homeCopy(copy: SiteCopy | undefined, lanes: number) {
  return {
    heroTitle: copy?.heroTitle || HOME_COPY.heroTitle,
    heroHighlight: copy?.heroHighlight ?? (copy?.heroTitle ? "" : HOME_COPY.heroHighlight),
    heroLede: copy?.heroLede || HOME_COPY.heroLede(lanes),
    servicesTitle: copy?.servicesTitle || HOME_COPY.servicesTitle,
    servicesLede: copy?.servicesLede || HOME_COPY.servicesLede,
  };
}
