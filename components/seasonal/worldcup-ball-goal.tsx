"use client";

import { useEffect, useRef, useState } from "react";
import { hapticSuccess, hapticTick } from "@/lib/ui/haptics";
import "./worldcup-ball-goal.css";

// 월드컵 시즌 미니 놀이 — 화면 좌/우에 골대 1개씩, 가운데 공 1개, 양 팀 선수 AI(작은 원)가 공을 두고
// 자동으로 경기한다. 사용자는 마우스로 공을 뺏어(잡아) 골대로 던져 넣을 수 있고, 던진 공이 선수에
// 맞으면 제대로 튕긴다. 골키퍼 AI(🧤)는 골대 앞에서 공을 막는다.
//
// 안전/성능:
//  - 레이어 pointer-events:none(일정 클릭 방해 0). 공·정지버튼만 auto.
//  - 자동 경기는 '지속 모션'이라 WCAG 2.2.2상 정지/켜기 토글을 제공하고, reduced-motion이면 기본 꺼짐.
//  - 위치는 transform translate3d만(reflow 0). 물리/AI는 ref, React state는 최소. 탭 숨김 시 rAF 중단.
//  - 일정/비공개 데이터 무관, export 표면 밖. 부모가 아바타 자리 ON이면 아예 렌더 안 함(골대 가림).

type Vec = { x: number; y: number };
type Side = "left" | "right";
type Player = { team: 0 | 1; fx: number; fy: number; x: number; y: number };

const FRICTION = 0.992;
const WALL_RESTITUTION = 0.8;
const STOP_SPEED = 6;
const BALL = 40;
const GOAL_W = 70;
const GOAL_H = 120;
const GOAL_MARGIN_PX = 6;
const WALL_T = 10;
const DRAG_BUFFER = 100;
const KD = 34; // 골키퍼 원 지름
const KEEPER_SPEED = 360;
const GOAL_COOLDOWN_MS = 1400;
const SAVE_COOLDOWN_MS = 350;
// 선수 AI
const TEAM_N = 10; // 팀당 필드 선수(골키퍼 별도 → 11명 컨셉)
const PLAYER_R = 9;
const PLAYER_SPEED = 150; // 공 쫓는 선수
const SUPPORT_RATIO = 0.55; // 나머지 선수 속도 비율
const CONTROL_SPEED = 150; // 이보다 느린 공은 선수가 '잡아서' 찬다
const KICK_CD = 600; // 연속 차기 방지
const BALL_BOUNCE = 0.82; // 공-선수 튕김

