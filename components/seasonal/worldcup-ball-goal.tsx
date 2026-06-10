"use client";

import { useEffect, useRef, useState } from "react";
import { hapticSuccess, hapticTick } from "@/lib/ui/haptics";
import "./worldcup-ball-goal.css";

// 월드컵 시즌 미니 놀이 — 좌/우 골대, 공 1개, 양 팀 4-3-3 선수 AI(작은 원)가 자동으로 경기한다.
// 사용자는 마우스로 공을 뺏어 골대로 던질 수 있고(공이 선수에 맞으면 튕김), 골키퍼 AI가 막는다.
// 이벤트 전체 on/off + 자동경기 on/off 토글 제공(둘 다 localStorage 저장). 월드컵 기간에만 부모가
// 이 컴포넌트를 마운트하므로 토글도 그 기간에만 보인다.
//
// 안전/성능: 레이어 pointer-events:none(일정 클릭 방해 0), 공·토글만 auto. 자동경기는 지속 모션이라
// WCAG 2.2.2 토글 제공 + reduced-motion 기본 꺼짐 + 탭 숨김 시 rAF 중단. transform만(reflow 0).

type Vec = { x: number; y: number };
type Side = "left" | "right";
type Player = { team: 0 | 1; bx: number; by: number; fast: boolean; x: number; y: number };

const FRICTION = 0.992;
const WALL_RESTITUTION = 0.8;
const STOP_SPEED = 6;
const BALL = 40;
const GOAL_W = 70;
const GOAL_H = 120;
const GOAL_MARGIN_PX = 6;
const WALL_T = 10;
const DRAG_BUFFER = 100;
const KD = 26; // 골키퍼 원 지름(작게 — 입구를 덜 덮어 골이 들어갈 틈)
const KEEPER_SPEED = 205; // px/s — 반응지연·오차와 함께 '뚫리는' 키퍼를 만든다
const GOAL_COOLDOWN_MS = 1400;
const SAVE_COOLDOWN_MS = 350;
const PLAYER_R = 9;
const PLAYER_SPEED = 165; // 공 쫓는 선수
const BALL_BOUNCE = 0.82;
const CONTROL_SPEED = 150; // 이보다 느린 공은 가까운 선수가 잡아서 찬다
const KICK_CD = 520;
const MARGIN_Y_FRAC = 0.07;

// 4-3-3 포메이션(공격 방향 기준 bx: 0=자기 골, 1=상대 골 / by: 0=위, 1=아래). fast=전방 침투형.
const FORMATION: { bx: number; by: number; fast: boolean }[] = [
  { bx: 0.18, by: 0.1, fast: false }, // LB
  { bx: 0.1, by: 0.36, fast: false }, // LCB
  { bx: 0.1, by: 0.64, fast: false }, // RCB
  { bx: 0.18, by: 0.9, fast: false }, // RB
  { bx: 0.33, by: 0.5, fast: false }, // DM
  { bx: 0.47, by: 0.3, fast: false }, // LCM
  { bx: 0.47, by: 0.7, fast: false }, // RCM
  { bx: 0.7, by: 0.12, fast: true }, // LW
  { bx: 0.84, by: 0.5, fast: true }, // ST
  { bx: 0.7, by: 0.88, fast: true } // RW
];
const TEAM_N = FORMATION.length; // 팀당 필드 선수(키퍼 별도 → 11 컨셉)

