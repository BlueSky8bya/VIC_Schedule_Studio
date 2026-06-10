"use client";

import { useEffect, useRef, useState } from "react";
import { hapticSuccess, hapticTick } from "@/lib/ui/haptics";
import "./worldcup-ball-goal.css";

// 월드컵 시즌 미니 놀이 — 화면 한쪽에 골대 1개, 공 1개. 마우스(또는 터치)로 공을 잡아 골대로 던져
// 넣으면 GOAL + 빵빠레(confetti)만 터진다. 점수·랭킹·서버 저장 없음. 순수 클라 장식 레이어.
//
// 안전/성능 원칙:
//  - 레이어는 pointer-events:none(일정 클릭 방해 0), 공만 pointer-events:auto.
//  - 자동 움직임 없음(공은 사용자가 잡을 때만 움직임) → WCAG 2.2.2 자동모션 토글 불필요.
//  - 위치는 transform translate3d만(레이아웃 reflow 0). 물리는 ref + rAF, React state는 최소.
//  - 일정/비공개 데이터와 무관. export 표면 밖(부모가 surface 밖에 마운트).
//  - prefers-reduced-motion이면 confetti를 확 줄인다.

type Vec = { x: number; y: number };

const FRICTION = 0.992; // 프레임당 감속
const WALL_RESTITUTION = 0.8; // 벽 튕김
const STOP_SPEED = 6; // 이 속도 미만 + 드래그 아님 → 정지(rAF 멈춤)
const BALL = 44; // 공 지름(px)
const GOAL_W = 76; // 골대 입구 폭
const GOAL_H = 104; // 골대 높이
const GOAL_COOLDOWN_MS = 1400;

