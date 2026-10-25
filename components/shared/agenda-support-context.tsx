"use client";

import { ArrowUpRight, Pin, Sprout } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { agendaNoticeGroupAt, groupAgendaNotices, noticeIsActive, noticeRangeText, type AgendaNotice } from "@/lib/ui/agenda-notices";
import { flipSpring, FLIP_MS, FLIP_SPRING } from "@/lib/ui/flip-motion";
import { REDUCE_MOTION_EVENT, reduceMotionEnabled } from "@/lib/ui/motion";
import { hapticTick } from "@/lib/ui/haptics";
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
  const hostRef = useRef<HTMLDivElement>(null), boardRef = useRef<HTMLElement>(null), detailRef = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState(fallbackDate), [manual, setManual] = useState<{ id: string; date: string } | null>(null);
  const [stackHeight, setStackHeight] = useState(0), [reduced, setReduced] = useState(false);
  const id = useId(), footerId = `${id}-detail`;
  const groups = useMemo(() => groupAgendaNotices(notices), [notices]);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const group = agendaNoticeGroupAt(groups, date);
  const selected = (manual?.date === date ? group?.notices.find(notice => notice.id === manual.id) : undefined)
    ?? group?.notices.find(notice => noticeIsActive(notice, date));
  const captionDate = selected && selected.start === selected.end && !noticeIsActive(selected, date) ? selected.start : date;
  const signature = notices.map(n => `${n.id}:${n.title}:${n.start}:${n.end}`).join("|");
  const firstMotion = useRef(true);

  useEffect(() => {
    const update = () => setReduced(reduceMotionEnabled());
    update(); window.addEventListener(REDUCE_MOTION_EVENT, update);
    return () => window.removeEventListener(REDUCE_MOTION_EVENT, update);
  }, []);

  // Measure every overlap group's complete titles, not a guessed number of lines.
  // Reserve the maximum once per width/font/data change. Scroll/selection never changes this height.
  useLayoutEffect(() => {
    const host = hostRef.current, board = boardRef.current;
    if (!host || !board) return;
    const surface = host.closest(".studio-mobile,.public-calendar-shell") ?? host.parentElement;
    const header = surface?.querySelector<HTMLElement>(".m-topstick,.agenda-header");
    const measure = () => {
      const max = Math.max(0, ...Array.from(host.querySelectorAll<HTMLElement>(".asc-measure-group"), node => node.getBoundingClientRect().height));
      setStackHeight(previous => Math.abs(previous - max) < .1 ? previous : max);
      host.style.setProperty("--asc-header-height", `${header?.getBoundingClientRect().height ?? 0}px`);
      host.style.setProperty("--asc-board-height", `${board.getBoundingClientRect().height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(board); if (header) observer.observe(header);
    host.querySelectorAll(".asc-measure-group").forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [signature]);

  useEffect(() => {
    const host = hostRef.current, board = boardRef.current;
    if (!host || !board) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = () => {
      if (document.hidden || detailRef.current?.contains(document.activeElement)) return;
      const rect = board.getBoundingClientRect();
      if (rect.top >= window.innerHeight || !board.offsetWidth) return;
      const rows = Array.from(host.querySelectorAll<HTMLElement>(".agenda-day[data-flip-key],.agenda-gap[data-flip-key]"));
      let leading = rows[0];
      for (const row of rows) { if (row.getBoundingClientRect().top <= rect.bottom + 24) leading = row; else break; }
      // At the document end the final day cannot reach the sticky reading line.
      // Follow that visible day without adding blank space or moving any cards.
      const page = document.scrollingElement, last = rows.at(-1), lastRect = last?.getBoundingClientRect();
      if (page && page.scrollTop > 0 && page.scrollTop + page.clientHeight >= page.scrollHeight - 2
        && last && lastRect && lastRect.top < window.innerHeight && lastRect.bottom > rect.bottom) leading = last;
      const next = leading?.dataset.flipKey;
      const focused = document.activeElement instanceof Element ? document.activeElement.closest<HTMLElement>("[data-notice-id]")?.dataset.noticeId : undefined;
      if (next && focused && !agendaNoticeGroupAt(groupsRef.current, next)?.notices.some(notice => notice.id === focused)) return;
      if (next) setDate(previous => previous === next ? previous : next);
    };
    const schedule = (event?: Event) => {
      if (event?.target instanceof Element && !event.target.contains(host) && !host.contains(event.target)) return;
      clearTimeout(timer); timer = setTimeout(read, 180);
    };
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule); host.addEventListener("focusout", schedule);
    schedule();
    return () => { clearTimeout(timer); window.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", schedule); host.removeEventListener("focusout", schedule); };
  }, [signature]);

  useLayoutEffect(() => {
    if (firstMotion.current) { firstMotion.current = false; return; }
    if (!reduced && detailRef.current) flipSpring(detailRef.current, "translateY(4px)");
  }, [selected?.id, date, reduced]);

  const row = (notice: AgendaNotice, measure = false) => {
    const Icon = notice.kind === "period" ? Pin : Sprout;
    const content = <><Icon aria-hidden="true" size={15} /><span className="asc-title">{notice.title}</span></>;
    return measure ? <div className="asc-row" key={notice.id}>{content}</div> : (
      <button className="asc-row" key={notice.id} id={`${id}-${notice.id}`} type="button"
        data-kind={notice.kind} data-active={noticeIsActive(notice, date)} data-notice-id={notice.id} data-supportid={notice.id}
        aria-pressed={selected?.id === notice.id} aria-expanded={selected?.id === notice.id} aria-controls={footerId}
        data-act="agenda-support-select" onClick={() => { hapticTick(); setManual({ id: notice.id, date }); }}>
        {content}<span className="asc-row-mark" aria-hidden="true" />
      </button>
    );
  };

  return (
    <div className="agenda-with-notices" data-has-notices={notices.length > 0} ref={hostRef}
      style={{ "--asc-spring": FLIP_SPRING, "--asc-motion-ms": `${FLIP_MS}ms` } as CSSProperties}>
      {notices.length > 0 ? <section className="agenda-support-board" ref={boardRef} aria-label="기간·업도움" data-reading-date={date} data-reduced={reduced}>
        <div className="asc-head"><h2>기간·업도움</h2><span aria-live="polite">{Number(captionDate.slice(5, 7))}.{Number(captionDate.slice(8, 10))}{captionDate === date ? " 기준" : " 안내"}</span></div>
        <div className="asc-stack" style={stackHeight ? { minHeight: stackHeight } : undefined}>
          {group?.notices.map(notice => row(notice))}
        </div>
        <div className="asc-detail-slot" id={footerId} role="region" aria-label="선택한 안내의 기간과 링크">
          <div className="asc-detail" ref={detailRef} data-kind={selected?.kind}>
            {selected ? <>
              <div className="asc-meta"><span>{selected.kind === "period" ? "기간 안내" : "업 도움"}</span>{noticeRangeText(selected) ? <b className="asc-range">{noticeRangeText(selected)}</b> : null}</div>
              {onDetail ? <button className="asc-action" type="button" data-act="agenda-support-detail" onClick={event => onDetail(selected.id, event.currentTarget)}>상세</button> : null}
              {selected.url ? <a className="asc-action asc-link" data-act="agenda-link" href={selected.url} target="_blank" rel="noopener noreferrer">{selected.kind === "period" ? "자세히 보기" : "도우러 가기"}<ArrowUpRight aria-hidden="true" size={13} /></a> : null}
              {onEdit ? <button className="asc-action" type="button" data-act="m-support-edit" onClick={event => onEdit(selected.id, event.currentTarget)}>수정</button> : null}
            </> : <span className="asc-no-active">이 날짜에 진행 중인 안내가 없어요</span>}
          </div>
        </div>
        <div className="asc-measures" aria-hidden="true" inert>{groups.map(g => <div className="asc-measure-group" key={g.start}>{g.notices.map(n => row(n, true))}</div>)}</div>
      </section> : null}
      {children}
    </div>
  );
}