export function WorldCupBallGoal() {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const ballRef = useRef<HTMLDivElement | null>(null);
  const keeperRef = useRef<Record<Side, HTMLDivElement | null>>({ left: null, right: null });
  const playerEls = useRef<(HTMLDivElement | null)[]>([]);
  const [enabled, setEnabled] = useState(true); // 미니게임 전체 on/off
  const [running, setRunning] = useState(true); // 자동 경기 on/off
  const [goalFlash, setGoalFlash] = useState(false);
  const [saveFlash, setSaveFlash] = useState<Side | null>(null);
  const [setPiece, setSetPiece] = useState<string | null>(null); // 스로인 등 세트피스 라벨
  const [confetti, setConfetti] = useState<
    { id: number; left: number; top: number; dx: number; dy: number; rot: number; color: string }[]
  >([]);

  const pos = useRef<Vec>({ x: 0, y: 0 });
  const vel = useRef<Vec>({ x: 0, y: 0 });
  const players = useRef<Player[]>([]);
  const keeperY = useRef<Record<Side, number>>({ left: 0, right: 0 });
  const perceivedY = useRef<Record<Side, number>>({ left: 0, right: 0 }); // 키퍼가 '인지'한 공 y(반응지연)
  const dragging = useRef(false);
  const enabledRef = useRef(true);
  const runningRef = useRef(true);
  const grabOffset = useRef<Vec>({ x: 0, y: 0 });
  const lastPointer = useRef<{ x: number; y: number; t: number }>({ x: 0, y: 0, t: 0 });
  const pointerVel = useRef<Vec>({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);
  const goalAt = useRef(0);
  const saveAt = useRef(0);
  const kickAt = useRef(0);
  const lastTouch = useRef<0 | 1 | null>(null); // 마지막으로 공을 건드린 팀(스로인 소유 판정)
  const lastActiveAt = useRef(0); // 공이 '닿을 수 있는 곳에서 움직인' 마지막 시각(스톨 복구용)
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
  const keeperCenterX = (side: Side) => {
    const g = goalRect(side);
    return side === "left" ? g.x + g.w - KD / 2 : g.x + KD / 2;
  };
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

  // 역할 home(필드 좌표). 공격 방향에 따라 bx를 x로 매핑(team0 오른쪽 공격, team1 왼쪽 공격).
  const roleHome = (p: Player, push: number) => {
    const { h } = bounds();
    const fx = fieldX();
    const bx = clamp(p.bx + push, 0, 1);
    const span = fx.max - fx.min;
    const x = p.team === 0 ? fx.min + bx * span : fx.max - bx * span;
    const top = h * MARGIN_Y_FRAC;
    const y = top + p.by * (h - 2 * top);
    return { x, y };
  };

  const buildPlayers = () => {
    const list: Player[] = [];
    ([0, 1] as const).forEach((t) => {
      FORMATION.forEach((f) => list.push({ team: t, bx: f.bx, by: f.by, fast: f.fast, x: 0, y: 0 }));
    });
    players.current = list;
    // 초기 위치 = 중립(push 0) home.
    list.forEach((p) => {
      const home = roleHome(p, 0);
      p.x = home.x;
      p.y = home.y;
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
    lastTouch.current = side === "left" ? 0 : 1; // 그 골 수비 팀이 쳐낸 것
    const kx = keeperCenterX(side);
    const ky = keeperY.current[side];
    const minD = BALL / 2 + KD / 2;
    const dx = pos.current.x - kx;
    const dy = pos.current.y - ky;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    pos.current.x = kx + ux * minD;
    pos.current.y = ky + uy * minD;
    const vn = vel.current.x * ux + vel.current.y * uy;
    if (vn < 0) {
      vel.current.x -= (1 + BALL_BOUNCE) * vn * ux;
      vel.current.y -= (1 + BALL_BOUNCE) * vn * uy;
    }
    const outward = side === "left" ? 1 : -1;
    if (Math.sign(vel.current.x) !== outward || Math.abs(vel.current.x) < 140) {
      vel.current.x = outward * Math.max(220, Math.abs(vel.current.x));
    }
    const now = performance.now();
    if (now - saveAt.current > SAVE_COOLDOWN_MS) {
      saveAt.current = now;
      setSaveFlash(side);
      window.setTimeout(() => setSaveFlash((s) => (s === side ? null : s)), 700);
      hapticTick();
    }
  };

  // 골키퍼 AI: 완벽추적 금지. 공이 골대로 올 때만 반응(반응지연 + 흔들림 오차 + 속도 제한)이라
  // 구석으로 빠르게 차거나 키퍼가 자리를 잘못 잡으면 들어간다.
  const updateKeepers = (dt: number) => {
    const { w } = bounds();
    const now = performance.now();
    (["left", "right"] as Side[]).forEach((side) => {
      const g = goalRect(side);
      const lineX = side === "left" ? g.x + g.w : g.x;
      const toward = side === "left" ? vel.current.x < -20 : vel.current.x > 20;
      const dist = Math.abs(pos.current.x - lineX);
      const active = toward && dist < w * 0.4; // 공이 이쪽 골대로 향하고 가까울 때만 적극 반응
      // 인지 위치: 공 y로 '천천히' 수렴 → 급변(빠른 슛)은 못 따라간다.
      const rate = active ? 0.07 : 0.025;
      perceivedY.current[side] += (pos.current.y - perceivedY.current[side]) * rate;
      // 완벽 차단 방지용 흔들림 오차(좌우 키퍼 위상 다르게).
      const wobble = Math.sin(now / 620 + (side === "left" ? 0 : 2.3)) * 24;
      const target = active
        ? clamp(perceivedY.current[side] + wobble, g.y + KD / 2, g.y + g.h - KD / 2)
        : g.y + g.h / 2;
      const spd = (active ? KEEPER_SPEED : KEEPER_SPEED * 0.5) * dt;
      keeperY.current[side] += clamp(target - keeperY.current[side], -spd, spd);
    });
  };

  // 팀별 공 최근접 선수 + 점유 팀(공에 더 가까운 팀).
  const nearestByTeam = (): { na: number; nb: number; possess: 0 | 1 } => {
    let na = -1;
    let nb = -1;
    let da = Infinity;
    let db = Infinity;
    players.current.forEach((p, i) => {
      const d = Math.hypot(p.x - pos.current.x, p.y - pos.current.y);
      if (p.team === 0) {
        if (d < da) {
          da = d;
          na = i;
        }
      } else if (d < db) {
        db = d;
        nb = i;
      }
    });
    return { na, nb, possess: da <= db ? 0 : 1 };
  };

  const updatePlayers = (dt: number, near: { na: number; nb: number; possess: 0 | 1 }) => {
    const { h } = bounds();
    const fx = fieldX();
    players.current.forEach((p, i) => {
      const active = i === near.na || i === near.nb;
      let tx: number;
      let ty: number;
      let spd: number;
      if (active) {
        tx = pos.current.x;
        ty = pos.current.y;
        spd = PLAYER_SPEED;
      } else {
        // 공격 팀은 라인 전진(+), 수비 팀은 후퇴(-) → 필드 전체를 쓰고 역할이 살아난다.
        const attacking = p.team === near.possess;
        const push = attacking ? 0.15 : -0.1;
        const home = roleHome(p, push);
        // 블록이 공 쪽으로 살짝 흐른다(가로는 약하게, 세로는 조금 더).
        tx = home.x + (pos.current.x - home.x) * 0.08;
        ty = home.y + (pos.current.y - home.y) * 0.22;
        spd = PLAYER_SPEED * (p.fast ? 0.72 : 0.56);
      }
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const move = Math.min(spd, d * 4) * dt;
      p.x = clamp(p.x + (dx / d) * move, fx.min, fx.max);
      p.y = clamp(p.y + (dy / d) * move, PLAYER_R, h - PLAYER_R);
    });
  };

  const setVelTo = (tx: number, ty: number, power: number) => {
    const dx = tx - pos.current.x;
    const dy = ty - pos.current.y;
    const d = Math.hypot(dx, dy) || 1;
    vel.current.x = (dx / d) * power;
    vel.current.y = (dy / d) * power;
  };

  // 공을 가진 선수의 판단: 골대 가까우면 슛, 아니면 전진·열린 동료에게 패스(티키타카), 없으면 드리블.
  const playBall = (p: Player) => {
    lastTouch.current = p.team;
    kickAt.current = performance.now();
    const { w } = bounds();
    const enemy: Side = p.team === 0 ? "right" : "left";
    const g = goalRect(enemy);
    const goalCx = g.x + g.w / 2;
    const goalCy = g.y + g.h / 2;
    const distGoal = Math.hypot(goalCx - p.x, goalCy - p.y);
    if (distGoal < w * 0.34) {
      const tx = enemy === "left" ? g.x + g.w : g.x;
      const ty = g.y + g.h / 2 + (Math.random() * 2 - 1) * g.h * 0.5;
      setVelTo(tx, ty, 480 + Math.random() * 140);
      return;
    }
    let best = -1;
    let bestScore = -Infinity;
    players.current.forEach((m, j) => {
      if (m.team !== p.team || m === p) return;
      const adv = p.team === 0 ? m.x - p.x : p.x - m.x; // 상대 골 방향 전진량
      if (adv < 20) return;
      const dpass = Math.hypot(m.x - p.x, m.y - p.y);
      if (dpass > w * 0.5) return;
      let nd = Infinity;
      players.current.forEach((e) => {
        if (e.team === p.team) return;
        const dd = Math.hypot(e.x - m.x, e.y - m.y);
        if (dd < nd) nd = dd;
      });
      const score = adv * 0.7 + nd * 0.6 - dpass * 0.2; // 전진+열린정도-거리
      if (score > bestScore) {
        bestScore = score;
        best = j;
      }
    });
    if (best >= 0) {
      const m = players.current[best];
      const dpass = Math.hypot(m.x - p.x, m.y - p.y);
      setVelTo(m.x, m.y, clamp(dpass * 3, 320, 720));
      return;
    }
    setVelTo(goalCx, goalCy, 300); // 드리블(짧게 전진)
  };

  // 사이드라인(위/아래) 아웃 → 스로인. 마지막에 안 건드린 팀이 가져가 가까운 동료에게 던진다.
  const throwIn = (where: "top" | "bottom") => {
    const { h } = bounds();
    const fx = fieldX();
    const r = BALL / 2;
    const team: 0 | 1 =
      lastTouch.current === 0 ? 1 : lastTouch.current === 1 ? 0 : Math.random() < 0.5 ? 0 : 1;
    pos.current.x = clamp(pos.current.x, fx.min, fx.max);
    pos.current.y = where === "top" ? r + 2 : h - r - 2;
    let ti = -1;
    let td = Infinity;
    players.current.forEach((m, j) => {
      if (m.team !== team) return;
      const dd = Math.hypot(m.x - pos.current.x, m.y - pos.current.y);
      if (dd < td) {
        td = dd;
        ti = j;
      }
    });
    if (ti >= 0) setVelTo(players.current[ti].x, players.current[ti].y, 240);
    else {
      vel.current.x = 0;
      vel.current.y = where === "top" ? 160 : -160;
    }
    lastTouch.current = team;
    setSetPiece("스로인");
    window.setTimeout(() => setSetPiece((s) => (s === "스로인" ? null : s)), 800);
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

  const bounceBallOffPlayer = (p: Player) => {
    const minD = BALL / 2 + PLAYER_R;
    const dx = pos.current.x - p.x;
    const dy = pos.current.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d >= minD) return;
    lastTouch.current = p.team;
    const ux = d > 0.0001 ? dx / d : 1;
    const uy = d > 0.0001 ? dy / d : 0;
    pos.current.x = p.x + ux * minD;
    pos.current.y = p.y + uy * minD;
    const vn = vel.current.x * ux + vel.current.y * uy;
    if (vn < 0) {
      vel.current.x -= (1 + BALL_BOUNCE) * vn * ux;
      vel.current.y -= (1 + BALL_BOUNCE) * vn * uy;
    }
  };

  const step = () => {
    const { w, h } = bounds();
    const dt = 1 / 60;
    const run = runningRef.current && !reduced.current;
    updateKeepers(dt);
    const near = nearestByTeam();
    // 사용자가 공을 들고 있어도(드래그) 선수 AI는 계속 움직인다(공 되찾으러 옴).
    if (run) updatePlayers(dt, near);
    placePlayers();

    if (!dragging.current) {
      pos.current.x += vel.current.x * dt;
      pos.current.y += vel.current.y * dt;
      vel.current.x *= FRICTION;
      vel.current.y *= FRICTION;
      const r = BALL / 2;
      // 좌우(골대 뒤 영역)는 튕김.
      if (pos.current.x < r) {
        pos.current.x = r;
        vel.current.x = -vel.current.x * WALL_RESTITUTION;
      } else if (pos.current.x > w - r) {
        pos.current.x = w - r;
        vel.current.x = -vel.current.x * WALL_RESTITUTION;
      }
      // 위/아래 사이드라인: 경기 중이면 스로인, 수동(정지)일 땐 튕김.
      if (pos.current.y < r || pos.current.y > h - r) {
        if (run) {
          throwIn(pos.current.y < r ? "top" : "bottom");
        } else if (pos.current.y < r) {
          pos.current.y = r;
          vel.current.y = -vel.current.y * WALL_RESTITUTION;
        } else {
          pos.current.y = h - r;
          vel.current.y = -vel.current.y * WALL_RESTITUTION;
        }
      }
      for (const side of ["left", "right"] as Side[]) {
        for (const wll of goalWalls(side)) resolveCircleAABB(wll);
      }
    }

    const speed = Math.hypot(vel.current.x, vel.current.y);
    const now = performance.now();
    // 사용자가 공을 들고 있는 동안엔 공에 물리 충돌을 걸지 않는다(포인터가 위치 주인).
    if (!dragging.current) {
      players.current.forEach((p, i) => {
        const minD = BALL / 2 + PLAYER_R;
        const d = Math.hypot(pos.current.x - p.x, pos.current.y - p.y);
        if (d >= minD) return;
        const isActive = i === near.na || i === near.nb;
        if (run && isActive && speed < CONTROL_SPEED && now - kickAt.current > KICK_CD) {
          playBall(p);
        } else {
          bounceBallOffPlayer(p);
        }
      });
    }

    // 스톨 복구: 경기 중인데 공이 멈췄거나 선수가 닿을 수 없는 구석에 갇히면 가운데로 되살린다
    // (자동경기 토글을 끄기 전엔 절대 멈추지 않게 — 심판 '볼 드롭' 느낌).
    if (run && !dragging.current) {
      const fx = fieldX();
      const reachable = pos.current.x > fx.min - 24 && pos.current.x < fx.max + 24;
      if (speed > 40 && reachable) lastActiveAt.current = now;
      if (now - lastActiveAt.current > 2600) {
        resetBall();
        vel.current.x = (Math.random() * 2 - 1) * 220;
        vel.current.y = (Math.random() * 2 - 1) * 160;
        lastTouch.current = null;
        lastActiveAt.current = now;
        setSetPiece("볼 드롭");
        window.setTimeout(() => setSetPiece((s) => (s === "볼 드롭" ? null : s)), 800);
      }
    }

    place();
    placeKeepers();

    const cx = pos.current.x;
    const cy = pos.current.y;
    const r = BALL / 2;
    let saved = false;
    for (const side of ["left", "right"] as Side[]) {
      const kx = keeperCenterX(side);
      if (Math.hypot(cx - kx, cy - keeperY.current[side]) < r + KD / 2) {
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
    if (enabledRef.current && (dragging.current || moving || (runningRef.current && !reduced.current))) {
      raf.current = window.requestAnimationFrame(step);
    } else {
      raf.current = null;
    }
  };

  const ensureLoop = () => {
    if (!enabledRef.current) return;
    if (raf.current == null) raf.current = window.requestAnimationFrame(step);
  };

  // 마운트: 환경/저장값 읽기 + 리스너.
  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let en = true;
    let au = true;
    try {
      if (window.localStorage.getItem("vic.worldcupGame") === "off") en = false;
      if (window.localStorage.getItem("vic.worldcupAuto") === "off") au = false;
    } catch {
      /* ignore */
    }
    if (reduced.current) au = false;
    enabledRef.current = en;
    runningRef.current = au;
    setEnabled(en);
    setRunning(au);

    const onResize = () => {
      const b = bounds();
      pos.current.x = clamp(pos.current.x, BALL / 2, b.w - BALL / 2);
      pos.current.y = clamp(pos.current.y, BALL / 2, b.h - BALL / 2);
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
      } else if (enabledRef.current && runningRef.current && !reduced.current) {
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

  // enabled 변화: 켜지면 위치 초기화 + (필요 시)루프, 꺼지면 루프 중단.
  useEffect(() => {
    if (!enabled) {
      if (raf.current != null) {
        window.cancelAnimationFrame(raf.current);
        raf.current = null;
      }
      return;
    }
    const { h } = bounds();
    keeperY.current.left = h * 0.5;
    keeperY.current.right = h * 0.5;
    perceivedY.current.left = h * 0.5;
    perceivedY.current.right = h * 0.5;
    buildPlayers();
    resetBall();
    placeKeepers();
    placePlayers();
    lastActiveAt.current = performance.now();
    if (runningRef.current && !reduced.current) ensureLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const toggleEnabled = () => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    try {
      window.localStorage.setItem("vic.worldcupGame", next ? "on" : "off");
    } catch {
      /* ignore */
    }
    hapticTick();
  };

  const toggleRunning = () => {
    const next = !runningRef.current;
    runningRef.current = next;
    setRunning(next);
    try {
      window.localStorage.setItem("vic.worldcupAuto", next ? "on" : "off");
    } catch {
      /* ignore */
    }
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
    kickAt.current = performance.now();
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
      {enabled ? (
        <>
          {/* 집중용 흐림/딤 — 뒤의 메모·달력·색상안내를 살짝 흐리고 어둡게(게임은 이 위에 또렷). */}
          <div className="wc-dim" />
          {/* 경기장 라인(장식) */}
          <div className="wc-pitch" aria-hidden="true">
            <span className="wc-mid" />
            <span className="wc-circle" />
            <span className="wc-box wc-box-left" />
            <span className="wc-box wc-box-right" />
          </div>
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
          {/* 선수 div는 개수 고정(TEAM_N*2)이라 정적 렌더 — 위치는 ref+transform으로만 갱신. */}
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
          {goalFlash ? <div className="wc-goal-text">GOAL!</div> : null}
          {saveFlash ? <div className={`wc-save-text wc-save-${saveFlash}`}>막았다!</div> : null}
          {setPiece ? <div className="wc-setpiece">{setPiece}</div> : null}
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
        </>
      ) : null}

      <div className="wc-controls">
        {enabled ? (
          <button
            type="button"
            className={`wc-toggle ${running ? "on" : ""}`}
            onClick={toggleRunning}
            aria-pressed={running}
          >
            <span className="wc-toggle-ico" aria-hidden="true">
              {running ? "⏸" : "▶"}
            </span>
            <span className="wc-toggle-dot" aria-hidden="true" />
            자동 경기
          </button>
        ) : null}
        <button type="button" className="wc-toggle wc-toggle-event" onClick={toggleEnabled}>
          <span className="wc-toggle-ico" aria-hidden="true">
            ⚽
          </span>
          {enabled ? "미니게임 숨기기" : "미니게임 켜기"}
        </button>
      </div>
    </div>
  );
}
