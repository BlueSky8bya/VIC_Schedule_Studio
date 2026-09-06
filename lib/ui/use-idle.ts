"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * 잠깐 쓰고 마는 **떠 있는 배지**용 — 방금 바뀌었을 땐 또렷하고, 손을 떼면 스스로 조용해진다.
 *
 * 왜 필요한가(2026-09-06 소유자: "달력 확대 배지가 달력 내용을 방해한다"): 확대 배율 배지는 화면 하단
 * 중앙에 fixed로 떠 달력 칸 위에 겹친다. 항상 또렷하면 방해가 되고, 아예 없애면 "지금 몇 %인지"와
 * "되돌리기"를 잃는다. 그래서 **역할이 끝나면 물러나고 부르면 온다**: `key`(배율)가 바뀌면 깨어나
 * `ms` 동안 또렷하다가 잠들고, 포인터가 가까이 오거나 포커스가 들어오면 즉시 다시 깨어난다.
 *
 * 잠든 모습(작게·옅게·라벨 접기)은 CSS가 `[data-idle="1"]`로 정한다 — 여기서는 상태만 센다.
 *
 * **왜 근접 감지인가**: 잠든 배지에 `pointer-events: none`을 주면 아래 달력이 온전히 클릭되지만(가림 0),
 * 그러면 hover로 깨울 수가 없어 컨트롤이 죽는다. 그래서 `el` + `within`을 주면 잠든 동안만 창 전체의
 * pointermove를 듣고 배지 사각형에서 `within`px 안으로 들어오면 깨운다 — 다가가면 살아나고, 그 전엔
 * 클릭이 그대로 달력에 닿는다. 리스너는 **잠든 동안에만** 붙고 rAF로 한 프레임에 한 번만 계산한다.
 */
export function useIdleAfter(
  key: unknown,
  opts: { ms?: number; el?: RefObject<HTMLElement | null>; within?: number } = {}
): { idle: boolean; wake: () => void } {
  const { ms = 2400, el, within = 90 } = opts;
  const [idle, setIdle] = useState(false);
  const idleRef = useRef(false);
  idleRef.current = idle;
  const timer = useRef<number | null>(null);

  const wake = useCallback(() => {
    if (typeof window === "undefined") return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    // 이미 깨어 있으면 렌더를 새로 돌리지 않는다 — pointermove마다 setState 하면 확대 중 프레임을 갉아먹는다.
    if (idleRef.current) setIdle(false);
    timer.current = window.setTimeout(() => setIdle(true), ms);
  }, [ms]);

  useEffect(() => {
    wake();
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [key, wake]);

  // 근접하면 깨운다 — 잠든 동안에만 듣는다.
  useEffect(() => {
    if (!idle || !el) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    const check = () => {
      raf = 0;
      const node = el.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      if (r.width <= 0) return;
      const dx = Math.max(r.left - x, 0, x - r.right);
      const dy = Math.max(r.top - y, 0, y - r.bottom);
      if (Math.hypot(dx, dy) <= within) wake();
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = window.requestAnimationFrame(check);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [idle, el, within, wake]);

  return { idle, wake };
}
