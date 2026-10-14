"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export type ReferenceExpression = "neutral" | "delighted" | "unimpressed";
const expressions: ReferenceExpression[] = ["neutral", "delighted", "unimpressed"];

/** The complete original photographs differ in angle and clothes. A local dark
 * blink conceals that cut; no face pixels are pasted onto the default body. */
export function PremiereReferencePortrait({ expression, calm }: { expression: ReferenceExpression; calm: boolean }) {
  const [shown, setShown] = useState(expression);
  const content = useRef<HTMLDivElement>(null);
  const desired = useRef(expression); desired.current = expression;
  const still = useRef(calm); still.current = calm;
  const loaded = useRef(new Set<ReferenceExpression>());
  const request = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = content.current;
    if (!el) return;
    let alive = true, busy = false, visible = desired.current, lastBlink = -Infinity;
    let animation: Animation | null = null;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (delay: number, action: () => void) => {
      const timer = setTimeout(() => { timers.delete(timer); if (alive) action(); }, delay);
      timers.add(timer);
    };
    const showLatest = () => {
      if (!loaded.current.has(desired.current)) return;
      visible = desired.current; setShown(visible);
    };
    const stop = () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear(); animation?.cancel(); animation = null;
      delete el.dataset.switching; busy = false;
    };
    const pump = () => {
      if (!alive) return;
      if (still.current || document.hidden) { stop(); showLatest(); return; }
      if (busy || visible === desired.current || !loaded.current.has(desired.current)) return;
      busy = true;
      // The rate limit survives rapid on/off input. In-flight cuts consume the
      // latest state at the dark midpoint, then schedule at most one next cut.
      later(Math.max(0, lastBlink + 700 - performance.now()), () => {
        if (visible === desired.current || !loaded.current.has(desired.current)) { busy = false; pump(); return; }
        lastBlink = performance.now(); el.dataset.switching = "";
        animation = el.animate([{ opacity: 1 }, { opacity: 0, offset: .34 }, { opacity: 0, offset: .56 }, { opacity: 1 }], { duration: 320, easing: "ease-in-out" });
        later(140, showLatest);
        later(320, () => { animation?.cancel(); animation = null; delete el.dataset.switching; busy = false; pump(); });
      });
    };
    request.current = pump;
    document.addEventListener("visibilitychange", pump);
    pump();
    return () => { alive = false; stop(); request.current = null; document.removeEventListener("visibilitychange", pump); };
  }, []);
  useEffect(() => { request.current?.(); }, [expression, calm]);

  return <div className="pm-photo-content" ref={content} data-expression={shown}>
    {expressions.map(kind => <Image key={kind} className="pm-photo-layer" data-visible={shown === kind ? "" : undefined} src={`/premiere/tori-photo-${kind}.webp`} width={320} height={400} alt="" sizes="180px" unoptimized loading="eager" draggable={false} onLoad={() => { loaded.current.add(kind); request.current?.(); }} />)}
  </div>;
}
