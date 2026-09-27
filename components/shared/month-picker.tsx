"use client";

import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { hapticTick } from "@/lib/ui/haptics";
import "./month-picker.css";

// 월 이동 부품 세트 — 편집실·시청자, PC·모바일이 **같은 구현**을 쓴다(AGENTS G-18).
//
//  · MonthTitleButton  제목("2026년 9월")이 곧 버튼. 장식 없음(▾도 없음 — 2026-09-28 소유자, 모바일 포함).
//                      PC는 호버 때 밑줄이 가운데서 그어지며 글자가 액센트로 물든다.
//  · MonthPicker       제목을 누르면 뜨는 월 피커 — PC는 제목 아래 팝오버, 모바일은 바텀 시트. 연도 스테퍼 +
//                      3×4 월 격자. 보고 있는 달 = 선택 링, 오늘 달 = 점. 범위 제한 없음(2026-09-28 소유자:
//                      예전 데뷔 달~오늘+24달 제한은 "전체 다 선택 가능하게"로 폐기).
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

// ── 제목 버튼 ────────────────────────────────────────────────────────────────
export function MonthTitleButton({
  children,
  open,
  onOpen,
  className = "",
  titleRef
}: {
  children: React.ReactNode;
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
      className={`month-title-btn${open ? " is-open" : ""} ${className}`}
      data-act="month-title"
      onClick={(e) => {
        hapticTick();
        onOpen(e.currentTarget.getBoundingClientRect());
      }}
      ref={ref}
      title="다른 달로 이동"
      type="button"
    >
      <span className="month-title-text">{children}</span>
    </button>
  );
}

