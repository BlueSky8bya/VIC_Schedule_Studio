"use client";

import { useEffect, useRef, useState } from "react";
import { hapticSuccess, hapticTick } from "@/lib/ui/haptics";
import "./worldcup-ball-goal.css";

// 월드컵 시즌 미니게임 — 좌/우 골대, 공 1개, 양 팀 11명(필드 10 + 골키퍼)이 자동 경기.
// 매 경기마다 두 팀이 '서로 다른' 포메이션·전술(하이프레스/티키타카/롱볼역습/텐백/밸런스)을 뽑고,
// 선수 20명 각자 성격(스피드·압박·패스·슛·규율)이 달라 다르게 움직인다. 세트피스(스로인·골킥·코너킥·
// 킥오프) + 스코어. 사용자는 마우스로 공을 뺏어 던질 수 있다(선수에 맞으면 튕김).
//
// 설계 근거(요약): 몰입=명확한 목표+즉각 피드백+적절한 난이도(GameFlow/Flow), 재미=자율성·유능감·
// 관계성(SDT/PENS), 게임=Mechanics·Dynamics·Aesthetics(MDA). 안전/성능: 레이어는 게임 중 입력을
// 가로채되(집중), 자동경기·숨기기 토글과 공만 조작 가능. transform만(reflow 0), 멈추면/숨기면 rAF 중단.

type Vec = { x: number; y: number };
type Side = "left" | "right";
type Role = "DF" | "DM" | "MF" | "WG" | "FW";
type Slot = { bx: number; by: number; role: Role };
type Team = {
  formation: string;
  slots: Slot[];
  lineHeight: number; // 베이스라인 전진(0 깊음 .. 0.22 높음)
  press: number; // 압박 강도(0.4..1)
  tempo: number; // 속도 배수(0.9..1.2)
  possession: number; // 1=짧은 점유(티키타카) .. 0=직접(롱볼)
  width: number; // 좌우 전개(0.85..1.15)
  name: string;
};
type Player = {
  team: 0 | 1;
  slot: Slot;
  pace: number;
  press: number;
  pass: number;
  shoot: number;
  discipline: number;
  x: number;
  y: number;
};

const FRICTION = 0.992;
const WALL_RESTITUTION = 0.8;
const STOP_SPEED = 6;
const BALL = 40;
const GOAL_W = 70;
const GOAL_H = 120;
const GOAL_MARGIN_PX = 6;
const WALL_T = 10;
const DRAG_BUFFER = 100;
const KD = 26;
const KEEPER_SPEED = 205;
const GOAL_COOLDOWN_MS = 1400;
const SAVE_COOLDOWN_MS = 350;
const PLAYER_R = 9;
const PLAYER_SPEED = 165;
const BALL_BOUNCE = 0.82;
const CONTROL_SPEED = 150;
const KICK_CD = 480;
const MARGIN_Y_FRAC = 0.07;

