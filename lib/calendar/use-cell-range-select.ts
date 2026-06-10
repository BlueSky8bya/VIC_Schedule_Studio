"use client";

import { useCallback, useRef } from "react";

// 구글 시트처럼 달력 날짜 칸을 마우스로 드래그해 사각형 범위로 "선택"만 한다(시각 강조).
// - 마우스 전용: 터치는 기존 스크롤/롱프레스(휴방 메뉴)와 충돌하지 않게 건드리지 않는다.
// - 시각 전용: 서버에 아무것도 안 쓴다. 칸 DOM에 .cell-range-selected 클래스만 토글한다
//   (거대한 컴포넌트 리렌더 없이 가볍게, 일정 데이터/권한 경계와 무관).
// - 텍스트 긁힘 방지: 드래그 동안 body에 .cell-range-dragging을 달아 user-select를 끈다.
// 칸 식별: 그리드 안의 [data-cell-index] 요소(0..41), 7열 기준 행/열로 사각형을 칠한다.
//
// 반환은 callback ref다(useEqualChainHeights와 동일 패턴) — 그리드가 미리보기/월이동 등으로
// 통째로 (언)마운트돼도 React가 항상 새 요소로 재설정해 리스너가 정확히 따라붙는다.

const SELECTED_CLASS = "cell-range-selected";
const DRAG_BODY_CLASS = "cell-range-dragging";
const MOVE_THRESHOLD = 5; // 이만큼 움직여야 드래그(=선택) 시작 — 단순 클릭은 그대로 통과

type Options = {
  enabled?: boolean;
  cols?: number;
};

export function useCellRangeSelect<T extends HTMLElement>(
  { enabled = true, cols = 7 }: Options = {}
): (el: T | null) => void {
  const cleanupRef = useRef<(() => void) | null>(null);

  return useCallback(
    (grid: T | null) => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (!grid || !enabled || typeof window === "undefined") {
        return;
      }

      let anchor: number | null = null;
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let suppressClick = false;

      const cells = () => Array.from(grid.querySelectorAll<HTMLElement>("[data-cell-index]"));

      const clearSelection = () => {
        for (const c of cells()) {
          c.classList.remove(SELECTED_CLASS);
        }
      };

      const indexAt = (x: number, y: number): number | null => {
        const el = document.elementFromPoint(x, y) as HTMLElement | null;
        const cell = el?.closest<HTMLElement>("[data-cell-index]");
        if (!cell || !grid.contains(cell)) {
          return null;
        }
        const i = Number(cell.dataset.cellIndex);
        return Number.isFinite(i) ? i : null;
      };

      const paint = (a: number, b: number) => {
        const r1 = Math.floor(a / cols);
        const c1 = a % cols;
        const r2 = Math.floor(b / cols);
        const c2 = b % cols;
        const rLo = Math.min(r1, r2);
        const rHi = Math.max(r1, r2);
        const cLo = Math.min(c1, c2);
        const cHi = Math.max(c1, c2);
        for (const cell of cells()) {
          const i = Number(cell.dataset.cellIndex);
          const r = Math.floor(i / cols);
          const c = i % cols;
          const on = r >= rLo && r <= rHi && c >= cLo && c <= cHi;
          cell.classList.toggle(SELECTED_CLASS, on);
        }
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
          paint(anchor, cur);
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
        anchor = i;
        dragging = false;
        startX = e.clientX;
        startY = e.clientY;
        clearSelection(); // 시트처럼 새 드래그는 기존 선택을 지우고 시작
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

      // 그리드 밖을 누르면 선택 해제, Esc도 해제.
      const onDocDown = (e: PointerEvent) => {
        if (!grid.contains(e.target as Node)) {
          clearSelection();
        }
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          clearSelection();
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
      };
    },
    [enabled, cols]
  );
}
