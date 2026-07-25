"use client";

// 방송 판서 창(B안, PLAN-20260725-001 M4a) — 방송 중 일정을 크게 띄워 설명하는 일회성 도구.
//
// 보안 계약(G2 합의):
// - 이 컴포넌트는 공개 DTO(BroadcastPanelDay[])와 달력 칸 골격(MonthCell)만 props로 받는다.
//   StudioSchedule/StudioScheduleEvent/studio-loader 타입 import 금지(정적 테스트로 고정).
// - 서버 저장 없음. Clipboard·localStorage·sessionStorage·IndexedDB·URL 어디에도 안 남긴다.
//   닫힘 = unmount = 전체 소멸(M4c에서 dispose 테스트).
//
// UX 계약(M4a):
// - 같은 창 전체화면 '불투명' 모달 — 뒤에 비공개 화면이 비치지 않는다(방송 화면 공유 안전).
// - role="dialog" + aria-modal + 포커스 trap + 최초 포커스 + body scroll lock.
//   닫힌 뒤 포커스 복귀는 호출자(진입 버튼) 책임.
// - Esc 우선순위: 날짜 선택이 있으면 선택 해제만(useCellRangeSelect가 처리), 없으면 닫기.
// - 미니 달력에서 떨어진 날짜를 다중선택(드래그·Ctrl·Shift) → "판서판으로 보내기" →
//   아래 판서판에 날짜순으로 나란히. 기존 일정 Ctrl+C/V와 무관한 명시 버튼 액션.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";

import type { BroadcastPanelDay, BroadcastPanelEvent } from "@/lib/schedules/broadcast-dto";
import type { MonthCell } from "@/lib/calendar/month";
import { splitEventTitle } from "@/lib/calendar/month";
import { useCellRangeSelect } from "@/lib/calendar/use-cell-range-select";
import { hapticTick } from "@/lib/ui/haptics";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Props = {
  monthLabel: string; // 예: "2026년 7월"
  cells: MonthCell[]; // 42칸 골격(날짜·요일·이번달 여부) — 일정 데이터는 days에서만
  days: BroadcastPanelDay[]; // 이번 달 전체 공개 DTO(dateKey → 카드)
  sentDateKeys: string[]; // 판서판에 올라간 날짜들(호출자 state — 날짜순 정렬 완료)
  onSend: (dateKeys: string[]) => void; // "판서판으로 보내기"(정렬·dedup은 호출자/DTO 규칙)
  onClose: () => void;
};

function EventCard({ event }: { event: BroadcastPanelEvent }) {
  if (event.teaser) {
    // 서버가 가린 떡밥 — 공개 화면과 같은 문법: 내용 없이 '가림' 룩만.
    return (
      <div className="bp-card bp-teaser" aria-label="공개 전 일정">
        <strong aria-hidden="true">🔮 ???</strong>
      </div>
    );
  }
  const { main, subs } = splitEventTitle(event.publicTitle);
  const fill = event.tags.find((t) => t.isPrimary)?.colorHex ?? event.tags[0]?.colorHex ?? null;
  return (
    <div className="bp-card" style={fill ? { background: fill } : undefined}>
      <div className="bp-card-head">
        {event.isTentative ? <span className="bp-tentative">미정</span> : null}
        <strong>{main}</strong>
        {event.dayIndex && event.dayTotal ? (
          <em className="bp-day-badge">
            {event.dayIndex}일차/{event.dayTotal}일
          </em>
        ) : null}
      </div>
      {subs.length > 0 ? (
        <ul className="bp-subs">
          {subs.map((sub, i) => (
            <li key={i}>{sub}</li>
          ))}
        </ul>
      ) : null}
      {event.tags.length > 1 ? (
        <span className="bp-dots" aria-hidden="true">
          {event.tags
            .filter((t) => !t.isPrimary && t.colorHex)
            .map((t) => (
              <i key={t.id} style={{ background: t.colorHex ?? undefined }} />
            ))}
        </span>
      ) : null}
    </div>
  );
}

