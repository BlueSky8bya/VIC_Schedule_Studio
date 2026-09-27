"use client";

import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { hapticTick } from "@/lib/ui/haptics";
import "./month-picker.css";

// 월 이동 부품 세트 — 편집실·시청자, PC·모바일이 **같은 구현**을 쓴다(AGENTS G-18).
//
//  · MonthTitleButton  제목("2026년 9월")이 곧 버튼. PC는 호버 알약으로 눌림을 알리고(장식 없음, 2026-09-27
//                      소유자), 모바일은 호버가 없으니 작은 ▾ 하나만 붙인다.
//  · MonthPicker       제목을 누르면 뜨는 월 피커 — PC는 제목 아래 팝오버, 모바일은 바텀 시트. 연도 스테퍼 +
//                      3×4 월 격자. 보고 있는 달 = 선택 링, 오늘 달 = 점. 범위 밖은 비활성.
//  · TodayFab          지도 앱 '내 위치' 문법 — 오늘 달을 벗어났을 때만 떠오르는 원형 버튼(PC). 헤더에 상자를
//                      더하지 않아 대칭·크기 문제가 없다. 모바일은 기존 하단 '오늘'이 담당.
//  · MonthJumpToast    검색→다시보기로 먼 달로 옮겨진 뒤 "돌아가기" 한 번에 — 출발 달로 복귀.

export type YM = { year: number; month: number };

export function ymKey(ym: YM): string {
  return `${ym.year}-${String(ym.month).padStart(2, "0")}`;
}
export function ymOffset(from: YM, to: YM): number {
  return (to.year - from.year) * 12 + (to.month - from.month);
}
export function ymLabel(ym: YM): string {
  return `${ym.year}년 ${ym.month}월`;
}
function ymCmp(a: YM, b: YM): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

