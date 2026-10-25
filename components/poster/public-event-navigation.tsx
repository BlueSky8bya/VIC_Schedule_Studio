"use client";

import { useLayoutEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PublicEventNavigation({ position, total, title, onNavigate }: { position: number; total: number; title: string; onNavigate: (direction: -1 | 1) => boolean }) {
  const ref = useRef<HTMLElement | null>(null);
  const pending = useRef<-1 | 1 | null>(null);
  useLayoutEffect(() => {
    if (pending.current === null) return;
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>("button");
    const preferred = buttons?.[pending.current < 0 ? 0 : 1];
    (preferred && !preferred.disabled ? preferred : Array.from(buttons ?? []).find(button => !button.disabled))?.focus({ preventScroll: true });
    pending.current = null;
  }, [position, total]);
  if (total < 2 || position < 0) return null;
  const move = (direction: -1 | 1) => {
    pending.current = direction;
    if (!onNavigate(direction)) pending.current = null;
  };
  return <nav aria-label="일정 이동" className="agenda-detail-navigation" ref={ref}>
    <button aria-label="이전 일정" className="button" data-act="detail-previous-event" disabled={position === 0} onClick={() => move(-1)} type="button"><ChevronLeft aria-hidden="true" size={16} />이전</button>
    <span aria-atomic="true" aria-live="polite">{position + 1}/{total}<span className="sr-only"> {title}</span></span>
    <button aria-label="다음 일정" className="button" data-act="detail-next-event" disabled={position === total - 1} onClick={() => move(1)} type="button">다음<ChevronRight aria-hidden="true" size={16} /></button>
  </nav>;
}
