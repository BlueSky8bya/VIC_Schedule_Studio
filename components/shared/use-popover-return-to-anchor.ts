"use client";

import { useRef, type KeyboardEvent, type PointerEvent, type MouseEvent } from "react";
import { logActivity } from "@/lib/activity/client";
import "./popover-return-grip.css";

/** The existing grip gains one explicit action; normal drag memory stays owned
 * by its window. A release following a drag cannot become a double-click reset. */
export function usePopoverReturnToAnchor(enabled: boolean, reset: () => void, target: "detail-return-to-anchor" | "editor-return-to-anchor") {
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const suppressUntil = useRef(0);
  const markDragged = () => { suppressUntil.current = performance.now() + 600; };
  const activate = () => {
    if (!enabled) return;
    reset();
    logActivity("ui.click", { target });
  };
  return {
    markDragged,
    bind: {
      role: "button" as const,
      "data-act": target,
      "data-activity-manual": "",
      tabIndex: enabled ? 0 : -1,
      "aria-label": "창 위치 복원",
      title: "끌어서 이동 · 두 번 눌러 위치 복원",
      onPointerDownCapture: (e: PointerEvent<HTMLDivElement>) => {
        if (!enabled || e.button !== 0) return;
        e.currentTarget.focus({ preventScroll: true });
        pointer.current = { x: e.clientX, y: e.clientY };
      },
      onPointerMoveCapture: (e: PointerEvent<HTMLDivElement>) => {
        if (pointer.current && e.buttons && Math.hypot(e.clientX - pointer.current.x, e.clientY - pointer.current.y) >= 3) markDragged();
      },
      onPointerUpCapture: () => { pointer.current = null; },
      onPointerCancelCapture: () => { pointer.current = null; markDragged(); },
      onDoubleClick: (e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation();
        if (performance.now() >= suppressUntil.current) activate();
      },
      onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.nativeEvent.isComposing || e.repeat || e.altKey || e.ctrlKey || e.metaKey || !["Enter", " "].includes(e.key)) return;
        e.preventDefault(); e.stopPropagation(); activate();
      }
    }
  };
}
