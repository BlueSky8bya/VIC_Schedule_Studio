"use client";

import { useEffect, useId, useState } from "react";
import { useRemainSeconds } from "@/lib/ui/use-remain-seconds";
import { reduceMotionEnabled } from "@/lib/ui/motion";
import { subscribeClock } from "@/lib/ui/synced-clock";

// Only receives already-public text. Hidden placeholders always have eight glyphs.
export function ScrambleText({ text }: { text: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduceMotionEnabled()) { setStep(20); return; }
    setStep(0);
    const start = performance.now();
    return subscribeClock(() => {
      setStep(reduceMotionEnabled() ? 20 : Math.min(20, Math.ceil((performance.now() - start) / 90)));
    });
  }, [text]);
  if (step >= 20) return <>{text}</>;
  const locked = step < 8 ? 0 : Math.floor(text.length * (step - 8) / 12);
  const pool = "✦◇✧0123456789";
  return <><span className="sr-only">{text}</span><span aria-hidden="true" className="scramble-locked">{text.slice(0, locked)}</span><span aria-hidden="true" className="scramble-rest">{Array.from({ length: 8 }, (_, index) => pool[(step * 3 + index * 7) % pool.length]).join("")}</span></>;
}

export function TeaserStageContent({ revealAt }: { revealAt: string }) {
  const remain = useRemainSeconds(Date.parse(revealAt));
  const id = useId();
  const progress = Math.max(0, Math.min(1, (remain ?? 60) / 60));
  return <div className={`dt-count${remain !== null && remain <= 10 ? " is-final" : ""}`}>
    <div className="dt-count-ringbox">
      <svg className="dt-ring" viewBox="0 0 100 100" aria-hidden="true">
        <defs><linearGradient id={id}><stop offset="0" stopColor="var(--teaser-soft)" /><stop offset="1" stopColor="var(--teaser)" /></linearGradient></defs>
        <circle className="dt-ring-track" cx="50" cy="50" r="44" />
        <circle className="dt-ring-progress" cx="50" cy="50" r="44" pathLength="1" style={{ stroke: `url(#${id})`, strokeDasharray: 1, strokeDashoffset: 1 - progress }} />
        <g className="dt-ring-ticks">{Array.from({ length: 12 }, (_, index) => <line key={index} className={index / 12 <= progress ? "on" : undefined} x1="91.8" x2="96.2" y1="50" y2="50" transform={`rotate(${index * 30 - 90} 50 50)`} />)}</g>
        <circle className="dt-ring-trail t1" cx="94" cy="50" r="1.8" style={{ transform: `rotate(${progress * 360 - 94}deg)`, transformOrigin: "50px 50px" }} />
        <circle className="dt-ring-spark" cx="94" cy="50" r="3" style={{ transform: `rotate(${progress * 360 - 90}deg)`, transformOrigin: "50px 50px" }} />
      </svg>
      <div className="dt-count-core" role="timer" aria-live="off"><strong key={remain}>{remain === null ? "…" : remain === 0 ? "✦" : remain}</strong></div>
    </div>
    <p className="dt-count-label">{remain === 0 ? "공개 확인 중" : "최초공개까지"}</p>
  </div>;
}