export function BroadcastPanel({ monthLabel, cells, days, sentDateKeys, onSend, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const sendBtnRef = useRef<HTMLButtonElement | null>(null);

  const eventsByDate = useMemo(
    () => new Map(days.map((d) => [d.dateKey, d.events] as const)),
    [days]
  );

  // 미니 달력 다중선택 — 편집 그리드와 완전히 분리된 자체 인스턴스(D2).
  // 보내기 버튼은 exempt: 누르는 순간 onDocDown이 선택을 지우는 것 방지(D2-b).
  // escapeClears:false — Esc 의미(선택 해제 vs 닫기)는 아래 단일 핸들러가 결정한다(G3a:
  // 훅·패널 핸들러가 경쟁하면 리스너 순서와 오래된 ref 읽기에 의존하게 된다).
  const rangeSelect = useCellRangeSelect<HTMLDivElement>({
    exemptRefs: [sendBtnRef],
    escapeClears: false
  });

  const selectedDateKeys = useCallback(() => {
    const out: string[] = [];
    for (const i of rangeSelect.getSelected()) {
      const cell = cells[i];
      if (cell?.inCurrentMonth) out.push(cell.isoDate); // 전월/익월 회색 날짜 제외(Q3)
    }
    return out;
  }, [cells, rangeSelect]);

  function handleSend() {
    const keys = selectedDateKeys();
    if (keys.length === 0) return;
    hapticTick();
    onSend(keys);
    rangeSelect.clearSelection();
  }

  // Esc 우선순위(G0-rr·G3a): 이 핸들러 '하나'가 결정한다 — 선택 있으면 해제만, 없으면 닫기.
  // (훅의 Esc 처리는 escapeClears:false로 꺼서 리스너 순서 경쟁이 아예 없다.)
  // 전역 단축키 차단은 호출자(studio-shell)가 broadcastOpen 가드로 수행 — 여기선 Esc/Tab만.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (rangeSelect.getSelected().size > 0) {
          rangeSelect.clearSelection();
          return;
        }
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      // 단순 포커스 trap: 패널 안 포커스 가능한 요소들 사이에서 순환.
      const root = rootRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, rangeSelect]);

  // 최초 포커스 + body scroll lock(열림 동안 뒤 화면 스크롤 금지).
  useEffect(() => {
    closeBtnRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const sentDays: BroadcastPanelDay[] = sentDateKeys.map((dateKey) => ({
    dateKey,
    events: eventsByDate.get(dateKey) ?? []
  }));

  return (
    <div className="broadcast-panel" role="dialog" aria-modal="true" aria-label="방송 판서" ref={rootRef}>
      <header className="bp-header">
        <h2>🖊️ 방송 판서</h2>
        <p className="bp-hint">
          아래 달력에서 날짜를 고르고(드래그·Ctrl 클릭) <strong>판서판으로 보내기</strong> —
          창을 닫으면 모두 사라져요
        </p>
        <button
          aria-label="방송 판서 닫기"
          className="bp-close"
          onClick={onClose}
          ref={closeBtnRef}
          type="button"
        >
          <X aria-hidden="true" size={20} strokeWidth={3} />
        </button>
      </header>

      <section className="bp-picker" aria-label={`${monthLabel} 날짜 선택`}>
        <div className="bp-picker-head">
          <strong>{monthLabel}</strong>
          <button
            className="bp-send"
            disabled={selectedDateKeys().length === 0}
            onClick={handleSend}
            ref={sendBtnRef}
            type="button"
          >
            판서판으로 보내기{selectedDateKeys().length > 0 ? ` (${selectedDateKeys().length})` : ""}
          </button>
        </div>
        <div className="bp-weekdays" aria-hidden="true">
          {WEEKDAYS.map((w, i) => (
            <span className={i === 0 ? "sun" : i === 6 ? "sat" : ""} key={w}>
              {w}
            </span>
          ))}
        </div>
        <div className="bp-mini-grid" ref={rangeSelect.setRef}>
          {cells.map((cell, i) => {
            const has = (eventsByDate.get(cell.isoDate)?.length ?? 0) > 0;
            const inMonth = cell.inCurrentMonth;
            const picked = inMonth && rangeSelect.selected.has(i);
            const cls = [
              "bp-mini-cell",
              inMonth ? "" : "outside",
              picked ? "picked" : "",
              cell.weekday === 0 ? "sun" : cell.weekday === 6 ? "sat" : ""
            ]
              .filter(Boolean)
              .join(" ");
            // 회색(전월/익월) 날짜: data-cell-index를 아예 안 달아 선택 시작·드래그 anchor·
            // picked 대상에서 제외(Q3 — 전송 단계가 아니라 '선택 자체'에서 막는다, G3a).
            // 키보드: Enter/Space = Ctrl+클릭과 같은 개별 토글(toggleIndex) — 마우스 없이도 사용 가능.
            return (
              <div
                aria-checked={picked}
                aria-label={`${Number(cell.isoDate.slice(5, 7))}월 ${cell.dayOfMonth}일${has ? " (일정 있음)" : ""}`}
                className={cls}
                data-cell-index={inMonth ? i : undefined}
                key={cell.isoDate}
                role={inMonth ? "checkbox" : undefined}
                aria-hidden={inMonth ? undefined : true}
                tabIndex={inMonth ? 0 : undefined}
                onKeyDown={
                  inMonth
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          hapticTick();
                          rangeSelect.toggleIndex(i);
                        }
                      }
                    : undefined
                }
              >
                <span className="bp-mini-num">{cell.dayOfMonth}</span>
                {has ? <i className="bp-mini-dot" aria-hidden="true" /> : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="bp-board" aria-label="판서판">
        {sentDays.length === 0 ? (
          <p className="bp-empty">
            보낸 날짜가 여기에 나란히 붙어요 — 떨어진 토·일도 골라서 비교해보세요
          </p>
        ) : (
          <div className="bp-board-strip">
            {sentDays.map((day) => (
              <article className="bp-day-col" key={day.dateKey}>
                <header className="bp-day-head">
                  <strong>{Number(day.dateKey.slice(8, 10))}</strong>
                  {/* date-key는 이미 KST 달력 날짜 — 요일은 그 날짜 자체의 요일(UTC 자정으로
                      해석해 getUTCDay). +09:00으로 파싱하면 UTC 기준 전날로 밀려 요일이 틀린다. */}
                  <span>{WEEKDAYS[new Date(`${day.dateKey}T00:00:00Z`).getUTCDay()]}</span>
                </header>
                {day.events.length === 0 ? (
                  <p className="bp-day-empty">일정 없음</p>
                ) : (
                  day.events.map((ev) => <EventCard event={ev} key={`${day.dateKey}-${ev.id}`} />)
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
