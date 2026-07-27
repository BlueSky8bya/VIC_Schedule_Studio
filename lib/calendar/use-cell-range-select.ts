"use client";

import { useCallback, useRef, useState, type RefObject } from "react";

// 달력 날짜 칸을 마우스로 드래그해 '직선(날짜 연속) 범위'로 "선택"만 한다(시각 강조).
// - 마우스 전용: 터치는 기존 스크롤/롱프레스(휴방 메뉴)와 충돌하지 않게 건드리지 않는다.
// - 시각 전용: 서버에 아무것도 안 쓴다. 선택된 칸 인덱스 Set을 React state로 들고 있어,
//   소비자가 className에 .cell-range-selected를 넣는다. (명령형 DOM class 토글은 카드 드래그 등
//   다른 state 변화로 칸이 리렌더되면 React가 className을 덮어써 선택이 지워지는 버그가 있었다.)
// - 텍스트 긁힘 방지: 드래그 동안 body에 .cell-range-dragging을 달아 user-select를 끈다.
// 칸 식별: 그리드 안의 [data-cell-index] 요소(0..41). 두 인덱스 사이를 읽기순(좌→우, 주 넘어감)
// 으로 연속 채운다 — 8일~16일을 고르면 정사각형이 아니라 그 날짜들이 이어져 선택된다.
// 토(월말)에서 다음 일(다음 주 시작)로 드래그해도 자연히 이어진다.
//
// 반환:
//   setRef         — 그리드에 다는 callback ref(useEqualChainHeights와 합쳐 단다)
//   selected       — 선택된 칸 인덱스 Set (className 분기에 사용)
//   getSelected    — 명령형 조회(이벤트 핸들러에서 최신값 필요할 때)
//   clearSelection — 명령형 전체 초기화. Set뿐 아니라 lastAnchor·진행 중 드래그·click
//                    suppression까지 리셋한다 — 월 이동 뒤 Shift 선택이 이전 달 anchor를
//                    재사용하는 것 방지(PLAN-20260725-001 D2-b).

const DRAG_BODY_CLASS = "cell-range-dragging";
const MOVE_THRESHOLD = 5; // 이만큼 움직여야 드래그(=선택) 시작 — 단순 클릭은 그대로 통과

type Options = {
  enabled?: boolean;
  // 이 요소들 '안'에서 시작한 pointerdown은 그리드 밖이어도 선택을 지우지 않는다 —
  // "판서판으로 보내기" 버튼·도구줄처럼 선택을 '소비'하는 UI가 클릭 전에 선택을
  // 잃지 않게 한다(onDocDown이 click보다 먼저 오는 문제, D2-b).
  exemptRefs?: RefObject<HTMLElement | null>[];
  // false면 훅이 Esc를 처리하지 않는다 — 소비자가 Esc 의미를 직접 결정할 때(판서 모달:
  // 선택 있으면 해제, 없으면 닫기 — 핸들러 두 개가 경쟁하면 리스너 순서에 의존하게 된다, G3a).
  escapeClears?: boolean;
  // true면 '수식키 없는 클릭'도 개별 토글(체크박스 문법) — 판서 날짜 피커처럼 다중 선택이
  // 기본 의도인 소비자용. 드래그는 여전히 범위 선택(기존과 동일). 기본 false(시트 문법:
  // 클릭=단일 선택으로 교체 — 편집실 달력 등 기존 소비자 동작 불변).
  clickToggles?: boolean;
};

function sameSet(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const v of a) {
    if (!b.has(v)) {
      return false;
    }
  }
  return true;
}