// ── 제목 버튼 ────────────────────────────────────────────────────────────────
export function MonthTitleButton({
  children,
  narrow,
  open,
  onOpen,
  className = "",
  titleRef
}: {
  children: React.ReactNode;
  narrow: boolean; // 모바일: ▾ 표시(호버 없음)
  open: boolean;
  onOpen: (anchor: DOMRect) => void;
  className?: string;
  titleRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const localRef = useRef<HTMLButtonElement>(null);
  const ref = titleRef ?? localRef;
  return (
    <button
      aria-expanded={open}
      aria-haspopup="dialog"
      className={`month-title-btn${narrow ? " is-narrow" : ""}${open ? " is-open" : ""} ${className}`}
      data-act="month-title"
      onClick={(e) => {
        hapticTick();
        onOpen(e.currentTarget.getBoundingClientRect());
      }}
      ref={ref}
      title="다른 달로 이동"
      type="button"
    >
      {children}
      {narrow ? (
        <span aria-hidden="true" className="month-title-caret">
          ▾
        </span>
      ) : null}
    </button>
  );
}

// ── 월 피커 ──────────────────────────────────────────────────────────────────
export function MonthPicker({
  view,
  today,
  min,
  max,
  narrow,
  anchor,
  onPick,
  onClose
}: {
  view: YM;
  today: YM;
  min: YM;
  max: YM;
  narrow: boolean;
  anchor: DOMRect | null; // PC 팝오버 기준(제목 버튼). 모바일은 무시.
  onPick: (ym: YM) => void;
  onClose: () => void;
}) {
  const [year, setYear] = useState(view.year);
  const panelRef = useRef<HTMLDivElement>(null);
  const canPrevYear = year > min.year;
  const canNextYear = year < max.year;
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1 })), [year]);

  // 열리면 보고 있는 달(같은 해면) 또는 첫 활성 달에 포커스 — 키보드만으로도 고를 수 있게.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const cur = panel.querySelector<HTMLButtonElement>(".mp-month.is-current:not(:disabled)");
    const first = panel.querySelector<HTMLButtonElement>(".mp-month:not(:disabled)");
    (cur ?? first)?.focus({ preventScroll: true });
  }, [year]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 격자 화살표 이동(3열). Enter/Space는 버튼 기본 동작.
  const onGridKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 };
    const d = step[e.key];
    if (d === undefined) {
      if (e.key === "PageUp" && canPrevYear) setYear((y) => y - 1);
      if (e.key === "PageDown" && canNextYear) setYear((y) => y + 1);
      return;
    }
    e.preventDefault();
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>(".mp-month"));
    const i = buttons.findIndex((b) => b === document.activeElement);
    const j = i < 0 ? 0 : Math.max(0, Math.min(11, i + d));
    buttons[j]?.focus();
  };

  // PC 팝오버 좌표 — 제목 바로 아래, 화면 안으로 클램프.
  const popStyle: CSSProperties | undefined =
    !narrow && anchor
      ? {
          left: Math.max(12, Math.min(window.innerWidth - 12 - 292, anchor.left + anchor.width / 2 - 146)),
          top: Math.min(window.innerHeight - 12 - 260, anchor.bottom + 8)
        }
      : undefined;

  // body 포털 — 포스터 래퍼(transform 스케일)가 만드는 스태킹 컨텍스트 안에서는 z-index를 아무리 올려도
  // 좌하단 계정 원(globals 9000, body 직속) 밑에 깔린다(2026-09-27 실측: 모바일 시트의 9월 칸을 덮음).
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className={`mp-backdrop${narrow ? " is-sheet" : " is-pop"}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        aria-label="월 선택"
        aria-modal="true"
        className="mp-panel"
        // 피커가 떠 있는 동안은 키의 주인이다 — 밑의 ←/→(월 이동)·T(오늘) 전역 핸들러까지 안 간다
        // (React 17+의 stopPropagation은 루트 밖 native 리스너도 막는다).
        onKeyDown={(e) => e.stopPropagation()}
        ref={panelRef}
        role="dialog"
        style={popStyle}
      >
        {narrow ? <span aria-hidden="true" className="mp-grab" /> : null}
        <div className="mp-year">
          <button
            aria-label="이전 해"
            className="mp-year-btn"
            disabled={!canPrevYear}
            onClick={() => {
              hapticTick();
              setYear((y) => y - 1);
            }}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={18} strokeWidth={2.4} />
          </button>
          <strong key={year}>{year}년</strong>
          <button
            aria-label="다음 해"
            className="mp-year-btn"
            disabled={!canNextYear}
            onClick={() => {
              hapticTick();
              setYear((y) => y + 1);
            }}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={18} strokeWidth={2.4} />
          </button>
        </div>
        <div className="mp-grid" onKeyDown={onGridKey} role="group" aria-label={`${year}년`}>
          {months.map((ym) => {
            const out = ymCmp(ym, min) < 0 || ymCmp(ym, max) > 0;
            const isCurrent = ym.year === view.year && ym.month === view.month;
            const isToday = ym.year === today.year && ym.month === today.month;
            return (
              <button
                aria-current={isCurrent ? "true" : undefined}
                aria-label={`${ym.year}년 ${ym.month}월${isToday ? " (오늘)" : ""}`}
                className={`mp-month${isCurrent ? " is-current" : ""}${isToday ? " is-today" : ""}`}
                disabled={out}
                key={ym.month}
                onClick={() => {
                  hapticTick();
                  onPick(ym);
                }}
                type="button"
              >
                {ym.month}월
                {isToday ? <i aria-hidden="true" className="mp-today-dot" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── 오늘 플로팅(PC) ─────────────────────────────────────────────────────────
export function TodayFab({
  visible,
  onClick,
  className = ""
}: {
  visible: boolean; // 오늘 달이 아닐 때만 true → 스르륵 떠오른다
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      aria-hidden={!visible}
      className={`today-fab${visible ? " is-visible" : ""} ${className}`}
      data-act="today-fab"
      onClick={onClick}
      tabIndex={visible ? 0 : -1}
      title="오늘이 있는 달로 (T)"
      type="button"
    >
      <CalendarCheck aria-hidden="true" size={20} strokeWidth={2.3} />
      <span className="sr-only">오늘이 있는 달로</span>
    </button>
  );
}

// ── 점프 토스트 ──────────────────────────────────────────────────────────────
export function MonthJumpToast({
  to,
  from,
  onBack
}: {
  to: YM;
  from: YM;
  onBack: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="month-jump-toast" role="status" aria-live="polite">
      <span>{ymLabel(to)}로 이동했어요</span>
      <button className="month-jump-back" data-act="month-jump-back" onClick={onBack} type="button">
        {ymLabel(from)}로 돌아가기
      </button>
    </div>,
    document.body
  );
}
