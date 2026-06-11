"use client";

import { useEffect, useRef, useState } from "react";
import { hapticTick } from "@/lib/ui/haptics";
import { reduceMotionEnabled } from "@/lib/ui/motion"; // OS reduce-motion 무시, 앱 토글만
import "./worldcup-studio-ball.css";

// 편집실용 — 중력 받는 축구공 1개. 화면 안에서 마우스로 잡아 던지면 떨어지고 바닥/벽에 튕기다
// 굴러 멈춘다. 골대·선수·점수 없음. 월드컵 기간에만(부모가 그때만 마운트). 일정 작업 방해 0
// (레이어 pointer-events:none, 공만 auto). 위치는 transform만(reflow 0), 멈추면 rAF 중단.

const BALL = 64; // 시청자 모바일·웹 공용 — 너무 크지 않게(모바일 화면폭의 ~16%)
const GRAVITY = 1700; // px/s^2
const REST = 0.66; // 바닥/벽 튕김
const AIR = 0.999; // 공기저항(아주 약하게)
const ROLL_FRICTION = 0.985; // 바닥에서 구를 때 수평 감속
const STOP = 10;

// pauseWhenMinigameOn: 시청자 화면에선 미니게임이 켜지면 중력공을 숨긴다(둘 다 뜨면 어수선).
// 편집실(미니게임 없음)에선 false로 줘 항상 보이게.
export function WorldCupStudioBall({ pauseWhenMinigameOn = true }: { pauseWhenMinigameOn?: boolean }) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const ballRef = useRef<HTMLDivElement | null>(null);
  const pos = useRef({ x: 0, y: 0 });
  const vel = useRef({ x: 0, y: 0 });
  const spin = useRef(0); // 굴러가는 회전각(시각용)
  const dragging = useRef(false);
  const grabOffset = useRef({ x: 0, y: 0 });
  const lastPointer = useRef({ x: 0, y: 0, t: 0 });
  const pointerVel = useRef({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);
  const reduced = useRef(false);
  const ghostPrev = useRef({ x: 0, y: 0, t: 0 }); // 드래그한 일정 카드의 직전 중심(속도 추정)
  // 미니게임이 켜져 있으면 중력공은 숨긴다(둘 다 뜨면 어수선). 초기값=미니게임 enabled(localStorage
  // "off"가 아니면 켜짐). WorldCupBallGoal이 토글마다 'wc-minigame-enabled' 이벤트로 알린다.
  const [hidden, setHidden] = useState<boolean>(() => {
    if (!pauseWhenMinigameOn || typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("vic.worldcupGame") !== "off";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (!pauseWhenMinigameOn) return;
    const onMini = (e: Event) => setHidden(!!(e as CustomEvent).detail?.enabled);
    window.addEventListener("wc-minigame-enabled", onMini);
    return () => window.removeEventListener("wc-minigame-enabled", onMini);
  }, [pauseWhenMinigameOn]);
  // 숨길 땐 물리 루프 중단(보이지도 않는데 돌 필요 없음).
  useEffect(() => {
    if (hidden && raf.current != null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
  }, [hidden]);

  const bounds = () => {
    const el = layerRef.current;
    return { w: el?.clientWidth ?? window.innerWidth, h: el?.clientHeight ?? window.innerHeight };
  };
  const place = () => {
    const el = ballRef.current;
    if (el) {
      el.style.transform = `translate3d(${pos.current.x - BALL / 2}px, ${pos.current.y - BALL / 2}px, 0) rotate(${spin.current}deg)`;
    }
  };

  const step = () => {
    const { w, h } = bounds();
    const dt = 1 / 60;
    const r = BALL / 2;
    const floor = h - r;
    if (!dragging.current) {
      vel.current.y += GRAVITY * dt;
      pos.current.x += vel.current.x * dt;
      pos.current.y += vel.current.y * dt;
      vel.current.x *= AIR;
      vel.current.y *= AIR;
      // 좌우 벽
      if (pos.current.x < r) {
        pos.current.x = r;
        vel.current.x = -vel.current.x * REST;
      } else if (pos.current.x > w - r) {
        pos.current.x = w - r;
        vel.current.x = -vel.current.x * REST;
      }
      // 천장
      if (pos.current.y < r) {
        pos.current.y = r;
        vel.current.y = -vel.current.y * REST;
      }
      // 바닥 — 튕기고, 굴러가다 멈춤.
      if (pos.current.y > floor) {
        pos.current.y = floor;
        vel.current.y = -vel.current.y * REST;
        if (Math.abs(vel.current.y) < 60) vel.current.y = 0; // 작은 튕김은 멈춘다
        vel.current.x *= ROLL_FRICTION; // 바닥 마찰로 구르다 감속
      }
      spin.current += vel.current.x * dt * 1.2; // 수평 속도만큼 회전
    }

    // 드래그 중인 일정 카드(.event-drag-ghost)와 충돌 — 카드를 휘두르면 공이 맞고 튕긴다.
    const ghostHit = collideDragGhost();

    place();

    const onFloor = pos.current.y >= floor - 0.5;
    const slow = Math.abs(vel.current.x) < STOP && Math.abs(vel.current.y) < STOP;
    if (dragging.current || ghostHit || !(onFloor && slow)) {
      raf.current = window.requestAnimationFrame(step);
    } else {
      raf.current = null;
    }
  };

  // 드래그 중인 일정 카드 사각형과 공(원) 충돌. 카드 이동속도를 공에 실어준다(휘두르면 날아감).
  const collideDragGhost = (): boolean => {
    const ghost = document.querySelector(".event-drag-ghost") as HTMLElement | null;
    const layer = layerRef.current;
    if (!ghost || !layer) {
      ghostPrev.current.t = 0;
      return false;
    }
    const gr = ghost.getBoundingClientRect();
    const lr = layer.getBoundingClientRect();
    const x0 = gr.left - lr.left;
    const y0 = gr.top - lr.top;
    const x1 = gr.right - lr.left;
    const y1 = gr.bottom - lr.top;
    const gcx = (x0 + x1) / 2;
    const gcy = (y0 + y1) / 2;
    const now = performance.now();
    let gvx = 0;
    let gvy = 0;
    if (ghostPrev.current.t) {
      const dtg = Math.max(8, now - ghostPrev.current.t);
      gvx = ((gcx - ghostPrev.current.x) / dtg) * 1000;
      gvy = ((gcy - ghostPrev.current.y) / dtg) * 1000;
    }
    ghostPrev.current = { x: gcx, y: gcy, t: now };
    if (dragging.current) return true; // 공 잡는 중이면 물리 안 검(루프만 유지)

    const r = BALL / 2;
    const cx = pos.current.x;
    const cy = pos.current.y;
    const nx = Math.max(x0, Math.min(cx, x1));
    const ny = Math.max(y0, Math.min(cy, y1));
    const dx = cx - nx;
    const dy = cy - ny;
    let d = Math.hypot(dx, dy);
    if (d >= r) return true; // 카드 있음(루프 유지) — 닿진 않음
    let ux: number;
    let uy: number;
    if (d > 0.0001) {
      ux = dx / d;
      uy = dy / d;
    } else {
      const l = cx - x0;
      const rr = x1 - cx;
      const tp = cy - y0;
      const bt = y1 - cy;
      const m = Math.min(l, rr, tp, bt);
      ux = m === l ? -1 : m === rr ? 1 : 0;
      uy = m === tp ? -1 : m === bt ? 1 : 0;
      if (ux === 0 && uy === 0) uy = -1;
      d = 0;
    }
    pos.current.x += ux * (r - d);
    pos.current.y += uy * (r - d);
    // 상대속도 기반 반사 + 카드 속도 전달.
    const rvx = vel.current.x - gvx;
    const rvy = vel.current.y - gvy;
    const vn = rvx * ux + rvy * uy;
    if (vn < 0) {
      vel.current.x -= (1 + REST) * vn * ux;
      vel.current.y -= (1 + REST) * vn * uy;
    }
    return true;
  };
  const ensureLoop = () => {
    if (raf.current == null) raf.current = window.requestAnimationFrame(step);
  };

  useEffect(() => {
    reduced.current = reduceMotionEnabled(); // OS reduce-motion 무시 — 앱 토글만
    const { w, h } = bounds();
    pos.current = { x: w * 0.5, y: reduced.current ? h - BALL / 2 : h * 0.3 };
    vel.current = { x: 0, y: 0 };
    place();
    if (!reduced.current) ensureLoop(); // 처음 한 번 톡 떨어뜨린다(reduced면 바닥에 둔다)

    const onResize = () => {
      const b = bounds();
      pos.current.x = Math.min(Math.max(pos.current.x, BALL / 2), b.w - BALL / 2);
      pos.current.y = Math.min(Math.max(pos.current.y, BALL / 2), b.h - BALL / 2);
      place();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (raf.current != null) {
          window.cancelAnimationFrame(raf.current);
          raf.current = null;
        }
      }
    };
    // 일정 카드를 끌고 휘두르는 동안엔(고스트 존재) 멈춰 있던 공도 깨워 충돌 판정이 돌게 한다.
    const onDocMove = () => {
      if (document.querySelector(".event-drag-ghost")) ensureLoop();
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("pointermove", onDocMove, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointermove", onDocMove);
      if (raf.current != null) window.cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragging.current = true;
    const rect = layerRef.current?.getBoundingClientRect();
    const lx = e.clientX - (rect?.left ?? 0);
    const ly = e.clientY - (rect?.top ?? 0);
    grabOffset.current = { x: lx - pos.current.x, y: ly - pos.current.y };
    lastPointer.current = { x: lx, y: ly, t: performance.now() };
    pointerVel.current = { x: 0, y: 0 };
    vel.current = { x: 0, y: 0 };
    hapticTick();
    ensureLoop();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const rect = layerRef.current?.getBoundingClientRect();
    const lx = e.clientX - (rect?.left ?? 0);
    const ly = e.clientY - (rect?.top ?? 0);
    pos.current.x = lx - grabOffset.current.x;
    pos.current.y = ly - grabOffset.current.y;
    const now = performance.now();
    const dt = Math.max(8, now - lastPointer.current.t);
    pointerVel.current = {
      x: ((lx - lastPointer.current.x) / dt) * 1000,
      y: ((ly - lastPointer.current.y) / dt) * 1000
    };
    lastPointer.current = { x: lx, y: ly, t: now };
    place();
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    const max = 1500;
    let vx = pointerVel.current.x * 1.15;
    let vy = pointerVel.current.y * 1.15;
    const sp = Math.hypot(vx, vy);
    if (sp > max) {
      vx = (vx / sp) * max;
      vy = (vy / sp) * max;
    }
    vel.current = { x: vx, y: vy };
    ensureLoop();
  };

  return (
    <div
      className="wcsb-layer"
      ref={layerRef}
      aria-hidden="true"
      style={hidden ? { display: "none" } : undefined}
    >
      <div
        className="wcsb-ball"
        ref={ballRef}
        style={{ width: `${BALL}px`, height: `${BALL}px` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        ⚽
      </div>
    </div>
  );
}
