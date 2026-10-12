"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "./icons";

// The home page hero: one full-bleed slide per running promotion, then the
// store itself. Native scroll-snap does the swiping; JS only advances it every
// few seconds (never with reduced motion, and paused while touched, hovered or
// focused) and keeps the dots in step.

export interface HeroSlide {
  key: string;
  image: string;
  eyebrow: string;
  title: string;
  text: string;
  cta: { label: string; href: string; external: boolean } | null;
  more: { label: string; href: string } | null;
}

const EVERY_MS = 6000;

export function PromoCarousel({ slides }: { slides: HeroSlide[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0); // restarts the progress bar

  const go = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const n = (i + slides.length) % slides.length;
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  }, [slides.length]);

  // Which slide is showing, from the scroll position (swipe, buttons or autoplay).
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      setIndex((prev) => {
        if (prev !== i) setTick((t) => t + 1);
        return i;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => document.visibilityState === "visible" && go(index + 1), EVERY_MS);
    return () => window.clearTimeout(t);
  }, [index, paused, tick, go, slides.length]);

  return (
    <section
      className="hero-promos"
      aria-roledescription="carousel"
      aria-label="โปรโมชันและข่าวจากร้าน"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div className="hp-track" ref={track}>
        {slides.map((s, i) => (
          <article key={s.key} className="hp-slide" aria-roledescription="slide" aria-label={`${i + 1} จาก ${slides.length}`} aria-hidden={i !== index}>
            {/* eslint-disable-next-line @next/next/no-img-element -- promotion covers come from MST's uploads */}
            <img src={s.image} alt="" className="hp-img" loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "auto"} />
            <div className="hp-shade" aria-hidden="true" />
            <div className="wrap hp-content">
              <p className="hp-eyebrow">{s.eyebrow}</p>
              <h2 className="hp-title">{s.title}</h2>
              {s.text && <p className="hp-text">{s.text}</p>}
              <div className="hp-actions">
                {s.cta &&
                  (s.cta.external ? (
                    <a href={s.cta.href} className="btn btn-primary" target="_blank" rel="noopener" tabIndex={i === index ? 0 : -1}>
                      {s.cta.label}
                    </a>
                  ) : (
                    <Link href={s.cta.href} className="btn btn-primary" tabIndex={i === index ? 0 : -1}>
                      {s.cta.label}
                    </Link>
                  ))}
                {s.more && (
                  <Link href={s.more.href} className="btn btn-ghost-light" tabIndex={i === index ? 0 : -1}>
                    {s.more.label}
                  </Link>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="wrap hp-controls">
          <div className="hp-dots" role="group" aria-label="เลือกสไลด์">
            {slides.map((s, i) => (
              <button key={s.key} type="button" className={`hp-dot${i === index ? " on" : ""}`} aria-label={`สไลด์ ${i + 1}`} aria-current={i === index} onClick={() => go(i)}>
                {i === index && <span key={tick} className={`hp-progress${paused ? " paused" : ""}`} />}
              </button>
            ))}
          </div>
          <div className="hp-arrows">
            <button type="button" className="hp-arrow" aria-label="ก่อนหน้า" onClick={() => go(index - 1)}>
              <IconChevronLeft size={20} />
            </button>
            <button type="button" className="hp-arrow" aria-label="ถัดไป" onClick={() => go(index + 1)}>
              <IconChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