export function WorldCupBallGoal() {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const ballRef = useRef<HTMLDivElement | null>(null);
  const keeperRef = useRef<Record<Side, HTMLDivElement | null>>({ left: null, right: null });
  const playerEls = useRef<(HTMLDivElement | null)[]>([]);
  const [goalFlash, setGoalFlash] = useState(false);
  const [saveFlash, setSaveFlash] = useState<Side | null>(null);
  const [running, setRunning] = useState(true); // 자동 경기 on/off(토글)
  const [confetti, setConfetti] = useState<
    { id: number; left: number; top: number; dx: number; dy: number; rot: number; color: string }[]
  >([]);

  const pos = useRef<Vec>({ x: 0, y: 0 });
  const vel = useRef<Vec>({ x: 0, y: 0 });
  const players = useRef<Player[]>([]);
  const keeperY = useRef<Record<Side, number>>({ left: 0, right: 0 });
  const dragging = useRef(false);
  const runningRef = useRef(true);
  const grabOffset = useRef<Vec>({ x: 0, y: 0 });
  const lastPointer = useRef<{ x: number; y: number; t: number }>({ x: 0, y: 0, t: 0 });
  const pointerVel = useRef<Vec>({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);
  const goalAt = useRef(0);
  const saveAt = useRef(0);
  const kickAt = useRef(0);
  const reduced = useRef(false);
  const confettiId = useRef(0);

  const bounds = () => {
    const el = layerRef.current;
    return { w: el?.clientWidth ?? window.innerWidth, h: el?.clientHeight ?? window.innerHeight };
  };
  const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

  const goalRect = (side: Side) => {
    const { w, h } = bounds();
    const m = GOAL_MARGIN_PX;
    const x = side === "left" ? m : w - m - GOAL_W;
    const y = h * 0.5 - GOAL_H / 2;
    return { x, y, w: GOAL_W, h: GOAL_H };
  };
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
  // 골키퍼는 원. 중심 x는 골대 입구 라인 안쪽, y는 공을 추적.
  const keeperCenterX = (side: Side) => {
    const g = goalRect(side);
    return side === "left" ? g.x + g.w - KD / 2 : g.x + KD / 2;
  };
  // 선수가 들어갈 수 없는 필드 좌우 한계(골대 라인 사이).
  const fieldX = () => {
    const lg = goalRect("left");
    const rg = goalRect("right");
    return { min: lg.x + lg.w + PLAYER_R, max: rg.x - PLAYER_R };
  };

  const place = () => {
    const el = ballRef.current;
    if (el) el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;
  };
  const placeKeepers = () => {
    (["left", "right"] as Side[]).forEach((s) => {
      const el = keeperRef.current[s];
      if (el) el.style.transform = `translate3d(0, ${keeperY.current[s] - KD / 2}px, 0)`;
    });
  };
  const placePlayers = () => {
    players.current.forEach((p, i) => {
      const el = playerEls.current[i];
      if (el) el.style.transform = `translate3d(${p.x - PLAYER_R}px, ${p.y - PLAYER_R}px, 0)`;
    });
  };

  const buildPlayers = () => {
    const { w, h } = bounds();
    const list: Player[] = [];
    for (let t = 0 as 0 | 1; t <= 1; t = (t + 1) as 0 | 1) {
      for (let i = 0; i < TEAM_N; i += 1) {
        const col = i < 5 ? 0 : 1;
        const row = i % 5;
        const fy = 0.14 + row * 0.18;
        const fx = t === 0 ? (col === 0 ? 0.12 : 0.34) : col === 0 ? 0.66 : 0.88;
        list.push({ team: t, fx, fy, x: fx * w, y: fy * h });
      }
      if (t === 1) break;
    }
    players.current = list;
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
    pos.current = { x: w * 0.5, y: h * 0.5 };
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
    const kx = keeperCenterX(side);
    const ky = keeperY.current[side];
    const minD = BALL / 2 + KD / 2;
    const dx = pos.current.x - kx;
    const dy = pos.current.y - ky;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    // 공을 키퍼 밖으로 밀어내고 법선 반사(튕김).
    pos.current.x = kx + ux * minD;
    pos.current.y = ky + uy * minD;
    const vn = vel.current.x * ux + vel.current.y * uy;
    if (vn < 0) {
      vel.current.x -= (1 + BALL_BOUNCE) * vn * ux;
      vel.current.y -= (1 + BALL_BOUNCE) * vn * uy;
    }
    // 필드 쪽으로 확실히 나가게(골대로 다시 안 빨려들게).
    const outward = side === "left" ? 1 : -1;
    if (Math.sign(vel.current.x) !== outward || Math.abs(vel.current.x) < 140) {
      vel.current.x = outward * Math.max(220, Math.abs(vel.current.x));
    }
    // 플래시·햅틱은 쿨다운으로 한 번만(물리 막기는 매 프레임 보장).
    const now = performance.now();
    if (now - saveAt.current > SAVE_COOLDOWN_MS) {
      saveAt.current = now;
      setSaveFlash(side);
      window.setTimeout(() => setSaveFlash((s) => (s === side ? null : s)), 700);
      hapticTick();
    }
  };

  const updateKeepers = (dt: number) => {
    const { w } = bounds();
    (["left", "right"] as Side[]).forEach((side) => {
      const g = goalRect(side);
      const lineX = side === "left" ? g.x + g.w : g.x;
      const onSide = side === "left" ? pos.current.x < w * 0.5 : pos.current.x > w * 0.5;
      const near = Math.abs(pos.current.x - lineX) < w * 0.45;
      const target =
        onSide && near
          ? clamp(pos.current.y, g.y + KD / 2, g.y + g.h - KD / 2)
          : g.y + g.h / 2;
      const stepMax = KEEPER_SPEED * dt;
      const dy = clamp(target - keeperY.current[side], -stepMax, stepMax);
      keeperY.current[side] += dy;
    });
  };

  // 가까운 선수 인덱스(팀별) — 공을 쫓을 '액티브' 선수.
  const nearestByTeam = (): [number, number] => {
    let na = -1;
    let nb = -1;
    let da = Infinity;
    let db = Infinity;
    players.current.forEach((p, i) => {
      const d = Math.hypot(p.x - pos.current.x, p.y - pos.current.y);
      if (p.team === 0 && d < da) {
        da = d;
        na = i;
      } else if (p.team === 1 && d < db) {
        db = d;
        nb = i;
      }
    });
    return [na, nb];
  };

  const updatePlayers = (dt: number, nearest: [number, number]) => {
    const { w, h } = bounds();
    const fx = fieldX();
    players.current.forEach((p, i) => {
      const active = i === nearest[0] || i === nearest[1];
      let tx: number;
      let ty: number;
      if (active) {
        tx = pos.current.x;
        ty = pos.current.y;
      } else {
        // 홈 포지션을 공 쪽으로 살짝 당긴다(팀 전체가 공 따라 흐름).
        const hx = p.fx * w;
        const hy = p.fy * h;
        tx = hx + (pos.current.x - hx) * 0.25;
        ty = hy + (pos.current.y - hy) * 0.25;
      }
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const spd = (active ? PLAYER_SPEED : PLAYER_SPEED * SUPPORT_RATIO);
      const move = Math.min(spd, d * 4) * dt;
      p.x += (dx / d) * move;
      p.y += (dy / d) * move;
      p.x = clamp(p.x, fx.min, fx.max);
      p.y = clamp(p.y, PLAYER_R, h - PLAYER_R);
    });
  };

  const kick = (p: Player) => {
    const enemy: Side = p.team === 0 ? "right" : "left";
    const g = goalRect(enemy);
    const tx = enemy === "left" ? g.x + g.w : g.x;
    const ty = g.y + g.h / 2 + (Math.random() * 2 - 1) * g.h * 0.55;
    const dx = tx - pos.current.x;
    const dy = ty - pos.current.y;
    const d = Math.hypot(dx, dy) || 1;
    const power = 460 + Math.random() * 130;
    vel.current.x = (dx / d) * power;
    vel.current.y = (dy / d) * power;
    kickAt.current = performance.now();
  };

  const resolveCircleAABB = (rect: { x0: number; y0: number; x1: number; y1: number }) => {
    const r = BALL / 2;
    const cx = pos.current.x;
    const cy = pos.current.y;
    const nx = clamp(cx, rect.x0, rect.x1);
    const ny = clamp(cy, rect.y0, rect.y1);
    const dx = cx - nx;
    const dy = cy - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return;
    let d = Math.sqrt(d2);
    let ux: number;
    let uy: number;
    if (d > 0.0001) {
      ux = dx / d;
      uy = dy / d;
    } else {
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

  // 공 vs 선수(원) — 튕김. 반환: 닿았나.
  const bounceBallOffPlayer = (p: Player) => {
    const minD = BALL / 2 + PLAYER_R;
    const dx = pos.current.x - p.x;
    const dy = pos.current.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d >= minD) return false;
    const ux = d > 0.0001 ? dx / d : 1;
    const uy = d > 0.0001 ? dy / d : 0;
    pos.current.x = p.x + ux * minD;
    pos.current.y = p.y + uy * minD;
    const vn = vel.current.x * ux + vel.current.y * uy;
    if (vn < 0) {
      vel.current.x -= (1 + BALL_BOUNCE) * vn * ux;
      vel.current.y -= (1 + BALL_BOUNCE) * vn * uy;
    }
    return true;
  };

  const step = () => {
    const { w, h } = bounds();
    const dt = 1 / 60;
    const run = runningRef.current && !reduced.current;
    updateKeepers(dt);
    const nearest = nearestByTeam();
    if (run && !dragging.current) updatePlayers(dt, nearest);
    placePlayers();

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
      // 골대 단단한 벽(뒤·위·아래) — 입구 한 면으로만 들어올 수 있다.
      for (const side of ["left", "right"] as Side[]) {
        for (const wll of goalWalls(side)) resolveCircleAABB(wll);
      }
    }

    // 공-선수 상호작용: 액티브 선수가 느린 공을 잡으면 슛, 그 외엔 튕김.
    const speed = Math.hypot(vel.current.x, vel.current.y);
    const now = performance.now();
    players.current.forEach((p, i) => {
      const minD = BALL / 2 + PLAYER_R;
      const d = Math.hypot(pos.current.x - p.x, pos.current.y - p.y);
      if (d >= minD) return;
      const isActive = i === nearest[0] || i === nearest[1];
      if (run && !dragging.current && isActive && speed < CONTROL_SPEED && now - kickAt.current > KICK_CD) {
        kick(p);
      } else {
        bounceBallOffPlayer(p);
      }
    });

    place();
    placeKeepers();

    const cx = pos.current.x;
    const cy = pos.current.y;
    const r = BALL / 2;
    let saved = false;
    for (const side of ["left", "right"] as Side[]) {
      const kx = keeperCenterX(side);
      const d = Math.hypot(cx - kx, cy - keeperY.current[side]);
      if (d < r + KD / 2) {
        doSave(side);
        saved = true;
      }
    }
    if (!saved) {
      for (const side of ["left", "right"] as Side[]) {
        const g = goalRect(side);
        if (cx > g.x && cx < g.x + g.w && cy > g.y && cy < g.y + g.h) scoreGoal(side);
      }
    }

    const moving = speed > STOP_SPEED;
    if (dragging.current || moving || (runningRef.current && !reduced.current)) {
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
    if (reduced.current) {
      runningRef.current = false;
      setRunning(false);
    }
    const { h } = bounds();
    keeperY.current.left = h * 0.5;
    keeperY.current.right = h * 0.5;
    buildPlayers();
    resetBall();
    placeKeepers();
    placePlayers();
    if (runningRef.current) ensureLoop();

    const onResize = () => {
      const b = bounds();
      pos.current.x = clamp(pos.current.x, BALL / 2, b.w - BALL / 2);
      pos.current.y = clamp(pos.current.y, BALL / 2, b.h - BALL / 2);
      // 선수 홈 비율 유지하며 위치 재계산(범위 밖 방지).
      players.current.forEach((p) => {
        p.x = clamp(p.x, PLAYER_R, b.w - PLAYER_R);
        p.y = clamp(p.y, PLAYER_R, b.h - PLAYER_R);
      });
      place();
      placeKeepers();
      placePlayers();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (raf.current != null) {
          window.cancelAnimationFrame(raf.current);
          raf.current = null;
        }
      } else if (runningRef.current && !reduced.current) {
        ensureLoop();
      }
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (raf.current != null) window.cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleRunning = () => {
    const next = !runningRef.current;
    runningRef.current = next;
    setRunning(next);
    hapticTick();
    if (next) ensureLoop();
  };

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
    kickAt.current = performance.now(); // 던진 직후 잠깐은 AI가 다시 안 차게
    ensureLoop();
  };

  const edge = `${GOAL_MARGIN_PX}px`;
  const goalStyle = (side: Side): React.CSSProperties => ({
    [side]: edge,
    top: `calc(50% - ${GOAL_H / 2}px)`,
    width: `${GOAL_W}px`,
    height: `${GOAL_H}px`
  });
  const keeperStyle = (side: Side): React.CSSProperties => ({
    [side]: `calc(${edge} + ${GOAL_W - KD}px)`,
    top: "0",
    width: `${KD}px`,
    height: `${KD}px`
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
        />
      ))}
      {/* 선수 div는 개수가 고정(TEAM_N*2)이라 정적으로 렌더 — 위치는 ref+transform으로만 갱신한다
          (players ref 배열을 map하면 ref 변경이 리렌더를 안 일으켜 div가 안 생긴다). */}
      {Array.from({ length: TEAM_N * 2 }).map((_, i) => {
        const team = i < TEAM_N ? 0 : 1;
        return (
          <div
            key={`p-${i}`}
            className={`wc-player wc-team-${team}`}
            style={{ width: `${PLAYER_R * 2}px`, height: `${PLAYER_R * 2}px` }}
            ref={(el) => {
              playerEls.current[i] = el;
            }}
          />
        );
      })}
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
      <button
        type="button"
        className={`wc-toggle ${running ? "on" : ""}`}
        onClick={toggleRunning}
        aria-pressed={running}
      >
        <span className="wc-toggle-ico" aria-hidden="true">{running ? "⏸" : "▶"}</span>
        <span className="wc-toggle-dot" aria-hidden="true" />
        자동 경기
      </button>
      {goalFlash ? <div className="wc-goal-text">GOAL!</div> : null}
      {saveFlash ? <div className={`wc-save-text wc-save-${saveFlash}`}>막았다!</div> : null}
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
