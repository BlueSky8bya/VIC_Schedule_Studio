"use client";

import { useEffect, useRef, useState } from "react";
import { hapticSuccess, hapticTick } from "@/lib/ui/haptics";
import "./worldcup-ball-goal.css";

// 월드컵 시즌 미니 놀이 — 화면 좌/우에 골대 1개씩, 가운데 공 1개. 마우스(터치)로 공을 잡아 골대로
// 던져 넣으면 GOAL + 빵빠레. 각 골대 앞엔 간단한 골키퍼 AI가 공 Y를 따라 움직이며 막는다(최대
// 속도 제한이라 구석으로 빠르게 차면 뚫린다 = 실력 요소). 막히면 공이 튕겨 나오고 "막았다!".
//
// 안전/성능: 레이어 pointer-events:none(일정 클릭 방해 0), 공만 auto. 자동 움직임 없음(잡을 때만)
// → WCAG 2.2.2 토글 불필요. 위치는 transform translate3d만(reflow 0), 물리는 ref+rAF, 정지 시 중단.
// 일정/비공개 데이터 무관, export 표면 밖(부모가 surface 밖 마운트). reduced-motion이면 confetti 축소.

type Vec = { x: number; y: number };
type Side = "left" | "right";

const FRICTION = 0.992;
const WALL_RESTITUTION = 0.8;
const STOP_SPEED = 6;
const BALL = 44;
const GOAL_W = 70;
const GOAL_H = 120;
const GOAL_MARGIN_PX = 6; // 화면 가장자리에 바짝 붙인다
const WALL_T = 10; // 골대 뒤/위/아래 단단한 벽 두께(입구만 열림 → 한 면으로만 골)
const DRAG_BUFFER = 100; // 골대 입구 앞 이 거리 안으론 드래그 못 함 → 반드시 던져 넣어야 함
const KW = 16; // 골키퍼 폭
const KH = 50; // 골키퍼 높이
const KEEPER_SPEED = 360; // px/s — 낮을수록 뚫기 쉬움
const GOAL_COOLDOWN_MS = 1400;
const SAVE_COOLDOWN_MS = 350;