export function WorldCupBallGoal() {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const ballRef = useRef<HTMLDivElement | null>(null);
  const [goalFlash, setGoalFlash] = useState(false);
  const [confetti, setConfetti] = useState<
    { id: number; left: number; top: number; dx: number; dy: number; rot: number; color: string }[]
  >([]);

  // 물리 상태(렌더 유발 없음).
  const pos = useRef<Vec>({ x: 0, y: 0 });
  const vel = useRef<Vec>({ x: 0, y: 0 });
  const dragging = useRef(false);
  const grabOffset = useRef<Vec>({ x: 0, y: 0 });
  const lastPointer = useRef<{ x: number; y: number; t: number }>({ x: 0, y: 0, t: 0 });
  const pointerVel = useRef<Vec>({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);
  const goalAt = useRef(0);
  const reduced = useRef(false);
  const confettiId = useRef(0);

  // 골대 입구 사각형(레이어 좌표). 왼쪽 아래에 두고 입구는 오른쪽을 향한다.
  const goalRect = () => {
    const el = layerRef.current;
    const w = el?.clientWidth ?? window.innerWidth;
    const h = el?.clientHeight ?? window.innerHeight;
    const x = Math.max(20, w * 0.04);
    const y = h * 0.5 - GOAL_H / 2;
    return { x, y, w: GOAL_W, h: GOAL_H };
  };

  const place = () => {
    const el = ballRef.current;
    if (el) el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;
  };

  const bounds = () => {
    const el = layerRef.current;
    return { w: el?.clientWidth ?? window.innerWidth, h: el?.clientHeight ?? window.innerHeight };
  };

  const burstConfetti = (cx: number, cy: number) => {
    const n = reduced.current ? 8 : 30;
    const colors = ["#e23b3b", "#f4c430", "#3b6fe2", "#34d399", "#ff8fb1", "#ffffff"];
    const parts = Array.from({ length: n }, () => {
      confettiId.current += 1;
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 140;
      return {
        id: confettiId.current,
        left: cx,
        top: cy,
        dx: Math.cos(ang) * spd,
        dy: Math.sin(ang) * spd - 80, // 살짝 위로 퍼졌다 떨어지게
        rot: (Math.random() * 2 - 1) * 540,
        color: colors[(Math.random() * colors.length) | 0]
      };
    });
    setConfetti((cur) => [...cur, ...parts]);
    const ids = new Set(parts.map((p) => p.id));
    window.setTimeout(() => setConfetti((cur) => cur.filter((p) => !ids.has(p.id))), 1100);
  };

  const resetBall = () => {
    const { w, h } = bounds();
    pos.current = { x: w * 0.68, y: h * 0.66 };
    vel.current = { x: 0, y: 0 };
    place();
  };

  const scoreGoal = () => {
    const now = performance.now();
    if (now - goalAt.current < GOAL_COOLDOWN_MS) return;
    goalAt.current = now;
    const g = goalRect();
    burstConfetti(g.x + g.w / 2, g.y + g.h / 2);
    setGoalFlash(true);
    window.setTimeout(() => setGoalFlash(false), 900);
    hapticSuccess();
    // 골 넣은 공은 잠깐 뒤 시작 위치로 되돌린다.
    window.setTimeout(resetBall, 700);
  };

  const step = () => {
    const { w, h } = bounds();
    if (!dragging.current) {
      // 적분 + 마찰
      pos.current.x += vel.current.x * (1 / 60);
      pos.current.y += vel.current.y * (1 / 60);
      vel.current.x *= FRICTION;
      vel.current.y *= FRICTION;
      // 벽 튕김(공 반지름 고려)
      const r = BALL / 2;
      if (pos.current.x < r) {
        pos.current.x = r;
        vel.current.x = -vel.current.x * WALL_RESTITUTION;
      } else if (pos.current.x > w - r) {
        pos.current.x = w - r;
        vel.current.x = -vel.current.x * WALL_RESTITUTION;
      }
      if (pos.current.y < r) {
        pos.current.y = r;
        vel.current.y = -vel.current.y * WALL_RESTITUTION;
      } else if (pos.current.y > h - r) {
        pos.current.y = h - r;
        vel.current.y = -vel.current.y * WALL_RESTITUTION;
      }
    }
    place();
    // 골 판정 — 공 중심이 골대 입구 안.
    const g = goalRect();
    const cx = pos.current.x;
    const cy = pos.current.y;
    if (cx > g.x && cx < g.x + g.w && cy > g.y && cy < g.y + g.h) scoreGoal();

    const speed = Math.hypot(vel.current.x, vel.current.y);
    if (dragging.current || speed > STOP_SPEED) {
      raf.current = window.requestAnimationFrame(step);
    } else {
      raf.current = null;
    }
  };

  const ensureLoop = () => {
    if (raf.current == null) raf.current = window.requestAnimationFrame(step);
  };

  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    resetBall();
    const onResize = () => {
      const { w, h } = bounds();
      pos.current.x = Math.min(Math.max(pos.current.x, BALL / 2), w - BALL / 2);
      pos.current.y = Math.min(Math.max(pos.current.y, BALL / 2), h - BALL / 2);
      place();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
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
    // 최근 포인터 속도(px/s) — 던질 때 쓸 값.
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
    // 던진 속도 = 마지막 포인터 속도(살짝 증폭, 상한 clamp).
    const max = 1400;
    let vx = pointerVel.current.x * 1.1;
    let vy = pointerVel.current.y * 1.1;
    const sp = Math.hypot(vx, vy);
    if (sp > max) {
      vx = (vx / sp) * max;
      vy = (vy / sp) * max;
    }
    vel.current = { x: vx, y: vy };
    ensureLoop();
  };

  return (
    <div className="wc-play" ref={layerRef} aria-hidden="true">
      <div className="wc-goal" style={goalStyle()}>
        <div className="wc-goal-net" />
        <div className="wc-goal-frame" />
      </div>
      <div
        className="wc-ball"
        ref={ballRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        ⚽
      </div>
      {goalFlash ? <div className="wc-goal-text">GOAL!</div> : null}
      {confetti.map((p) => (
        <span
          key={p.id}
          className="wc-confetti"
          style={
            {
              left: `${p.left}px`,
              top: `${p.top}px`,
              background: p.color,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--rot": `${p.rot}deg`
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );

  // 골대 위치(레이어 좌표) → 인라인 스타일.
  function goalStyle(): React.CSSProperties {
    return { left: "max(20px, 4vw)", top: "calc(50% - 52px)", width: `${GOAL_W}px`, height: `${GOAL_H}px` };
  }
}