// ── 월 피커 ──────────────────────────────────────────────────────────────────
export function MonthPicker({
  view,
  today,
  narrow,
  anchor,
  onPick,
  onClose
}: {
  view: YM;
  today: YM;
  narrow: boolean;
  anchor: DOMRect | null; // PC 팝오버 기준(제목 버튼). 모바일은 무시.
  onPick: (ym: YM) => void;
  onClose: () => void;
}) {
  const [year, setYearRaw] = useState(view.year);
  // 해를 바꾸는 방향 — 연도 레일과 월 격자가 그 방향으로 미끄러진다(2026-09-28 소유자: 숫자만 바뀌니
  // 내가 누른 대로 움직였는지 모르겠다). 이웃 해가 레일에 같이 보여 '어디로 가는지'도 읽힌다.
  const [dir, setDir] = useState<"prev" | "next" | "jump">("jump");
  const setYear = (next: number | ((y: number) => number)) => {
    setYearRaw((y) => {
      const n = typeof next === "function" ? next(y) : next;
      setDir(n < y ? "prev" : n > y ? "next" : "jump");
      return n;
    });
  };
  const panelRef = useRef<HTMLDivElement>(null);
  // 연도 레일 끌기·던지기(2026-09-28 소유자: 잡고 휙 던지면 촤르륵). 레일은 해마다 key로 다시 마운트되므로
  // 포인터는 바깥 고정 래퍼가 잡는다. STEP px마다 한 해, 놓는 순간 속도만큼 관성 스텝(간격이 점점 벌어짐).
  const drag = useRef<{ on: boolean; lastX: number; lastT: number; acc: number; moved: number; vx: number }>({
    on: false,
    lastX: 0,
    lastT: 0,
    acc: 0,
    moved: 0,
    vx: 0
  });
  const flingTimers = useRef<number[]>([]);
  // 끌기·관성 중엔 격자·레일의 등장 애니메이션을 끈다 — 해가 한 칸 넘어갈 때마다 격자가 새로 마운트되며
  // 투명→불투명을 반복해 깜빡였다(2026-09-28 소유자: 피로감). 손으로 끄는 동안은 내용만 바뀌면 된다.
  const [scrubbing, setScrubbing] = useState(false);
  const stopFling = () => {
    flingTimers.current.forEach((t) => window.clearTimeout(t));
    flingTimers.current = [];
  };
  useEffect(() => stopFling, []);
  const RAIL_STEP = 32;
  const onRailDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    stopFling();
    setScrubbing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { on: true, lastX: e.clientX, lastT: e.timeStamp, acc: 0, moved: 0, vx: 0 };
    e.currentTarget.classList.add("is-dragging");
  };
  const onRailMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.on) return;
    const dx = e.clientX - d.lastX;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.vx = d.vx * 0.6 + (dx / dt) * 0.4; // px/ms, 살짝 평활
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    d.acc += dx;
    d.moved += Math.abs(dx);
    // 오른쪽으로 끌면 이전 해가 딸려 온다(내용을 끄는 감각).
    while (d.acc >= RAIL_STEP) {
      d.acc -= RAIL_STEP;
      setYear((y) => y - 1);
    }
    while (d.acc <= -RAIL_STEP) {
      d.acc += RAIL_STEP;
      setYear((y) => y + 1);
    }
    // 레일이 손가락을 따라온다(2026-09-28 소유자: 글자만 바뀌면 바꾸는 느낌이 없다). 한 스텝(32px) = 슬롯
    // 한 칸 폭이 되게 비율을 맞춰, 해가 넘어가며 내용이 한 칸 이동하는 순간 이동량이 되감겨 끊김 없이 이어진다.
    const pitch = e.currentTarget.getBoundingClientRect().width / 5;
    e.currentTarget.style.setProperty("--rail-dx", `${(d.acc * pitch) / RAIL_STEP}px`);
  };
  const onRailUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.on) return;
    d.on = false;
    e.currentTarget.classList.remove("is-dragging");
    e.currentTarget.style.setProperty("--rail-dx", "0px"); // 놓으면 가까운 칸으로 스냅(transition)
    // 멈춘 채로 놓으면 던진 게 아니다 — 마지막 움직임에서 80ms 넘게 지났으면 속도 0.
    const v = e.timeStamp - d.lastT > 80 ? 0 : d.vx; // px/ms
    const steps = Math.min(10, Math.round(Math.abs(v) * 9)); // 세게 던져도 10해까지 — 그 너머는 길을 잃는다
    if (steps < 1) {
      setScrubbing(false);
      return;
    }
    const sign = v > 0 ? -1 : 1;
    let delay = 0;
    for (let i = 0; i < steps; i += 1) {
      delay += 38 + i * i * 7; // 촤르륵 — 갈수록 느려진다
      flingTimers.current.push(
        window.setTimeout(() => {
          hapticTick();
          setYear((y) => y + sign);
        }, delay)
      );
    }
    // 마지막 관성 스텝이 끝나면 애니메이션 복귀.
    flingTimers.current.push(window.setTimeout(() => setScrubbing(false), delay + 120));
  };
  // 끌었으면 놓는 자리의 이웃 해 클릭은 무시(끌기의 끝이 클릭으로 새지 않게).
  const onRailClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drag.current.moved > 6) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = 0;
    }
  };
  // 연도는 제한 없이 오간다. 오늘 해로 한 번에 돌아오는 칩만 둔다(멀리 갔을 때).
  const canPrevYear = true;
  const canNextYear = true;
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
          left: Math.max(12, Math.min(window.innerWidth - 12 - 324, anchor.left + anchor.width / 2 - 162)),
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
        className={`mp-panel${scrubbing ? " is-scrubbing" : ""}`}
        // 피커가 떠 있는 동안은 키의 주인이다 — 밑의 ←/→(월 이동)·T(오늘) 전역 핸들러까지 안 간다
        // (React 17+의 stopPropagation은 루트 밖 native 리스너도 막는다).
        onKeyDown={(e) => e.stopPropagation()}
        ref={panelRef}
        role="dialog"
        style={popStyle}
      >
        {narrow ? <span aria-hidden="true" className="mp-grab" /> : null}
        {/* 연도 레일 — 가운데 해가 크고, 양옆 이웃 해는 작고 흐리게. ‹ ›나 이웃 해를 누르면 레일이 그
            방향으로 미끄러진다. 배지 대신 레일 자체가 '지금 어느 해인지·어디로 가는지'를 말한다. */}
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
          <div
            className="mp-rail-drag"
            onClickCapture={onRailClickCapture}
            onPointerCancel={onRailUp}
            onPointerDown={onRailDown}
            onPointerMove={onRailMove}
            onPointerUp={onRailUp}
          >
          <div aria-live="polite" className="mp-rail" data-dir={dir} key={year}>
            {[-2, -1, 0, 1, 2].map((d) => {
              const y = year + d;
              const cls = `mp-rail-y${d === 0 ? " is-cur" : Math.abs(d) === 1 ? " is-near" : " is-far"}${
                y === today.year ? " is-today" : ""
              }`;
              return d === 0 ? (
                <strong className={cls} key={d}>
                  {y}년
                </strong>
              ) : (
                <button
                  aria-label={`${y}년으로`}
                  className={cls}
                  key={d}
                  onClick={() => {
                    hapticTick();
                    setYear(y);
                  }}
                  tabIndex={-1}
                  type="button"
                >
                  {y}
                </button>
              );
            })}
          </div>
          </div>
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
        <div aria-label={`${year}년`} className="mp-grid" data-dir={dir} key={`g${year}`} onKeyDown={onGridKey} role="group">
          {months.map((ym) => {
            const out = false;
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
        {/* 오늘 달로 — 연도만 되감는 게 아니라 곧장 이번 달을 고른다(2026-09-28 소유자). 격자 폭을 다 쓰는
            버튼 하나. 이미 이번 달을 보고 있고 그 해에 있을 때만 숨긴다. */}
        {!(year === today.year && view.year === today.year && view.month === today.month) ? (
          <button
            className="mp-today-btn"
            data-act="mp-today"
            onClick={() => {
              hapticTick();
              onPick(today);
            }}
            type="button"
          >
            <CalendarCheck aria-hidden="true" size={16} strokeWidth={2.4} />
            <span>오늘로</span>
            <em>{ymLabel(today)}</em>
          </button>
        ) : null}
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