export function WorldCupBallGoal() {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const ballRef = useRef<HTMLDivElement | null>(null);
  const keeperRef = useRef<Record<Side, HTMLDivElement | null>>({ left: null, right: null });
  const [goalFlash, setGoalFlash] = useState(false);
  const [saveFlash, setSaveFlash] = useState<Side | null>(null);
  const [confetti, setConfetti] = useState<
    { id: number; left: number; top: number; dx: number; dy: number; rot: number; color: string }[]
  >([]);

  const pos = useRef<Vec>({ x: 0, y: 0 });
  const vel = useRef<Vec>({ x: 0, y: 0 });
  const keeperY = useRef<Record<Side, number>>({ left: 0, right: 0 });
  const dragging = useRef(false);
  const grabOffset = useRef<Vec>({ x: 0, y: 0 });
  const lastPointer = useRef<{ x: number; y: number; t: number }>({ x: 0, y: 0, t: 0 });
  const pointerVel = useRef<Vec>({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);
  const goalAt = useRef(0);
  const saveAt = useRef(0);
  const reduced = useRef(false);
  const confettiId = useRef(0);

  const bounds = () => {
    const el = layerRef.current;
    return { w: el?.clientWidth ?? window.innerWidth, h: el?.clientHeight ?? window.innerHeight };
  };
  const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

  // 골대 net 박스(레이어 좌표). 화면 좌/우 끝에 바짝.
  const goalRect = (side: Side) => {
    const { w, h } = bounds();
    const m = GOAL_MARGIN_PX;
    const x = side === "left" ? m : w - m - GOAL_W;
    const y = h * 0.5 - GOAL_H / 2;
    return { x, y, w: GOAL_W, h: GOAL_H };
  };
  // 골대의 단단한 벽 3면(뒤·위·아래). 입구(필드 쪽 면)만 열려 있어 그쪽으로만 골이 된다.
  const goalWalls = (side: Side) => {
    const g = goalRect(side);
    const back =
      side === "left"
        ? { x0: g.x - WALL_T, y0: g.y - WALL_T, x1: g.x, y1: g.y + g.h + WALL_T }
        : { x0: g.x + g.w, y0: g.y - WALL_T, x1: g.x + g.w + WALL_T, y1: g.y + g.h + WALL_T };
    const top = { x0: g.x, y0: g.y - WALL_T, x1: g.x + g.w, y1: g.y };
    const bottom = { x0: g.x, y0: g.y + g.h, x1: g.x + g.w, y1: g.y + g.h + WALL_T };
    return [back, top, bottom];
  };
  // 골키퍼 박스(net 입구 앞쪽, 필드 쪽 면).
  const keeperRect = (side: Side) => {
    const g = goalRect(side);
    const x0 = side === "left" ? g.x + g.w - KW : g.x;
    const cy = keeperY.current[side];
    return { x0, y0: cy - KH / 2, x1: x0 + KW, y1: cy + KH / 2 };
  };

  const place = () => {
    const el = ballRef.current;
    if (el) el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;
  };
  const placeKeepers = () => {
    (["left", "right"] as Side[]).forEach((s) => {
      const el = keeperRef.current[s];
      if (el) el.style.transform = `translate3d(0, ${keeperY.current[s] - KH / 2}px, 0)`;
    });
  };

  const burstConfetti = (cx: number, cy: number) => {
    const n = reduced.current ? 8 : 32;
    const colors = ["#e23b3b", "#f4c430", "#3b6fe2", "#34d399", "#ff8fb1", "#ffffff"];
    const parts = Array.from({ length: n }, () => {
      confettiId.current += 1;
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 150;
      return {
        id: confettiId.current,
        left: cx,
        top: cy,
        dx: Math.cos(ang) * spd,
        dy: Math.sin(ang) * spd - 90,
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
    pos.current = { x: w * 0.5, y: h * 0.62 };
    vel.current = { x: 0, y: 0 };
    place();
  };

  const scoreGoal = (side: Side) => {
    const now = performance.now();
    if (now - goalAt.current < GOAL_COOLDOWN_MS) return;
    goalAt.current = now;
    const g = goalRect(side);
    burstConfetti(g.x + g.w / 2, g.y + g.h / 2);
    setGoalFlash(true);
    window.setTimeout(() => setGoalFlash(false), 900);
    hapticSuccess();
    window.setTimeout(resetBall, 700);
  };

  const doSave = (side: Side) => {
    const now = performance.now();
    if (now - saveAt.current < SAVE_COOLDOWN_MS) return;
    saveAt.current = now;
    // 공을 필드 쪽으로 튕겨낸다 + 키퍼 중심에서 벗어난 만큼 y로 흩어지게.
    const outward = side === "left" ? 1 : -1;
    const sp = Math.max(220, Math.abs(vel.current.x) * 0.92);
    vel.current.x = outward * sp;
    vel.current.y += (pos.current.y - keeperY.current[side]) * 5;
    vel.current.y = clamp(vel.current.y, -700, 700);
    setSaveFlash(side);
    window.setTimeout(() => setSaveFlash((s) => (s === side ? null : s)), 700);
    hapticTick();
  };

  const updateKeepers = (dt: number) => {
    const { w } = bounds();
    (["left", "right"] as Side[]).forEach((side) => {
      const g = goalRect(side);
      const lineX = side === "left" ? g.x + g.w : g.x;
      const onSide = side === "left" ? pos.current.x < w * 0.5 : pos.current.x > w * 0.5;
      const near = Math.abs(pos.current.x - lineX) < w * 0.45;
      // 활성: 공이 자기 반쪽 + 사정거리. 아니면 골대 중앙으로 천천히 복귀.
      const target = onSide && near
        ? clamp(pos.current.y, g.y + KH / 2, g.y + g.h - KH / 2)
        : g.y + g.h / 2;
      const stepMax = KEEPER_SPEED * dt;
      const dy = clamp(target - keeperY.current[side], -stepMax, stepMax);
      keeperY.current[side] += dy;
    });
  };

  const hitRect = (cx: number, cy: number, r: number, x0: number, y0: number, x1: number, y1: number) => {
    const nx = clamp(cx, x0, x1);
    const ny = clamp(cy, y0, y1);
    return Math.hypot(cx - nx, cy - ny) < r;
  };

  // 공(원) vs 단단한 사각벽 충돌 → 밀어내고 법선 방향 속도 반사(튕김).
  const resolveCircleAABB = (rect: { x0: number; y0: number; x1: number; y1: number }) => {
    const r = BALL / 2;
    const cx = pos.current.x;
    const cy = pos.current.y;
    const nx = clamp(cx, rect.x0, rect.x1);
    const ny = clamp(cy, rect.y0, rect.y1);
    let dx = cx - nx;
    let dy = cy - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return;
    let d = Math.sqrt(d2);
    let ux: number;
    let uy: number;
    if (d > 0.0001) {
      ux = dx / d;
      uy = dy / d;
    } else {
      // 중심이 벽 내부 — 가장 가까운 면으로 밀어낸다.
      const left = cx - rect.x0;
      const right = rect.x1 - cx;
      const top = cy - rect.y0;
      const bot = rect.y1 - cy;
      const m = Math.min(left, right, top, bot);
      ux = m === left ? -1 : m === right ? 1 : 0;
      uy = m === top ? -1 : m === bot ? 1 : 0;
      if (ux === 0 && uy === 0) uy = -1;
      d = 0;
    }
    const overlap = r - d;
    pos.current.x += ux * overlap;
    pos.current.y += uy * overlap;
    const vn = vel.current.x * ux + vel.current.y * uy;
    if (vn < 0) {
      vel.current.x -= (1 + WALL_RESTITUTION) * vn * ux;
      vel.current.y -= (1 + WALL_RESTITUTION) * vn * uy;
    }
  };

  const step = () => {
    const { w, h } = bounds();
    const dt = 1 / 60;
    updateKeepers(dt);

    if (!dragging.current) {
      pos.current.x += vel.current.x * dt;
      pos.current.y += vel.current.y * dt;
      vel.current.x *= FRICTION;
      vel.current.y *= FRICTION;
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
    // 골대 단단한 벽(뒤·위·아래) 충돌 → 튕김. 입구(필드 쪽 한 면)만 열려 그쪽으로만 들어올 수 있다.
    if (!dragging.current) {
      for (const side of ["left", "right"] as Side[]) {
        for (const wll of goalWalls(side)) resolveCircleAABB(wll);
      }
    }
    place();
    placeKeepers();

    const cx = pos.current.x;
    const cy = pos.current.y;
    const r = BALL / 2;
    let saved = false;
    // 키퍼 막기 먼저(골보다 우선).
    for (const side of ["left", "right"] as Side[]) {
      const k = keeperRect(side);
      if (hitRect(cx, cy, r, k.x0, k.y0, k.x1, k.y1)) {
        doSave(side);
        saved = true;
      }
    }
    // 골 판정 — 공 중심이 net 안쪽. 3면이 막혀 있어 입구로 들어왔을 때만 도달 가능(=한 면 골).
    if (!saved) {
      for (const side of ["left", "right"] as Side[]) {
        const g = goalRect(side);
        if (cx > g.x && cx < g.x + g.w && cy > g.y && cy < g.y + g.h) scoreGoal(side);
      }
    }

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
    const { h } = bounds();
    keeperY.current.left = h * 0.5;
    keeperY.current.right = h * 0.5;
    resetBall();
    placeKeepers();
    const onResize = () => {
      const b = bounds();
      pos.current.x = clamp(pos.current.x, BALL / 2, b.w - BALL / 2);
      pos.current.y = clamp(pos.current.y, BALL / 2, b.h - BALL / 2);
      place();
      placeKeepers();
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
    // 골대 입구 앞 DRAG_BUFFER 안으론 끌고 들어갈 수 없다 → 거리에서 던져 넣어야 골.
    for (const side of ["left", "right"] as Side[]) {
      const g = goalRect(side);
      const inBand = pos.current.y > g.y - DRAG_BUFFER && pos.current.y < g.y + g.h + DRAG_BUFFER;
      if (!inBand) continue;
      if (side === "left") {
        const limit = g.x + g.w + DRAG_BUFFER;
        if (pos.current.x < limit) pos.current.x = limit;
      } else {
        const limit = g.x - DRAG_BUFFER;
        if (pos.current.x > limit) pos.current.x = limit;
      }
    }
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
    const max = 1400;
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

  const edge = `${GOAL_MARGIN_PX}px`;
  const goalStyle = (side: Side): React.CSSProperties => ({
    [side]: edge,
    top: `calc(50% - ${GOAL_H / 2}px)`,
    width: `${GOAL_W}px`,
    height: `${GOAL_H}px`
  });
  // 키퍼 wrapper x — net 입구 앞면. translateY는 매 프레임 JS가 갱신.
  const keeperStyle = (side: Side): React.CSSProperties => ({
    [side]: `calc(${edge} + ${GOAL_W - KW}px)`,
    top: "0",
    width: `${KW}px`,
    height: `${KH}px`
  });

  return (
    <div className="wc-play" ref={layerRef} aria-hidden="true">
      {(["left", "right"] as Side[]).map((side) => (
        <div className={`wc-goal wc-goal-${side}`} key={side} style={goalStyle(side)}>
          <div className="wc-goal-net" />
          <div className="wc-goal-frame" />
        </div>
      ))}
      {(["left", "right"] as Side[]).map((side) => (
        <div
          key={`k-${side}`}
          className={`wc-keeper wc-keeper-${side}`}
          style={keeperStyle(side)}
          ref={(el) => {
            keeperRef.current[side] = el;
          }}
        >
          🧤
        </div>
      ))}
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
      {saveFlash ? (
        <div className={`wc-save-text wc-save-${saveFlash}`}>막았다!</div>
      ) : null}
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
}
