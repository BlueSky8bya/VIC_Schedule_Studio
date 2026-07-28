"use client";

import { useCallback, useEffect, useRef } from "react";
import { hapticTick } from "@/lib/ui/haptics";

// 바텀시트 '끌어서 닫기'(애플 시트 문법 — HCI 벤치마크 B1).
//
// - 손잡이/헤더를 잡고 끌면 시트가 손가락에 1:1로 붙어 내려온다(직접 조작).
// - 위로 끌면 러버밴딩 저항(UIScrollView 수식 f(x)=x·d·c/(d+c·x), c=0.55) — 막다른 벽이 아니라
//   탄성으로 '여기가 끝'을 알린다.
// - 놓는 순간의 속도가 결과를 정한다: 빠르게 튕기거나(플릭) 1/3 이상 내려가 있으면 닫힘,
//   아니면 스프링으로 제자리 복귀. 닫힘 확정 임계값을 지나는 순간 햅틱 틱 1회(재진입 시 재무장).
// - 폼 스크롤과 충돌하지 않게 드래그는 잡는 영역(bind를 얹은 요소)에서만 시작된다.
// - reduce-motion(html[data-reduce-motion])이면 복귀/퇴장을 애니메이션 없이 즉시 처리한다.
type Options = {
  /** 닫힘 확정 시(퇴장 애니메이션이 끝난 뒤) 호출 — 보통 setState(null). */
  onClose: () => void;
};

const CLOSE_RATIO = 0.33; // 시트 높이 대비 이만큼 내려가면 닫힘
const FLICK_VELOCITY = 0.8; // px/ms — 이보다 빠른 플릭은 거리와 무관하게 닫힘
const DRAG_SLOP = 6; // px — 이 미만 움직임은 탭(클릭)으로 취급

const rubber = (x: number, dim: number, c = 0.55) => (x * dim * c) / (dim + c * x);

function reduceMotionOn() {
  return document.documentElement.hasAttribute("data-reduce-motion");
}

