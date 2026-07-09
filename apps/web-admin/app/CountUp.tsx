"use client";

import { useEffect, useRef, useState } from "react";

/** Animates a number from 0 → value on mount (ease-out cubic). */
export function CountUp({ value, prefix = "", duration = 900 }: { value: number; prefix?: string; duration?: number }) {
  const [n, setN] = useState(0);
  const ref = useRef(0);

  useEffect(() => {
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      ref.current = Math.round(value * eased);
      setN(ref.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{prefix}{n.toLocaleString("en-TH")}</>;
}