const FORMATIONS: Record<string, Slot[]> = {
  "4-3-3": [
    { bx: 0.18, by: 0.12, role: "DF" },
    { bx: 0.1, by: 0.37, role: "DF" },
    { bx: 0.1, by: 0.63, role: "DF" },
    { bx: 0.18, by: 0.88, role: "DF" },
    { bx: 0.34, by: 0.5, role: "DM" },
    { bx: 0.47, by: 0.3, role: "MF" },
    { bx: 0.47, by: 0.7, role: "MF" },
    { bx: 0.72, by: 0.14, role: "WG" },
    { bx: 0.84, by: 0.5, role: "FW" },
    { bx: 0.72, by: 0.86, role: "WG" }
  ],
  "4-4-2": [
    { bx: 0.16, by: 0.12, role: "DF" },
    { bx: 0.1, by: 0.38, role: "DF" },
    { bx: 0.1, by: 0.62, role: "DF" },
    { bx: 0.16, by: 0.88, role: "DF" },
    { bx: 0.45, by: 0.12, role: "WG" },
    { bx: 0.4, by: 0.38, role: "MF" },
    { bx: 0.4, by: 0.62, role: "MF" },
    { bx: 0.45, by: 0.88, role: "WG" },
    { bx: 0.78, by: 0.4, role: "FW" },
    { bx: 0.78, by: 0.6, role: "FW" }
  ],
  "3-5-2": [
    { bx: 0.1, by: 0.3, role: "DF" },
    { bx: 0.08, by: 0.5, role: "DF" },
    { bx: 0.1, by: 0.7, role: "DF" },
    { bx: 0.42, by: 0.1, role: "WG" },
    { bx: 0.4, by: 0.35, role: "MF" },
    { bx: 0.3, by: 0.5, role: "DM" },
    { bx: 0.4, by: 0.65, role: "MF" },
    { bx: 0.42, by: 0.9, role: "WG" },
    { bx: 0.8, by: 0.42, role: "FW" },
    { bx: 0.8, by: 0.58, role: "FW" }
  ],
  "4-2-3-1": [
    { bx: 0.17, by: 0.12, role: "DF" },
    { bx: 0.1, by: 0.38, role: "DF" },
    { bx: 0.1, by: 0.62, role: "DF" },
    { bx: 0.17, by: 0.88, role: "DF" },
    { bx: 0.32, by: 0.4, role: "DM" },
    { bx: 0.32, by: 0.6, role: "DM" },
    { bx: 0.55, by: 0.16, role: "WG" },
    { bx: 0.58, by: 0.5, role: "MF" },
    { bx: 0.55, by: 0.84, role: "WG" },
    { bx: 0.85, by: 0.5, role: "FW" }
  ]
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[(Math.random() * arr.length) | 0];

function styleName(t: Omit<Team, "name">): string {
  if (t.press > 0.78 && t.lineHeight > 0.12) return "하이프레스";
  if (t.possession > 0.68) return "티키타카";
  if (t.possession < 0.34) return "롱볼 역습";
  if (t.press < 0.5 && t.lineHeight < 0.06) return "텐백 수비";
  return "밸런스";
}
function genTeam(): Team {
  const formation = pick(Object.keys(FORMATIONS));
  const base = {
    formation,
    slots: FORMATIONS[formation],
    lineHeight: rnd(0.0, 0.2),
    press: rnd(0.42, 1.0),
    tempo: rnd(0.92, 1.2),
    possession: rnd(0.2, 0.85),
    width: rnd(0.85, 1.15)
  };
  return { ...base, name: styleName(base) };
}
// 역할별 성격 기준치(±지터). pace/press/pass/shoot/discipline 0..1.
function genPlayer(team: 0 | 1, slot: Slot): Player {
  const r = slot.role;
  const baseByRole: Record<Role, [number, number, number, number, number]> = {
    // [pace, press, pass, shoot, discipline]
    DF: [0.55, 0.45, 0.55, 0.15, 0.85],
    DM: [0.6, 0.65, 0.78, 0.3, 0.8],
    MF: [0.68, 0.6, 0.82, 0.45, 0.6],
    WG: [0.9, 0.6, 0.6, 0.62, 0.4],
    FW: [0.85, 0.55, 0.55, 0.85, 0.4]
  };
  const [pa, pr, ps, sh, di] = baseByRole[r];
  const j = (v: number) => Math.max(0.05, Math.min(1, v + rnd(-0.15, 0.15)));
  return { team, slot, pace: j(pa), press: j(pr), pass: j(ps), shoot: j(sh), discipline: j(di), x: 0, y: 0 };
}

export function WorldCupBallGoal() {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const ballRef = useRef<HTMLDivElement | null>(null);
  const keeperRef = useRef<Record<Side, HTMLDivElement | null>>({ left: null, right: null });
  const playerEls = useRef<(HTMLDivElement | null)[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [running, setRunning] = useState(true);
  const [goalFlash, setGoalFlash] = useState(false);
  const [saveFlash, setSaveFlash] = useState<Side | null>(null);
  const [setPiece, setSetPiece] = useState<string | null>(null);
  const [score, setScore] = useState<[number, number]>([0, 0]); // [team0, team1]
  const [teamNames, setTeamNames] = useState<[string, string]>(["", ""]);
  const [confetti, setConfetti] = useState<
    { id: number; left: number; top: number; dx: number; dy: number; rot: number; color: string }[]
  >([]);

  const pos = useRef<Vec>({ x: 0, y: 0 });
  const vel = useRef<Vec>({ x: 0, y: 0 });
  const players = useRef<Player[]>([]);
  const teams = useRef<[Team, Team] | null>(null);
  const keeperReact = useRef<Record<Side, number>>({ left: 0.07, right: 0.07 });
  const keeperY = useRef<Record<Side, number>>({ left: 0, right: 0 });
  const perceivedY = useRef<Record<Side, number>>({ left: 0, right: 0 });
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
  const lastTouch = useRef<0 | 1 | null>(null);
  const lastActiveAt = useRef(0);
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

  // 역할 home(필드 좌표) — 팀 전술(lineHeight·width) + 공/수 페이즈 push 반영.
  const roleHome = (p: Player, push: number) => {
    const { h } = bounds();
    const fx = fieldX();
    const t = teams.current ? teams.current[p.team] : null;
    const lh = t ? t.lineHeight : 0;
    const wd = t ? t.width : 1;
    const bx = clamp(p.slot.bx + lh + push, 0, 1);
    const span = fx.max - fx.min;
    const x = p.team === 0 ? fx.min + bx * span : fx.max - bx * span;
    const top = h * MARGIN_Y_FRAC;
    const by = clamp((p.slot.by - 0.5) * wd + 0.5, 0, 1);
    const y = top + by * (h - 2 * top);
    return { x, y };
  };

  const buildMatch = () => {
    const ta = genTeam();
    let tb = genTeam();
    let guard = 0;
    while (tb.formation === ta.formation && tb.name === ta.name && guard < 6) {
      tb = genTeam();
      guard += 1;
    }
    teams.current = [ta, tb];
    keeperReact.current.left = rnd(0.05, 0.09);
    keeperReact.current.right = rnd(0.05, 0.09);
    const list: Player[] = [];
    ([0, 1] as const).forEach((team) => {
      const t = team === 0 ? ta : tb;
      t.slots.forEach((s) => list.push(genPlayer(team, s)));
    });
    players.current = list;
    list.forEach((p) => {
      const home = roleHome(p, 0);
      p.x = home.x;
      p.y = home.y;
    });
    setTeamNames([ta.name, tb.name]);
    setScore([0, 0]);
    setSetPiece(`🔴 ${ta.name}   vs   ${tb.name} 🔵`);
    window.setTimeout(() => setSetPiece((s) => (s && s.includes("vs") ? null : s)), 2600);
  };

  const burstConfetti = (cx: number, cy: number) => {
    const n = reduced.current ? 8 : 34;
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

  const centerBall = () => {
    const { w, h } = bounds();
    pos.current = { x: w * 0.5, y: h * 0.5 };
    vel.current = { x: 0, y: 0 };
    place();
  };

  const setVelTo = (tx: number, ty: number, power: number) => {
    const dx = tx - pos.current.x;
    const dy = ty - pos.current.y;
    const d = Math.hypot(dx, dy) || 1;
    vel.current.x = (dx / d) * power;
    vel.current.y = (dy / d) * power;
  };

  // 가까운 동료(받을 사람)에게 공을 보낸다(킥오프/세트피스 공용).
  const passToNearestTeammate = (team: 0 | 1, fromX: number, fromY: number, power: number) => {
    let ti = -1;
    let td = Infinity;
    players.current.forEach((m, j) => {
      if (m.team !== team) return;
      const dd = Math.hypot(m.x - fromX, m.y - fromY);
      if (dd < td) {
        td = dd;
        ti = j;
      }
    });
    if (ti >= 0) setVelTo(players.current[ti].x, players.current[ti].y, power);
    lastTouch.current = team;
  };

  const flashPiece = (label: string) => {
    setSetPiece(label);
    window.setTimeout(() => setSetPiece((s) => (s === label ? null : s)), 850);
  };

  const kickoff = (concede: 0 | 1) => {
    centerBall();
    lastTouch.current = null;
    lastActiveAt.current = performance.now();
    passToNearestTeammate(concede, pos.current.x, pos.current.y, 200);
    flashPiece("킥오프");
  };

  const throwIn = (where: "top" | "bottom") => {
    const { h } = bounds();
    const fx = fieldX();
    const r = BALL / 2;
    const team: 0 | 1 =
      lastTouch.current === 0 ? 1 : lastTouch.current === 1 ? 0 : Math.random() < 0.5 ? 0 : 1;
    pos.current.x = clamp(pos.current.x, fx.min, fx.max);
    pos.current.y = where === "top" ? r + 2 : h - r - 2;
    passToNearestTeammate(team, pos.current.x, pos.current.y, 240);
    if (Math.hypot(vel.current.x, vel.current.y) < 5) vel.current.y = where === "top" ? 160 : -160;
    flashPiece("스로인");
  };

  // 골라인 아웃(좌/우 사이드, 골문 밖) → 마지막 터치가 공격수면 골킥, 수비수면 코너킥.
  const goalLineOut = (side: Side) => {
    const { h } = bounds();
    const g = goalRect(side);
    const r = BALL / 2;
    const defend: 0 | 1 = side === "left" ? 0 : 1; // 그 골을 지키는 팀
    const attack: 0 | 1 = defend === 0 ? 1 : 0;
    const byAttacker = lastTouch.current === attack;
    if (!byAttacker) {
      // 코너킥 — 공격팀이 코너에서 박스로.
      const topCorner = pos.current.y < h * 0.5;
      pos.current.x = side === "left" ? r + 2 : bounds().w - r - 2;
      pos.current.y = topCorner ? r + 2 : h - r - 2;
      const boxX = side === "left" ? g.x + g.w + 60 : g.x - 60;
      setVelTo(boxX, h * 0.5, 360);
      lastTouch.current = attack;
      flashPiece("코너킥");
    } else {
      // 골킥 — 수비팀이 골 에어리어에서 길게.
      pos.current.x = side === "left" ? g.x + g.w + 24 : g.x - 24;
      pos.current.y = clamp(pos.current.y, h * 0.3, h * 0.7);
      const upfield = side === "left" ? bounds().w * 0.6 : bounds().w * 0.4;
      setVelTo(upfield, h * 0.5 + rnd(-h * 0.2, h * 0.2), 520);
      lastTouch.current = defend;
      flashPiece("골킥");
    }
    lastActiveAt.current = performance.now();
  };

  const scoreGoal = (side: Side) => {
    const now = performance.now();
    if (now - goalAt.current < GOAL_COOLDOWN_MS) return;
    goalAt.current = now;
    const scorer: 0 | 1 = side === "left" ? 1 : 0; // 그 골에 넣은 = 그 골을 공격한 팀
    setScore((s) => (scorer === 0 ? [s[0] + 1, s[1]] : [s[0], s[1] + 1]));
    const g = goalRect(side);
    burstConfetti(g.x + g.w / 2, g.y + g.h / 2);
    setGoalFlash(true);
    window.setTimeout(() => setGoalFlash(false), 900);
    hapticSuccess();
    const concede: 0 | 1 = side === "left" ? 0 : 1;
    window.setTimeout(() => kickoff(concede), 850);
  };

  const doSave = (side: Side) => {
    lastTouch.current = side === "left" ? 0 : 1;
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

  const updateKeepers = (dt: number) => {
    const { w } = bounds();
    const now = performance.now();
    (["left", "right"] as Side[]).forEach((side) => {
      const g = goalRect(side);
      const lineX = side === "left" ? g.x + g.w : g.x;
      const toward = side === "left" ? vel.current.x < -20 : vel.current.x > 20;
      const dist = Math.abs(pos.current.x - lineX);
      const active = toward && dist < w * 0.4;
      const rate = active ? keeperReact.current[side] : 0.025;
      perceivedY.current[side] += (pos.current.y - perceivedY.current[side]) * rate;
      const wobble = Math.sin(now / 620 + (side === "left" ? 0 : 2.3)) * 24;
      const target = active
        ? clamp(perceivedY.current[side] + wobble, g.y + KD / 2, g.y + g.h - KD / 2)
        : g.y + g.h / 2;
      const spd = (active ? KEEPER_SPEED : KEEPER_SPEED * 0.5) * dt;
      keeperY.current[side] += clamp(target - keeperY.current[side], -spd, spd);
    });
  };

  const nearest = () => {
    let overall = -1;
    let od = Infinity;
    let possess: 0 | 1 = 0;
    let da = Infinity;
    let db = Infinity;
    players.current.forEach((p, i) => {
      const d = Math.hypot(p.x - pos.current.x, p.y - pos.current.y);
      if (d < od) {
        od = d;
        overall = i;
      }
      if (p.team === 0) da = Math.min(da, d);
      else db = Math.min(db, d);
    });
    possess = da <= db ? 0 : 1;
    return { overall, possess };
  };

  const updatePlayers = (dt: number, near: { overall: number; possess: 0 | 1 }) => {
    const { w, h } = bounds();
    const fx = fieldX();
    players.current.forEach((p, i) => {
      const t = teams.current ? teams.current[p.team] : null;
      const tempo = t ? t.tempo : 1;
      const teamPress = t ? t.press : 0.6;
      const dBall = Math.hypot(p.x - pos.current.x, p.y - pos.current.y);
      const pressRadius = w * (0.1 + teamPress * 0.22) * (0.55 + p.press * 0.8);
      const pressing = i === near.overall || dBall < pressRadius;
      let tx: number;
      let ty: number;
      let spd: number;
      if (pressing) {
        tx = pos.current.x + vel.current.x * 0.08; // 리드(예측) 살짝
        ty = pos.current.y + vel.current.y * 0.08;
        spd = PLAYER_SPEED * tempo * (0.7 + p.pace * 0.6);
      } else {
        const attacking = p.team === near.possess;
        const push = attacking ? 0.13 : -0.08;
        const home = roleHome(p, push);
        tx = home.x + (pos.current.x - home.x) * 0.06;
        ty = home.y + (pos.current.y - home.y) * 0.18;
        spd = PLAYER_SPEED * tempo * (0.45 + p.pace * 0.4);
      }
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const move = Math.min(spd, d * 4) * dt;
      p.x = clamp(p.x + (dx / d) * move, fx.min, fx.max);
      p.y = clamp(p.y + (dy / d) * move, PLAYER_R, h - PLAYER_R);
    });
  };

  // 공 가진 선수 판단: 슛/패스(팀 점유성향+성격)/드리블. 성격(pass)이 낮으면 오차 큼.
  const playBall = (p: Player) => {
    lastTouch.current = p.team;
    kickAt.current = performance.now();
    const { w } = bounds();
    const t = teams.current ? teams.current[p.team] : null;
    const possession = t ? t.possession : 0.5;
    const enemy: Side = p.team === 0 ? "right" : "left";
    const g = goalRect(enemy);
    const goalCx = g.x + g.w / 2;
    const goalCy = g.y + g.h / 2;
    const distGoal = Math.hypot(goalCx - p.x, goalCy - p.y);
    const err = (1 - p.pass) * 110;
    // 슛: 가까우면 적극, 직접축구는 먼 거리에서도 종종.
    const closeShot = distGoal < w * 0.32 && Math.random() < 0.45 + p.shoot * 0.5;
    const longShot = distGoal < w * 0.46 && possession < 0.4 && Math.random() < p.shoot * 0.5;
    if (closeShot || longShot) {
      const tx = enemy === "left" ? g.x + g.w : g.x;
      const ty = g.y + g.h / 2 + (Math.random() * 2 - 1) * g.h * 0.5 * (1.2 - p.shoot);
      setVelTo(tx, ty, 480 + Math.random() * 150);
      return;
    }
    // 패스: 전진+열린 동료. 점유성향 높으면 짧고 안전, 직접이면 길고 전진 위주.
    let best = -1;
    let bestScore = -Infinity;
    players.current.forEach((m, j) => {
      if (m.team !== p.team || m === p) return;
      const adv = p.team === 0 ? m.x - p.x : p.x - m.x;
      if (adv < 15) return;
      const dpass = Math.hypot(m.x - p.x, m.y - p.y);
      if (dpass > w * 0.55) return;
      let nd = Infinity;
      players.current.forEach((e) => {
        if (e.team === p.team) return;
        nd = Math.min(nd, Math.hypot(e.x - m.x, e.y - m.y));
      });
      const score =
        adv * (0.4 + (1 - possession) * 0.8) +
        nd * (0.3 + possession * 0.7) -
        dpass * (possession * 0.4 + 0.05);
      if (score > bestScore) {
        bestScore = score;
        best = j;
      }
    });
    if (best >= 0) {
      const m = players.current[best];
      const dpass = Math.hypot(m.x - p.x, m.y - p.y);
      setVelTo(m.x + rnd(-err, err), m.y + rnd(-err, err), clamp(dpass * 3, 320, 760));
      return;
    }
    setVelTo(goalCx, goalCy, 300); // 드리블
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
    const near = nearest();
    if (run) updatePlayers(dt, near);
    placePlayers();

    if (!dragging.current) {
      pos.current.x += vel.current.x * dt;
      pos.current.y += vel.current.y * dt;
      vel.current.x *= FRICTION;
      vel.current.y *= FRICTION;
      const r = BALL / 2;
      // 좌우 = 골라인. 경기 중 골문 밖으로 나가면 코너/골킥, 아니면 튕김.
      if (pos.current.x < r || pos.current.x > w - r) {
        const side: Side = pos.current.x < r ? "left" : "right";
        const g = goalRect(side);
        const inMouth = pos.current.y > g.y && pos.current.y < g.y + g.h;
        if (run && !inMouth) {
          goalLineOut(side);
        } else if (pos.current.x < r) {
          pos.current.x = r;
          vel.current.x = -vel.current.x * WALL_RESTITUTION;
        } else {
          pos.current.x = w - r;
          vel.current.x = -vel.current.x * WALL_RESTITUTION;
        }
      }
      // 위/아래 = 사이드라인. 경기 중이면 스로인.
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
    if (!dragging.current) {
      players.current.forEach((p, i) => {
        const minD = BALL / 2 + PLAYER_R;
        const d = Math.hypot(pos.current.x - p.x, pos.current.y - p.y);
        if (d >= minD) return;
        if (run && i === near.overall && speed < CONTROL_SPEED && now - kickAt.current > KICK_CD) {
          playBall(p);
        } else {
          bounceBallOffPlayer(p);
        }
      });
    }

    // 스톨 복구 — 갇히거나 멈추면 볼 드롭(자동경기 끄기 전엔 안 멈춤).
    if (run && !dragging.current) {
      const fx = fieldX();
      const reachable = pos.current.x > fx.min - 24 && pos.current.x < fx.max + 24;
      if (speed > 40 && reachable) lastActiveAt.current = now;
      if (now - lastActiveAt.current > 2600) {
        centerBall();
        vel.current.x = (Math.random() * 2 - 1) * 220;
        vel.current.y = (Math.random() * 2 - 1) * 160;
        lastTouch.current = null;
        lastActiveAt.current = now;
        flashPiece("볼 드롭");
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
    buildMatch();
    centerBall();
    passToNearestTeammate(Math.random() < 0.5 ? 0 : 1, pos.current.x, pos.current.y, 200);
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
    lastTouch.current = null; // 사용자가 찬 공은 중립(세트피스 소유는 다음 터치로)
    kickAt.current = performance.now();
    lastActiveAt.current = performance.now();
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
    <div className={`wc-play ${enabled ? "on" : ""}`} ref={layerRef} aria-hidden="true">
      {enabled ? (
        <>
          <div className="wc-dim" />
          <div className="wc-pitch" aria-hidden="true">
            <span className="wc-mid" />
            <span className="wc-circle" />
            <span className="wc-spot" />
            <span className="wc-box wc-box-left" />
            <span className="wc-box wc-box-right" />
            <span className="wc-six wc-six-left" />
            <span className="wc-six wc-six-right" />
          </div>

          <div className="wc-score" role="status">
            <span className="wc-score-team wc-score-a">{teamNames[0] || "RED"}</span>
            <strong className="wc-score-num">
              {score[0]} <span>:</span> {score[1]}
            </strong>
            <span className="wc-score-team wc-score-b">{teamNames[1] || "BLUE"}</span>
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
          {Array.from({ length: 20 }).map((_, i) => {
            const team = i < 10 ? 0 : 1;
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