export function useCellRangeSelect<T extends HTMLElement>({
  enabled = true,
  exemptRefs,
  escapeClears = true,
  clickToggles = false
}: Options = {}): {
  setRef: (el: T | null) => void;
  selected: Set<number>;
  getSelected: () => Set<number>;
  clearSelection: () => void;
  toggleIndex: (index: number) => void;
} {
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const cleanupRef = useRef<(() => void) | null>(null);
  // setRef 클로저 내부(anchor·드래그·suppressClick)를 밖에서 리셋할 통로.
  const resetInternalsRef = useRef<(() => void) | null>(null);
  const exemptRefsRef = useRef(exemptRefs);
  exemptRefsRef.current = exemptRefs;

  const apply = useCallback((next: Set<number>) => {
    if (!sameSet(selectedRef.current, next)) {
      setSelected(next);
    }
  }, []);

  const getSelected = useCallback(() => selectedRef.current, []);
  const clearSelection = useCallback(() => {
    resetInternalsRef.current?.();
    apply(new Set());
  }, [apply]);
  // 키보드 선택 경로(Enter/Space) — Ctrl+클릭과 같은 '개별 토글'. 포인터 훅과 같은 Set을 쓰고,
  // Shift 확장 기준(lastAnchor)도 Ctrl+클릭과 동일하게 갱신한다(G3a-r WARN: 안 하면 키보드
  // 토글 뒤 Shift+클릭이 과거 마우스 앵커에 붙는다).
  const syncAnchorRef = useRef<((index: number) => void) | null>(null);
  const toggleIndex = useCallback(
    (index: number) => {
      const next = new Set(selectedRef.current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      apply(next);
      syncAnchorRef.current?.(index);
    },
    [apply]
  );

  const setRef = useCallback(
    (grid: T | null) => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (!grid || !enabled || typeof window === "undefined") {
        return;
      }

      let anchor: number | null = null; // 현재 드래그/범위의 기준(드래그 끝나면 초기화)
      let lastAnchor: number | null = null; // Shift 범위 확장용 기준(클릭 사이 유지)
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let suppressClick = false;

      const indexAt = (x: number, y: number): number | null => {
        const el = document.elementFromPoint(x, y) as HTMLElement | null;
        const cell = el?.closest<HTMLElement>("[data-cell-index]");
        if (!cell || !grid.contains(cell)) {
          return null;
        }
        const i = Number(cell.dataset.cellIndex);
        return Number.isFinite(i) ? i : null;
      };

      // 두 칸 사이를 인덱스 순서(=날짜 순서)로 연속 채운다. 사각형이 아니라 직선 범위.
      const range = (a: number, b: number): Set<number> => {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        const out = new Set<number>();
        for (let i = lo; i <= hi; i += 1) {
          out.add(i);
        }
        return out;
      };

      const onMove = (e: PointerEvent) => {
        if (anchor == null) {
          return;
        }
        if (!dragging) {
          if (
            Math.abs(e.clientX - startX) < MOVE_THRESHOLD &&
            Math.abs(e.clientY - startY) < MOVE_THRESHOLD
          ) {
            return;
          }
          dragging = true;
          suppressClick = true; // 드래그였으니 뒤따르는 click(=날짜선택 등)은 한 번 무시
          document.body.classList.add(DRAG_BODY_CLASS);
        }
        e.preventDefault();
        const cur = indexAt(e.clientX, e.clientY);
        if (cur != null) {
          apply(range(anchor, cur));
        }
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.classList.remove(DRAG_BODY_CLASS);
        anchor = null;
        dragging = false;
      };

      const onDown = (e: PointerEvent) => {
        suppressClick = false; // 새 입력 시작 — 직전 드래그 잔재 초기화
        if (e.pointerType !== "mouse" || e.button !== 0) {
          return;
        }
        const target = e.target as HTMLElement;
        // 카드/버튼/링크/입력/스티커 위에서 시작하면 선택 안 함(그 요소 동작 우선).
        if (
          target.closest(
            "button, a, input, textarea, select, label, .studio-event-pill, [data-sticker-layer], [data-sticker-avoid]"
          )
        ) {
          return;
        }
        const cell = target.closest<HTMLElement>("[data-cell-index]");
        if (!cell || !grid.contains(cell)) {
          return;
        }
        const i = Number(cell.dataset.cellIndex);
        if (!Number.isFinite(i)) {
          return;
        }
        dragging = false;
        startX = e.clientX;
        startY = e.clientY;
        // 구글 시트식 다중선택:
        //  - Shift: 기준(lastAnchor)부터 누른 칸까지 직선(날짜 연속)으로 확장(드래그도 그 기준에서).
        //  - Ctrl/⌘: 누른 칸을 개별로 토글(기존 선택 유지).
        //  - 평소: 누른 칸 하나만(기준 갱신). 드래그하면 범위.
        if (e.shiftKey && lastAnchor != null) {
          anchor = lastAnchor;
          apply(range(lastAnchor, i));
        } else if (e.ctrlKey || e.metaKey || clickToggles) {
          // Ctrl/⌘ — 개별 토글. clickToggles 소비자(판서 날짜 피커)는 '수식키 없는 클릭'도
          // 같은 토글(체크박스 문법) — 드래그로 이어지면 아래 onMove가 범위로 대체한다.
          const next = new Set(selectedRef.current);
          if (next.has(i)) next.delete(i);
          else next.add(i);
          apply(next);
          anchor = i;
          lastAnchor = i;
        } else {
          anchor = i;
          lastAnchor = i;
          apply(new Set([i]));
        }
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      };

      // 드래그 직후의 click은 캡처 단계에서 막아 React onClick(날짜 선택)까지 도달하지 않게 한다.
      const onClickCapture = (e: MouseEvent) => {
        if (suppressClick) {
          e.stopPropagation();
          e.preventDefault();
          suppressClick = false;
        }
      };

      // 명령형 초기화 — 선택 Set 외의 클로저 상태(anchor·드래그·suppressClick)까지 리셋해야
      // 해제 후 Shift 선택이 과거 anchor를 재사용하지 않는다(G3a: Esc·바깥 클릭 경로도 동일).
      const resetInternals = () => {
        anchor = null;
        lastAnchor = null;
        dragging = false;
        suppressClick = false;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.classList.remove(DRAG_BODY_CLASS);
      };
      const clearAll = () => {
        resetInternals();
        apply(new Set());
      };
      resetInternalsRef.current = resetInternals;
      syncAnchorRef.current = (index: number) => {
        anchor = null; // 드래그 진행값은 건드리지 않고 Shift 기준만 갱신
        lastAnchor = index;
      };

      // 그리드 밖을 누르면 선택 해제, Esc도 해제(escapeClears=false면 소비자 몫). exempt 영역
      // (보내기 버튼·도구줄)은 선택을 '쓰는' 곳이라 예외 — 클릭 전에 선택을 지우지 않는다.
      const onDocDown = (e: PointerEvent) => {
        const t = e.target as Node;
        if (grid.contains(t)) return;
        const exempt = exemptRefsRef.current?.some((r) => r.current?.contains(t) ?? false);
        if (exempt) return;
        clearAll();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape" && escapeClears) {
          clearAll();
        }
      };

      grid.addEventListener("pointerdown", onDown);
      grid.addEventListener("click", onClickCapture, true);
      document.addEventListener("pointerdown", onDocDown);
      document.addEventListener("keydown", onKey);

      cleanupRef.current = () => {
        grid.removeEventListener("pointerdown", onDown);
        grid.removeEventListener("click", onClickCapture, true);
        document.removeEventListener("pointerdown", onDocDown);
        document.removeEventListener("keydown", onKey);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.classList.remove(DRAG_BODY_CLASS);
        resetInternalsRef.current = null;
      };
    },
    [enabled, apply, escapeClears, clickToggles]
  );

  return { setRef, selected, getSelected, clearSelection, toggleIndex };
}
