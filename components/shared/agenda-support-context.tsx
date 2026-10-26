"use client";

import { ArrowUpRight, Pin, Sprout } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { agendaNoticesInRange, agendaNoticeStacks, noticeIsActive, noticeRangeText, type AgendaNotice } from "@/lib/ui/agenda-notices";
import { agendaReadingAnchor, agendaReadingLabel, anchoredAgendaDate, sameAgendaReadingDate, type AgendaReadingDate } from "@/lib/ui/agenda-reading-context";
import { flipSpring, FLIP_MS, FLIP_SPRING } from "@/lib/ui/flip-motion";
import { REDUCE_MOTION_EVENT, reduceMotionEnabled } from "@/lib/ui/motion";
import { hapticTick } from "@/lib/ui/haptics";
import { revealAgendaFrame } from "@/lib/ui/agenda-scroll";
import "./agenda-support-context.css";

type Props = {
  notices: AgendaNotice[];
  fallbackDate: string;
  children: ReactNode;
  onDetail?: (id: string, origin: HTMLElement) => void;
  onEdit?: (id: string, origin: HTMLElement) => void;
};

/** Shared by public/anonymous/preview/studio. Automatic context never emits activity. */
export function AgendaSupportContext({ notices, fallbackDate, children, onDetail, onEdit }: Props) {
  const hostRef = useRef<HTMLDivElement>(null), boardRef = useRef<HTMLElement>(null), markerRef = useRef<HTMLSpanElement>(null);
  const [reading, setReading] = useState<AgendaReadingDate>({ date: fallbackDate });
  const [presented, setPresented] = useState<AgendaReadingDate>(reading);
  const [manual, setManual] = useState<{ id: string; date: string } | null>(null);
  const [gapRanges, setGapRanges] = useState<AgendaReadingDate[]>([]);
  const [flowElement, setFlowElement] = useState<HTMLElement | null>(null);
  const ringRef = useRef<HTMLSpanElement>(null), ringReady = useRef(false);
  const [stackHeight, setStackHeight] = useState(0), [reduced, setReduced] = useState(false);
  const id = useId(), footerId = `${id}-detail`;
  const stacks = useMemo(() => agendaNoticeStacks(notices, gapRanges), [notices, gapRanges]);
  const visible = agendaNoticesInRange(notices, presented.date, presented.endDate);
  const populated = visible.length > 0;
  const selected = (manual?.date === presented.date ? visible.find(notice => notice.id === manual.id) : undefined) ?? visible[0];
  const held = !sameAgendaReadingDate(reading, presented);
  const signature = notices.map(n => `${n.id}:${n.title}:${n.start}:${n.end}`).join("|");
  const motionDates = useRef(new Set<string>()), scheduleReadRef = useRef<() => void>(() => {});

  // Re-rendered/filter-collapsed children can change both the visible date and
  // the range stacks. The signature comparison keeps this to one extra commit.
  useLayoutEffect(() => {
    const ranges = Array.from(hostRef.current?.querySelectorAll<HTMLElement>(".agenda-gap[data-flip-key]") ?? [], node => ({ date: node.dataset.flipKey!, endDate: node.dataset.flipEnd }));
    setGapRanges(previous => JSON.stringify(previous) === JSON.stringify(ranges) ? previous : ranges);
    hostRef.current?.querySelectorAll<HTMLElement>(".agenda-day[data-flip-key],.agenda-gap[data-flip-key]").forEach(node => {
      if (node.dataset.flipKey === reading.date) node.dataset.noticeReading = "true";
      else delete node.dataset.noticeReading;
    });
    setFlowElement(hostRef.current?.querySelector<HTMLElement>(".agenda-flow") ?? null);
    scheduleReadRef.current();
  }, [children, reading.date, notices.length]);

  // One paint-only outline follows the real row's width/height. Cards never
  // move or resize for the highlight, and an interrupted transition starts
  // from its actual displayed position rather than its previous target.
  useLayoutEffect(() => {
    const ring = ringRef.current, flow = flowElement;
    const row = flow?.querySelector<HTMLElement>(`[data-flip-key="${reading.date}"]`);
    if (!ring || !flow) return;
    if (!row) { ring.style.transition = "none"; ring.style.transform = ""; ring.style.opacity = "0"; ringReady.current = false; return; }
    const update = () => {
      const before = ring.getBoundingClientRect(), target = row.getBoundingClientRect(), frame = flow.getBoundingClientRect();
      const animate = ringReady.current && !reduced && before.width > 0 && before.height > 0;
      ring.style.transition = "none"; ring.style.transform = "";
      Object.assign(ring.style, { left: `${target.left - frame.left + flow.scrollLeft}px`, top: `${target.top - frame.top + flow.scrollTop}px`, width: `${target.width}px`, height: `${target.height}px`, opacity: "1" });
      if (animate) flipSpring(ring, `translate(${before.left - target.left}px,${before.top - target.top}px) scale(${before.width / target.width},${before.height / target.height})`, { origin: "top left", ms: 280, easing: "cubic-bezier(.2,.8,.2,1)" });
      ringReady.current = true;
    };
    update();
    const observer = new ResizeObserver(update); observer.observe(row);
    return () => observer.disconnect();
  }, [flowElement, reading.date, children, reduced]);

  useEffect(() => {
    const update = () => setReduced(reduceMotionEnabled());
    update(); window.addEventListener(REDUCE_MOTION_EVENT, update);
    return () => window.removeEventListener(REDUCE_MOTION_EVENT, update);
  }, []);

  // Measure every overlap group's complete titles, not a guessed number of lines.
  // Populated groups share a reservation; an empty date keeps only its toolbar.
  useLayoutEffect(() => {
    const host = hostRef.current, board = boardRef.current;
    if (!host) return;
    const surface = host.closest(".studio-mobile,.public-calendar-shell") ?? host.parentElement;
    const header = surface?.querySelector<HTMLElement>(".m-topstick,.agenda-header");
    const agenda = host.querySelector<HTMLElement>(":scope > .agenda");
    const footer = surface?.querySelector<HTMLElement>(".m-actionrail")
      ?? surface?.closest(".poster-page")?.querySelector<HTMLElement>(".agenda-monthbar")
      ?? document.querySelector<HTMLElement>(".agenda-monthbar");
    const measure = () => {
      const max = Math.max(0, ...Array.from(host.querySelectorAll<HTMLElement>(".asc-measure-group"), node => node.getBoundingClientRect().height));
      setStackHeight(previous => Math.abs(previous - max) < .1 ? previous : max);
      host.style.setProperty("--asc-header-height", `${header?.getBoundingClientRect().height ?? 0}px`);
      if (!agenda) return;
      const viewport = window.visualViewport;
      const visibleBottom = Math.min(window.innerHeight, viewport ? viewport.offsetTop + viewport.height : window.innerHeight);
      const footerTop = footer?.getBoundingClientRect().top;
      const bottom = footerTop !== undefined && footer?.offsetWidth ? Math.min(visibleBottom, footerTop) : visibleBottom - 8;
      (surface as HTMLElement | null)?.style.setProperty("--asc-footer-space", `${Math.max(0, window.innerHeight - bottom)}px`);
      const readingTop = agenda.getBoundingClientRect().top + (host.closest(".viewer-preview-overlay") ? 0 : window.scrollY);
      host.style.setProperty("--asc-frame-height", `${Math.max(0, bottom - readingTop)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (board) observer.observe(board); if (header) observer.observe(header); if (footer) observer.observe(footer);
    host.querySelectorAll(".asc-measure-group").forEach(node => observer.observe(node));
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      observer.disconnect(); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure);
      window.visualViewport?.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [signature, gapRanges, populated, stackHeight]);

  useEffect(() => {
    const host = hostRef.current, flow = host?.querySelector<HTMLElement>(".agenda-flow");
    if (!host || !flow) return;
    let frame = 0;
    const surface = host.closest(".studio-mobile,.public-calendar-shell");
    const header = surface?.querySelector<HTMLElement>(".m-topstick,.agenda-header");
    const footer = surface?.querySelector<HTMLElement>(".m-actionrail")
      ?? surface?.closest(".poster-page")?.querySelector<HTMLElement>(".agenda-monthbar");
    const read = () => {
      frame = 0;
      if (document.hidden || !flow.offsetWidth) return;
      const rect = flow.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom = Math.min(window.innerHeight, viewport ? viewport.offsetTop + viewport.height : window.innerHeight);
      const boardRect = boardRef.current?.getBoundingClientRect();
      const boardBottom = boardRect && boardRect.bottom > viewportTop && boardRect.top < viewportBottom ? boardRect.bottom : viewportTop;
      const top = Math.max(rect.top, viewportTop, header?.getBoundingClientRect().bottom ?? viewportTop, boardBottom);
      const bottom = Math.min(rect.bottom, viewportBottom, footer?.getBoundingClientRect().top ?? viewportBottom);
      const rows = Array.from(flow.querySelectorAll<HTMLElement>(".agenda-day[data-flip-key],.agenda-gap[data-flip-key]"));
      const next = anchoredAgendaDate(rows.map(row => {
        const box = row.getBoundingClientRect();
        return { date: row.dataset.flipKey!, endDate: row.dataset.flipEnd, top: box.top, bottom: box.bottom };
      }), top, bottom);
      if (!next) return;
      setReading(previous => sameAgendaReadingDate(previous, next) ? previous : next);
      // Keep a focused action's DOM and URL stable, but never freeze the screen
      // date. The date-follow control is deliberately outside this focus pin.
      const focused = document.activeElement instanceof Element ? document.activeElement.closest(".asc-row,.asc-detail a,.asc-detail button:not(.asc-follow)") : null;
      if (!focused || !boardRef.current?.contains(focused)) {
        setPresented(previous => sameAgendaReadingDate(previous, next) ? previous : next);
      }
    };
    const schedule = (event?: Event) => {
      if (event?.type === "scroll" && event.target instanceof Element && event.target !== flow) return;
      if (!frame) frame = requestAnimationFrame(read);
    };
    scheduleReadRef.current = schedule;
    flow.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule); host.addEventListener("focusout", schedule);
    document.addEventListener("visibilitychange", schedule);
    window.visualViewport?.addEventListener("resize", schedule); window.visualViewport?.addEventListener("scroll", schedule);
    const measureTail = () => {
      const last = Array.from(flow.querySelectorAll<HTMLElement>(".agenda-day[data-flip-key],.agenda-gap[data-flip-key]")).at(-1);
      if (last) flow.style.setProperty("--asc-tail-space", `${Math.max(8, flow.clientHeight - agendaReadingAnchor(0, flow.clientHeight) - last.getBoundingClientRect().height)}px`);
      schedule();
    };
    const observer = new ResizeObserver(measureTail); observer.observe(flow);
    flow.querySelectorAll(".agenda-day,.agenda-gap").forEach(row => observer.observe(row));
    measureTail();
    schedule();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); scheduleReadRef.current = () => {};
      flow.removeEventListener("scroll", schedule); window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule); host.removeEventListener("focusout", schedule);
      document.removeEventListener("visibilitychange", schedule);
      window.visualViewport?.removeEventListener("resize", schedule); window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [signature, children]);

  useLayoutEffect(() => {
    const key = `${reading.date}:${reading.endDate ?? ""}`;
    if (motionDates.current.has(key)) return;
    const first = motionDates.current.size === 0;
    motionDates.current.add(key);
    if (!first && !reduced && markerRef.current) flipSpring(markerRef.current, "scale(.94)");
  }, [reading, reduced]);

  const row = (notice: AgendaNotice, measure = false) => {
    const Icon = notice.kind === "period" ? Pin : Sprout;
    const content = <><Icon aria-hidden="true" size={15} /><span className="asc-title">{notice.title}</span></>;
    return measure ? <div className="asc-row" key={notice.id}>{content}</div> : (
      <button className="asc-row" key={notice.id} id={`${id}-${notice.id}`} type="button"
        data-kind={notice.kind} data-active={noticeIsActive(notice, reading.date) || Boolean(reading.endDate && agendaNoticesInRange([notice], reading.date, reading.endDate).length)} data-notice-id={notice.id} data-supportid={notice.id}
        aria-pressed={selected?.id === notice.id} aria-expanded={selected?.id === notice.id} aria-controls={footerId}
        data-act="agenda-support-select" onClick={event => { event.currentTarget.focus({ preventScroll: true }); hapticTick(); setManual({ id: notice.id, date: presented.date }); }}>
        {content}<span className="asc-row-mark" aria-hidden="true" />
      </button>
    );
  };

  return (
    <div className="agenda-with-notices" data-has-notices={notices.length > 0} ref={hostRef}
      onFocusCapture={event => {
        const target = event.target;
        // Moving a pointer-focused row before its click lands consumes the
        // first tap. Reveal on keyboard focus or explicit scroller entry only.
        if (target instanceof HTMLElement && (target.matches(":focus-visible") || target.classList.contains("agenda-flow"))) revealAgendaFrame(target);
      }}
      style={{ "--asc-spring": FLIP_SPRING, "--asc-motion-ms": `${FLIP_MS}ms` } as CSSProperties}>
      {notices.length > 0 ? <section className="agenda-support-board" ref={boardRef} aria-label="기간·업도움" data-reading-date={reading.date} data-reading-end={reading.endDate} data-presented-date={presented.date} data-held={held} data-empty={visible.length === 0} data-reduced={reduced}>
        <div className="asc-detail-slot" id={footerId} role="region" aria-label="선택한 안내의 기간과 링크">
          <div className="asc-detail" data-kind={selected?.kind}>
            <div className="asc-meta">
              <div className="asc-head"><h2>기간·업도움</h2></div>
              {selected ? <span className="asc-caption">{noticeRangeText(selected) ? <b className="asc-range">{noticeRangeText(selected)}</b> : null}{held ? <span className="asc-held">{noticeRangeText(selected) ? " · " : ""}{agendaReadingLabel(presented)} 선택 유지</span> : null}</span> : <span className="asc-no-active">해당 날짜의 안내 없음</span>}
            </div>
            <button className="asc-action asc-follow" type="button" data-act="agenda-support-follow-view" aria-label={`${reading.date}${reading.endDate ? `부터 ${reading.endDate}까지` : ""} 화면 기준 안내 따라가기`} title="일정 위쪽 읽기선 기준 · 누르면 선택을 해제하고 따라갑니다" onClick={event => {
              event.currentTarget.focus({ preventScroll: true }); hapticTick(); setManual(null); setPresented(reading);
            }}><span ref={markerRef} aria-live="polite" aria-atomic="true"><b>{agendaReadingLabel(reading)}</b><small>화면 기준</small></span></button>
            {selected ? <>
              {onDetail ? <button className="asc-action" type="button" data-act="agenda-support-detail" onClick={event => { event.currentTarget.focus({ preventScroll: true }); onDetail(selected.id, event.currentTarget); }}>상세</button> : null}
              {selected.url ? <a className="asc-action asc-link" data-act="agenda-link" onPointerDown={event => event.currentTarget.focus({ preventScroll: true })} aria-label={selected.kind === "period" ? "자세히 보기" : "도우러 가기"} title={selected.kind === "period" ? "자세히 보기" : "도우러 가기"} href={selected.url} target="_blank" rel="noopener noreferrer"><ArrowUpRight aria-hidden="true" size={18} /></a> : null}
              {onEdit ? <button className="asc-action" type="button" data-act="m-support-edit" onClick={event => { event.currentTarget.focus({ preventScroll: true }); onEdit(selected.id, event.currentTarget); }}>수정</button> : null}
            </> : null}
          </div>
        </div>
        <div className="asc-stack" style={visible.length && stackHeight ? { minHeight: stackHeight } : undefined}>
          {visible.map(notice => row(notice))}
        </div>
        <div className="asc-measures" aria-hidden="true" inert>{stacks.map((stack, index) => <div className="asc-measure-group" key={index}>{stack.map(n => row(n, true))}</div>)}</div>
      </section> : null}
      {children}
      {flowElement ? createPortal(<span className="agenda-reading-ring" ref={ringRef} aria-hidden="true" />, flowElement) : null}
    </div>
  );
}