export function useSheetDragClose({ onClose }: Options) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{
    pointerId: number;
    startY: number;
    dy: number;
    moved: boolean;
    /** 최근 이동 샘플(속도 계산용) */
    samples: { t: number; y: number }[];
    thresholdArmed: boolean;
  } | null>(null);
  const closingRef = useRef(false);
  const suppressClickRef = useRef(false);

  // 시트가 언마운트될 때 남은 rAF/타이머 정리용.
  const rafRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const setY = (y: number) => {
    const el = sheetRef.current;
    if (el) el.style.transform = y === 0 ? "" : `translateY(${y}px)`;
  };

  // 제자리 복귀 — rAF 스프링(릴리스 속도를 초기 속도로 승계, 중단 가능).
  const springBack = useCallback((fromY: number, velocity: number) => {
    if (reduceMotionOn()) {
      setY(0);
      return;
    }
    let x = fromY;
    let v = velocity * 1000; // px/ms → px/s
    let last = performance.now();
    const stiffness = 380;
    const damping = 30;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      v += (-stiffness * x - damping * v) * dt;
      x += v * dt;
      if (Math.abs(v) < 4 && Math.abs(x) < 0.5) {
        setY(0);
        rafRef.current = null;
        return;
      }
      setY(x);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const finishClose = useCallback(
    () => {
      const el = sheetRef.current;
      closingRef.current = true;
      hapticTick(); // 닫힘 확정
      if (!el || reduceMotionOn()) {
        onClose();
        closingRef.current = false;
        return;
      }
      const h = el.offsetHeight;
      el.style.transition = "transform 0.22s cubic-bezier(0.3, 0, 0.8, 0.15)";
      el.style.transform = `translateY(${h + 24}px)`;
      window.setTimeout(() => {
        onClose();
        closingRef.current = false;
        // 시트가 리마운트될 수 있으니 인라인 스타일은 정리해 둔다.
        el.style.transition = "";
        el.style.transform = "";
      }, 210);
    },
    [onClose]
  );

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (closingRef.current) return;
    // 마우스 오른쪽 버튼 등 무시. 터치·펜·좌클릭만.
    if (e.button !== 0) return;
    const el = sheetRef.current;
    if (!el) return;
    // 등장 애니메이션이 아직 돌고 있으면 끊는다 — 인라인 transform이 이겨야 1:1 추적이 된다.
    el.style.animation = "none";
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    drag.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      dy: 0,
      moved: false,
      samples: [{ t: performance.now(), y: e.clientY }],
      thresholdArmed: true
    };
    // 주의: 여기서 setPointerCapture를 걸면 안 된다 — 캡처가 걸린 순간부터 click이 캡처
    // 요소(m-sheet-top)로 향해, 안의 X·손잡이 onClick이 영영 안 불린다(실측 버그).
    // 캡처는 슬롭(6px)을 넘어 '진짜 드래그'가 된 순간에만 건다(onPointerMove).
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    const el = sheetRef.current;
    if (!d || !el || e.pointerId !== d.pointerId) return;
    const raw = e.clientY - d.startY;
    d.dy = raw;
    if (!d.moved && Math.abs(raw) > DRAG_SLOP) {
      d.moved = true;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(d.pointerId);
      } catch {
        // 캡처 실패해도 그립 존 안에서의 드래그는 그대로 동작한다.
      }
    }
    d.samples.push({ t: performance.now(), y: e.clientY });
    if (d.samples.length > 6) d.samples.shift();
    const h = el.offsetHeight || 1;
    // 아래로는 1:1, 위로는 러버밴딩 저항.
    const y = raw >= 0 ? raw : -rubber(-raw, h);
    setY(y);
    // 닫힘 임계값 통과 순간 틱(다시 올라가면 재무장 — 연속 제스처의 노치).
    const past = raw > h * CLOSE_RATIO;
    if (past && d.thresholdArmed) {
      d.thresholdArmed = false;
      hapticTick();
    } else if (!past && !d.thresholdArmed) {
      d.thresholdArmed = true;
    }
  }, []);

  const endDrag = useCallback(
    (e: React.PointerEvent, cancelled: boolean) => {
      const d = drag.current;
      const el = sheetRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      drag.current = null;
      if (!el) return;
      const h = el.offsetHeight || 1;
      // 릴리스 속도(px/ms) — 최근 샘플 구간으로 계산(아래 방향 양수).
      const first = d.samples[0];
      const lastSample = d.samples[d.samples.length - 1];
      const dt = Math.max(1, lastSample.t - first.t);
      const velocity = (lastSample.y - first.y) / dt;
      if (d.moved) {
        // 이 제스처의 꼬리 click(손잡이의 onClick=닫기)만 삼킨다. click은 pointerup 직후
        // 같은 시퀀스로 오므로, 다음 태스크(setTimeout 0)에서 반드시 해제 — 브라우저가
        // 드래그로 판단해 click을 아예 안 쏘는 경우에 플래그가 남아 다음 정상 클릭(X)까지
        // 삼키던 버그의 수정.
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
      if (!cancelled && d.moved && (d.dy > h * CLOSE_RATIO || velocity > FLICK_VELOCITY)) {
        finishClose();
        return;
      }
      // 복귀 — 현재 표시 위치(위쪽 러버밴딩 반영)에서 스프링으로.
      const currentY = d.dy >= 0 ? d.dy : -rubber(-d.dy, h);
      if (currentY !== 0) springBack(currentY, cancelled ? 0 : velocity);
    },
    [finishClose, springBack]
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => endDrag(e, false), [endDrag]);
  const onPointerCancel = useCallback((e: React.PointerEvent) => endDrag(e, true), [endDrag]);

  // 드래그였다면 뒤따라오는 click(손잡이의 onClick=닫기)을 한 번 삼킨다 — 취소하려고
  // 되돌려 놓은 시트가 클릭 판정으로 닫혀버리는 오동작 방지.
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return {
    sheetRef,
    dragBind: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture }
  };
}
