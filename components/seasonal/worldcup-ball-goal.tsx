"use client";

import { useEffect, useRef, useState } from "react";
import { hapticSuccess, hapticTick } from "@/lib/ui/haptics";
import { reduceMotionEnabled } from "@/lib/ui/motion"; // OS reduce-motion 무시, 앱 토글만
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
  stamina: number; // 0..1 체력 — 압박/스프린트로 닳고 쉬면 회복. 낮으면 못 뛰고 압박서 빠짐(현실).
  tx: number; // 캐시된 AI 목표 — 스태거드 재결정 사이엔 유지(22명 동시 방향전환 방지).
  ty: number;
  thinkAt: number; // 다음 재결정 시각(개별 반응지연으로 분산).
  wob: number; // idle 흔들림 위상(선수마다 달라 정지 통일감 깨기).
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
  ],
  "4-1-4-1": [
    { bx: 0.17, by: 0.12, role: "DF" },
    { bx: 0.1, by: 0.38, role: "DF" },
    { bx: 0.1, by: 0.62, role: "DF" },
    { bx: 0.17, by: 0.88, role: "DF" },
    { bx: 0.32, by: 0.5, role: "DM" },
    { bx: 0.52, by: 0.14, role: "WG" },
    { bx: 0.5, by: 0.4, role: "MF" },
    { bx: 0.5, by: 0.6, role: "MF" },
    { bx: 0.52, by: 0.86, role: "WG" },
    { bx: 0.82, by: 0.5, role: "FW" }
  ],
  "3-4-3": [
    { bx: 0.12, by: 0.3, role: "DF" },
    { bx: 0.1, by: 0.5, role: "DF" },
    { bx: 0.12, by: 0.7, role: "DF" },
    { bx: 0.44, by: 0.12, role: "WG" },
    { bx: 0.42, by: 0.4, role: "MF" },
    { bx: 0.42, by: 0.6, role: "MF" },
    { bx: 0.44, by: 0.88, role: "WG" },
    { bx: 0.78, by: 0.22, role: "WG" },
    { bx: 0.84, by: 0.5, role: "FW" },
    { bx: 0.78, by: 0.78, role: "WG" }
  ],
  "5-3-2": [
    { bx: 0.16, by: 0.1, role: "DF" },
    { bx: 0.1, by: 0.3, role: "DF" },
    { bx: 0.08, by: 0.5, role: "DF" },
    { bx: 0.1, by: 0.7, role: "DF" },
    { bx: 0.16, by: 0.9, role: "DF" },
    { bx: 0.4, by: 0.3, role: "MF" },
    { bx: 0.34, by: 0.5, role: "DM" },
    { bx: 0.4, by: 0.7, role: "MF" },
    { bx: 0.76, by: 0.4, role: "FW" },
    { bx: 0.76, by: 0.6, role: "FW" }
  ],
  "5-4-1": [
    { bx: 0.16, by: 0.1, role: "DF" },
    { bx: 0.1, by: 0.3, role: "DF" },
    { bx: 0.08, by: 0.5, role: "DF" },
    { bx: 0.1, by: 0.7, role: "DF" },
    { bx: 0.16, by: 0.9, role: "DF" },
    { bx: 0.42, by: 0.14, role: "WG" },
    { bx: 0.38, by: 0.4, role: "MF" },
    { bx: 0.38, by: 0.6, role: "MF" },
    { bx: 0.42, by: 0.86, role: "WG" },
    { bx: 0.74, by: 0.5, role: "FW" }
  ],
  "4-5-1": [
    { bx: 0.16, by: 0.12, role: "DF" },
    { bx: 0.1, by: 0.38, role: "DF" },
    { bx: 0.1, by: 0.62, role: "DF" },
    { bx: 0.16, by: 0.88, role: "DF" },
    { bx: 0.44, by: 0.1, role: "WG" },
    { bx: 0.4, by: 0.32, role: "MF" },
    { bx: 0.32, by: 0.5, role: "DM" },
    { bx: 0.4, by: 0.68, role: "MF" },
    { bx: 0.44, by: 0.9, role: "WG" },
    { bx: 0.8, by: 0.5, role: "FW" }
  ]
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[(Math.random() * arr.length) | 0];

// 실제 축구 전술(FM 프리셋·전술 연구 기반). 각 스타일은 압박/점유/템포/라인높이/폭의 '성향'을
// 갖고, 선호 포메이션이 다르다. genTeam이 약간의 지터를 더해 매 경기 다른 색을 낸다. 압박 인원은
// press로 갈린다(pressersOf: ≥.82=3, ≥.68=2, 그 외 1) → 스타일별 압박·라인·점유가 확연히 다름.
type TacticStyle = {
  name: string;
  forms: string[];
  press: number; // 0.4..1
  possession: number; // 1=짧은 점유 .. 0=직접(롱볼)
  tempo: number; // 0.9..1.22
  lineHeight: number; // 0(깊음)..0.22(하이라인)
  width: number; // 0.85(좁게)..1.15(넓게)
};
// prettier-ignore
const STYLES: TacticStyle[] = [
  { name: "티키타카",   forms: ["4-3-3", "4-1-4-1"],            press: 0.80, possession: 0.86, tempo: 0.97, lineHeight: 0.16, width: 0.88 },
  { name: "점유 축구",  forms: ["4-3-3", "4-2-3-1"],            press: 0.62, possession: 0.78, tempo: 1.00, lineHeight: 0.12, width: 1.00 },
  { name: "게겐프레싱", forms: ["4-3-3", "4-2-3-1", "3-4-3"],   press: 0.96, possession: 0.56, tempo: 1.18, lineHeight: 0.17, width: 1.02 },
  { name: "하이프레스", forms: ["4-4-2", "4-3-3"],              press: 0.84, possession: 0.54, tempo: 1.10, lineHeight: 0.15, width: 1.00 },
  { name: "토탈 풋볼",  forms: ["4-3-3", "3-4-3"],              press: 0.80, possession: 0.74, tempo: 1.14, lineHeight: 0.18, width: 1.05 },
  { name: "윙 플레이",  forms: ["4-4-2", "4-2-3-1", "3-4-3"],   press: 0.60, possession: 0.50, tempo: 1.06, lineHeight: 0.10, width: 1.15 },
  { name: "미드블록",   forms: ["4-5-1", "4-2-3-1", "4-1-4-1"], press: 0.55, possession: 0.50, tempo: 1.00, lineHeight: 0.07, width: 0.95 },
  { name: "역습 축구",  forms: ["4-4-2", "4-5-1", "4-2-3-1"],   press: 0.50, possession: 0.34, tempo: 1.16, lineHeight: 0.05, width: 0.96 },
  { name: "롱볼 직접",  forms: ["4-4-2", "5-4-1"],              press: 0.56, possession: 0.20, tempo: 1.15, lineHeight: 0.08, width: 1.10 },
  { name: "카테나치오", forms: ["5-3-2", "3-5-2"],              press: 0.44, possession: 0.40, tempo: 0.95, lineHeight: 0.02, width: 0.86 },
  { name: "텐백 수비",  forms: ["5-4-1", "4-5-1"],              press: 0.43, possession: 0.30, tempo: 0.93, lineHeight: 0.01, width: 0.85 },
  { name: "밸런스",     forms: ["4-4-2", "4-3-3", "4-2-3-1"],   press: 0.60, possession: 0.55, tempo: 1.00, lineHeight: 0.10, width: 1.00 }
];

const clampN = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function genTeam(): Team {
  const s = pick(STYLES);
  const formation = pick(s.forms);
  return {
    formation,
    slots: FORMATIONS[formation],
    lineHeight: clampN(s.lineHeight + rnd(-0.03, 0.03), 0, 0.22),
    press: clampN(s.press + rnd(-0.06, 0.06), 0.4, 1),
    tempo: clampN(s.tempo + rnd(-0.05, 0.05), 0.9, 1.22),
    possession: clampN(s.possession + rnd(-0.06, 0.06), 0.15, 0.9),
    width: clampN(s.width + rnd(-0.05, 0.05), 0.82, 1.18),
    name: s.name
  };
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
  return {
    team,
    slot,
    pace: j(pa),
    press: j(pr),
    pass: j(ps),
    shoot: j(sh),
    discipline: j(di),
    x: 0,
    y: 0,
    stamina: rnd(0.85, 1),
    tx: 0,
    ty: 0,
    thinkAt: 0,
    wob: rnd(0, Math.PI * 2)
  };
}

export function WorldCupBallGoal() {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const ballRef = useRef<HTMLDivElement | null>(null);
  const keeperRef = useRef<Record<Side, HTMLDivElement | null>>({ left: null, right: null });
  const playerEls = useRef<(HTMLDivElement | null)[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [running, setRunning] = useState(true);
  const [isMobile, setIsMobile] = useState(false); // ≤640px — 공·키퍼를 작게(렌더용; 물리는 rotated.current)
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
  const rotated = useRef(false); // 모바일(≤640px): stage를 90° 세워 세로 피치로 — 입력 역매핑 필요
  const confettiId = useRef(0);
  // 세트피스(스로인/코너/골킥/킥오프/오프사이드)는 라인에 잠깐 멈췄다 재개 — 딜레이 후 kick 실행.
  const pendingRestart = useRef<{ at: number; kick: () => void; walk?: () => void } | null>(null);
  const possTeam = useRef<0 | 1 | null>(null); // 통제 중인 팀(lastTouch 기반 스무딩) — 압박 방향 판단.
  const counterPress = useRef<{ team: 0 | 1; until: number } | null>(null); // 5초 카운터프레스 윈도우.
  const keeperAggro = useRef<Record<Side, number>>({ left: 0.5, right: 0.5 }); // 스위퍼 성향 0..1.
  const keeperX = useRef<Record<Side, number>>({ left: 0, right: 0 }); // 라인에서 전진한 거리(px).

  const bounds = () => {
    const el = layerRef.current;
    return { w: el?.clientWidth ?? window.innerWidth, h: el?.clientHeight ?? window.innerHeight };
  };
  const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
  // 모바일은 피치가 세로로 짧아(100vw) 공·키퍼가 상대적으로 커 골 넣기 어렵다 → 작게.
  // 키퍼는 선수와 같은 크기(PLAYER_R*2). 물리용이라 rotated.current(=isMobile) 기준.
  const ballDia = () => (rotated.current ? 26 : BALL);
  const kdDia = () => (rotated.current ? PLAYER_R * 2 : KD);

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
    const base = side === "left" ? g.x + g.w - kdDia() / 2 : g.x + kdDia() / 2;
    // 스위퍼 전진(라인 밖으로): 왼쪽 골은 +x(필드 쪽), 오른쪽 골은 -x.
    return base + (side === "left" ? keeperX.current.left : -keeperX.current.right);
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
      const ox = s === "left" ? keeperX.current[s] : -keeperX.current[s];
      if (el) el.style.transform = `translate3d(${ox}px, ${keeperY.current[s] - kdDia() / 2}px, 0)`;
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
    // 두 팀은 서로 다른 전술 스타일로(같은 스타일이면 재추첨) — 매 경기 색이 분명히 다르게.
    while (tb.name === ta.name && guard < 8) {
      tb = genTeam();
      guard += 1;
    }
    teams.current = [ta, tb];
    keeperReact.current.left = rnd(0.05, 0.09);
    keeperReact.current.right = rnd(0.05, 0.09);
    // 키퍼 성격 — 좌/우 팀마다 스위퍼(확 나옴) ↔ 라인키퍼(골문 근처) 다르게.
    keeperAggro.current.left = rnd(0.15, 0.95);
    keeperAggro.current.right = rnd(0.15, 0.95);
    keeperX.current.left = 0;
    keeperX.current.right = 0;
    possTeam.current = null;
    counterPress.current = null;
    pendingRestart.current = null;
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

  // 세트피스 재개 예약 — 공을 라인에 멈춰두고 delay(ms) 뒤 kick 실행. 프리즈 동안 walk()가 매
  // 프레임 키커(선수/키퍼)를 공으로 걸어오게 한다 → '실제로 누가 와서 차는' 모양. step()이
  // 프리즈 동안 공 물리·접촉을 건너뛴다.
  const scheduleRestart = (delay: number, kick: () => void, walk?: () => void) => {
    vel.current = { x: 0, y: 0 };
    pendingRestart.current = { at: performance.now() + delay, kick, walk };
    place();
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

  // 세트피스 키커 — 가장 가까운 같은 팀 선수를 공 바로 뒤까지 빠르게 데려온다(프리즈 중 매 프레임).
  const walkTeammateToBall = (team: 0 | 1) => {
    let ti = -1;
    let td = Infinity;
    players.current.forEach((m, i) => {
      if (m.team !== team) return;
      const d = Math.hypot(m.x - pos.current.x, m.y - pos.current.y);
      if (d < td) {
        td = d;
        ti = i;
      }
    });
    if (ti < 0) return;
    const p = players.current[ti];
    const dx = pos.current.x - p.x;
    const dy = pos.current.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const stand = PLAYER_R + ballDia() / 2 + 2; // 공 바로 뒤에 선다
    const adv = Math.min((PLAYER_SPEED * 1.6) / 60, Math.max(0, d - stand));
    p.x += (dx / d) * adv;
    p.y += (dy / d) * adv;
    p.tx = p.x; // AI 캐시 동기화(끌고 가지 않게)
    p.ty = p.y;
    p.thinkAt = performance.now() + 200;
  };

  // 골킥 키커 — 해당 골 키퍼가 공(골 에어리어)까지 나온다. 킥 후엔 updateKeepers가 복귀시킨다.
  const walkKeeperToBall = (side: Side) => {
    const g = goalRect(side);
    const lineX = side === "left" ? g.x + g.w : g.x;
    const distToBall = Math.abs(pos.current.x - lineX);
    const wantX = Math.max(0, distToBall - (kdDia() / 2 + ballDia() / 2)); // 공 바로 뒤
    const sp = (KEEPER_SPEED * 1.5) / 60;
    keeperX.current[side] += clamp(wantX - keeperX.current[side], -sp, sp);
    keeperY.current[side] += clamp(pos.current.y - keeperY.current[side], -sp, sp);
  };

  const flashPiece = (label: string) => {
    setSetPiece(label);
    window.setTimeout(() => setSetPiece((s) => (s === label ? null : s)), 850);
  };

  const kickoff = (concede: 0 | 1) => {
    centerBall();
    lastTouch.current = null;
    lastActiveAt.current = performance.now();
    flashPiece("킥오프");
    scheduleRestart(
      1000,
      () => passToNearestTeammate(concede, pos.current.x, pos.current.y, 200),
      () => walkTeammateToBall(concede)
    );
  };

  const throwIn = (where: "top" | "bottom") => {
    const { h } = bounds();
    const fx = fieldX();
    const r = ballDia() / 2;
    const team: 0 | 1 =
      lastTouch.current === 0 ? 1 : lastTouch.current === 1 ? 0 : Math.random() < 0.5 ? 0 : 1;
    pos.current.x = clamp(pos.current.x, fx.min, fx.max);
    pos.current.y = where === "top" ? r + 2 : h - r - 2;
    flashPiece("스로인");
    // 라인에서 한 박자 쉰 뒤, 가까운 선수가 와서 던진다(약 1초). 던질 땐 안쪽으로.
    scheduleRestart(
      1000,
      () => {
        passToNearestTeammate(team, pos.current.x, pos.current.y, 240);
        if (Math.hypot(vel.current.x, vel.current.y) < 5)
          vel.current.y = where === "top" ? 160 : -160;
      },
      () => walkTeammateToBall(team)
    );
    lastActiveAt.current = performance.now();
  };

  // 골라인 아웃(좌/우 사이드, 골문 밖) → 마지막 터치가 공격수면 골킥, 수비수면 코너킥.
  const goalLineOut = (side: Side) => {
    const { h } = bounds();
    const g = goalRect(side);
    const r = ballDia() / 2;
    const defend: 0 | 1 = side === "left" ? 0 : 1; // 그 골을 지키는 팀
    const attack: 0 | 1 = defend === 0 ? 1 : 0;
    const byAttacker = lastTouch.current === attack;
    if (!byAttacker) {
      // 코너킥 — 공격팀이 코너에서 박스로. 키커가 자리잡는 약 1.1초 뒤 올린다.
      const topCorner = pos.current.y < h * 0.5;
      pos.current.x = side === "left" ? r + 2 : bounds().w - r - 2;
      pos.current.y = topCorner ? r + 2 : h - r - 2;
      lastTouch.current = attack;
      flashPiece("코너킥");
      const boxX = side === "left" ? g.x + g.w + 60 : g.x - 60;
      // 공격팀 키커가 코너로 와서 박스로 올린다.
      scheduleRestart(1100, () => setVelTo(boxX, h * 0.5, 360), () => walkTeammateToBall(attack));
    } else {
      // 골킥 — 키퍼가 골 에어리어로 나와 길게 찬다(약 1.1초 뒤). 킥 후 키퍼는 골문으로 복귀.
      pos.current.x = side === "left" ? g.x + g.w + 24 : g.x - 24;
      pos.current.y = clamp(pos.current.y, h * 0.3, h * 0.7);
      lastTouch.current = defend;
      flashPiece("골킥");
      const upfield = side === "left" ? bounds().w * 0.6 : bounds().w * 0.4;
      const ty = h * 0.5 + rnd(-h * 0.2, h * 0.2);
      scheduleRestart(1100, () => setVelTo(upfield, ty, 520), () => walkKeeperToBall(side));
    }
    lastActiveAt.current = performance.now();
  };

  // 오프사이드 라인 — 상대 최후방 수비(키퍼는 골라인이라 사실상 2번째 최후방)의 x. 하프라인 이하 없음.
  const offsideLineFor = (team: 0 | 1) => {
    const { w } = bounds();
    let line = team === 0 ? -Infinity : Infinity;
    players.current.forEach((e) => {
      if (e.team === team) return;
      line = team === 0 ? Math.max(line, e.x) : Math.min(line, e.x);
    });
    return team === 0 ? Math.max(line, w * 0.5) : Math.min(line, w * 0.5);
  };

  const callOffside = (attacker: 0 | 1, x: number, y: number) => {
    const { h } = bounds();
    const defend: 0 | 1 = attacker === 0 ? 1 : 0;
    const fx = fieldX();
    pos.current.x = clamp(x, fx.min, fx.max);
    pos.current.y = clamp(y, ballDia() / 2, h - ballDia() / 2);
    lastTouch.current = defend;
    flashPiece("오프사이드");
    // 수비팀 간접 프리킥 — 가까운 수비수가 와서 한 박자 뒤 짧게 재개.
    scheduleRestart(
      900,
      () => passToNearestTeammate(defend, pos.current.x, pos.current.y, 260),
      () => walkTeammateToBall(defend)
    );
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
    const minD = ballDia() / 2 + kdDia() / 2;
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
        ? clamp(perceivedY.current[side] + wobble, g.y + kdDia() / 2, g.y + g.h - kdDia() / 2)
        : g.y + g.h / 2;
      const spd = (active ? KEEPER_SPEED : KEEPER_SPEED * 0.5) * dt;
      keeperY.current[side] += clamp(target - keeperY.current[side], -spd, spd);

      // 스위핑(X) — 성격(aggro)으로 갈린다. 공이 위협권에 오면 스위퍼는 라인 밖으로 확 나와
      // 끊으려 하고(높은 aggro=멀리·빨리), 라인키퍼는 거의 골문에만 머문다. 위협 없으면 복귀.
      const aggro = keeperAggro.current[side];
      const central = Math.abs(pos.current.y - (g.y + g.h / 2)) < g.h * 1.7;
      const threat = central && dist < w * (0.16 + aggro * 0.18) && (toward || dist < w * 0.1);
      const maxRush = w * (0.03 + aggro * 0.22);
      const wantRush = threat ? clamp(dist - kdDia(), 0, maxRush) * (0.45 + aggro * 0.6) : 0;
      const rushSpd = KEEPER_SPEED * (threat ? 0.7 + aggro * 0.8 : 0.9) * dt;
      keeperX.current[side] += clamp(wantRush - keeperX.current[side], -rushSpd, rushSpd);
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

  // 팀 압박 인원수 — PPDA 스킴(축구 분석 표준). press 강도로 게겐/하이/미드·로우 구분.
  // 게겐프레싱(press≥.82)=3, 하이프레스(≥.68)=2, 미드/로우=1 + 카운터프레스(5초룰) 시 +1.
  const pressersOf = (team: 0 | 1): number => {
    const t = teams.current ? teams.current[team] : null;
    const pr = t ? t.press : 0.6;
    let n = pr >= 0.82 ? 3 : pr >= 0.68 ? 2 : 1;
    const cp = counterPress.current;
    if (cp && cp.team === team && performance.now() < cp.until) n += 1;
    return clamp(n, 1, 4);
  };

  const updatePlayers = (dt: number, near: { overall: number; possess: 0 | 1 }) => {
    const { w, h } = bounds();
    const fx = fieldX();
    const now = performance.now();
    const bx = pos.current.x;
    const by = pos.current.y;
    const poss: 0 | 1 = possTeam.current ?? near.possess; // 통제 팀(없으면 최근접팀)

    // 팀별 공까지 거리 순위 — press/cover/balance 역할 배정의 기준.
    const rank = new Array<number>(players.current.length).fill(99);
    ([0, 1] as const).forEach((team) => {
      const ids: number[] = [];
      players.current.forEach((p, i) => {
        if (p.team === team) ids.push(i);
      });
      const dOf = (i: number) => Math.hypot(players.current[i].x - bx, players.current[i].y - by);
      ids.sort((a, b) => dOf(a) - dOf(b));
      ids.forEach((idx, r) => {
        rank[idx] = r;
      });
    });

    players.current.forEach((p, i) => {
      const t = teams.current ? teams.current[p.team] : null;
      const tempo = t ? t.tempo : 1;
      const attacking = p.team === poss;
      const r = rank[i];
      const dBall = Math.hypot(p.x - bx, p.y - by);
      const loose = dBall < w * 0.045; // 발밑 루즈볼 — 누구나 툭

      // 역할: 공격=볼캐리어 1명 + 나머지 지원(벌려서 패스길). 수비=press/cover/balance.
      // 압박 인원은 PPDA로, 단 체력<0.22면 못 눌러 빠진다 → 지친 팀은 압박 헐거워져 공간 열림(현실).
      let mode: "carry" | "press" | "cover" | "support" | "shape";
      if (attacking) {
        mode = r === 0 ? "carry" : "support";
      } else {
        const nP = pressersOf(p.team);
        if (loose || (r < nP && p.stamina > 0.22)) mode = "press";
        else if (r <= nP + 1) mode = "cover";
        else mode = "shape";
      }
      const sprint = mode === "press" || mode === "carry";

      // 스태거드 재결정 — 압박/캐리는 자주, 나머지는 드물게 + 개별 반응지연. 캐시 목표 유지로
      // 22명이 같은 프레임에 일제히 방향 트는 것 방지(규율 높을수록 반응 빠름).
      if (now >= p.thinkAt) {
        const lagBase = sprint ? rnd(70, 150) : rnd(190, 430);
        p.thinkAt = now + lagBase * (1.25 - p.discipline * 0.55);
        let tx: number;
        let ty: number;
        if (sprint) {
          const lead = mode === "press" ? 0.1 : 0.05;
          tx = bx + vel.current.x * lead;
          ty = by + vel.current.y * lead;
        } else if (mode === "cover") {
          // 공과 자기 골 사이를 막는 커버 포인트(수비 2선).
          const og = goalRect(p.team === 0 ? "left" : "right");
          tx = bx + (og.x + og.w / 2 - bx) * 0.32;
          ty = by + (og.y + og.h / 2 - by) * 0.32;
        } else {
          // shape/support — 역할 home + 공쪽 제한 쏠림. 수비=컴팩트(많이), 공격=벌림(적게+전진).
          const fwd = p.slot.role === "FW" || p.slot.role === "WG";
          const push = attacking ? (fwd ? 0.18 : 0.1) : -0.06;
          const home = roleHome(p, push);
          const infX = attacking ? 0.1 : 0.16;
          const infY = attacking ? 0.22 : 0.3;
          const maxX = w * (attacking ? 0.12 : 0.16);
          const maxY = h * 0.22;
          tx = home.x + clamp((bx - home.x) * infX, -maxX, maxX);
          ty = home.y + clamp((by - home.y) * infY, -maxY, maxY);
        }
        const jit = mode === "shape" || mode === "support" ? 26 : 12;
        p.tx = tx + rnd(-jit, jit);
        p.ty = ty + rnd(-jit, jit);
      }

      // 이동 — 캐시 목표로. 속도는 모드·페이스·체력. 지치면 느려짐(0.6..1).
      let spd = PLAYER_SPEED * tempo * (sprint ? 0.72 + p.pace * 0.6 : 0.42 + p.pace * 0.4);
      spd *= 0.6 + 0.4 * p.stamina;
      if (mode === "cover") spd *= 1.1;
      const wob = sprint ? 0 : Math.sin(now / 700 + p.wob) * 1.4; // idle 미세 흔들림(통일감 깨기)
      const dx = p.tx - p.x;
      const dy = p.ty + wob - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const move = Math.min(spd, d * 4) * dt;
      const vx = (dx / d) * move;
      const vy = (dy / d) * move;
      p.x = clamp(p.x + vx, fx.min, fx.max);
      p.y = clamp(p.y + vy, PLAYER_R, h - PLAYER_R);

      // 체력 — 스프린트/압박은 소모, 걸으면 회복. 실제 이동량 비례(90분 내내 못 누름).
      const speedUsed = Math.hypot(vx, vy) / dt;
      const drain = (sprint ? 0.05 : 0.012) * (0.5 + (speedUsed / PLAYER_SPEED) * 0.5);
      const recover = sprint ? 0 : 0.022;
      p.stamina = clamp(p.stamina - drain * dt + recover * dt, 0, 1);
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
    // 오프사이드 판정 — 받는 순간 받을 선수가 상대 최후방 라인(키퍼 제외 사실상 2번째 최후방)
    // 너머 + 상대 진영이면 오프사이드. 레벨(같은 선)은 온사이드라 PLAYER_R*2 여유를 둔다.
    const offLine = offsideLineFor(p.team);
    const isOffside = (m: Player) => {
      const beyond = p.team === 0 ? m.x > offLine + PLAYER_R * 2 : m.x < offLine - PLAYER_R * 2;
      const inOppHalf = p.team === 0 ? m.x > w * 0.5 : m.x < w * 0.5;
      return beyond && inOppHalf;
    };
    // 패스: 전진+열린 동료. 온사이드를 강하게 우선(오프사이드 후보엔 큰 페널티) → 실제 선수처럼
    // 보통은 온사이드로 연결하고, 전진 옵션이 전부 오프사이드일 때만 위험한 패스가 걸린다(드묾).
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
      let score =
        adv * (0.4 + (1 - possession) * 0.8) +
        nd * (0.3 + possession * 0.7) -
        dpass * (possession * 0.4 + 0.05);
      if (isOffside(m)) score -= 100000; // 온사이드 옵션이 있으면 그쪽을 무조건 먼저
      if (score > bestScore) {
        bestScore = score;
        best = j;
      }
    });
    if (best >= 0) {
      const m = players.current[best];
      if (isOffside(m)) {
        // 전진 옵션이 전부 오프사이드뿐 → 위험을 무릅쓴 패스가 깃발에 걸린다.
        callOffside(p.team, m.x, m.y);
        return;
      }
      const dpass = Math.hypot(m.x - p.x, m.y - p.y);
      setVelTo(m.x + rnd(-err, err), m.y + rnd(-err, err), clamp(dpass * 3, 320, 760));
      return;
    }
    setVelTo(goalCx, goalCy, 300); // 드리블
  };

  const resolveCircleAABB = (rect: { x0: number; y0: number; x1: number; y1: number }) => {
    const r = ballDia() / 2;
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
    const minD = ballDia() / 2 + PLAYER_R;
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
    const tNow = performance.now();
    // 동작 줄이기(reduce-motion)여도, 사용자가 자동경기를 '직접' 켜면 돈다(명시적 opt-in).
    // 자동 '시작'만 reduce-motion에서 끈다(아래 마운트). 깜짝 모션 없음 + 켜면 작동.
    const run = runningRef.current;

    // 세트피스 프리즈 — 공은 라인에 멈추고, walk()가 키커(선수/키퍼)를 매 프레임 공으로 데려온다.
    // 예약 시각이 되면 kick 실행(그 키커 위치에서 공이 나가 '누가 차는' 모양).
    if (pendingRestart.current) {
      if (pendingRestart.current.walk) pendingRestart.current.walk();
      if (tNow >= pendingRestart.current.at) {
        const k = pendingRestart.current.kick;
        pendingRestart.current = null;
        k();
        lastActiveAt.current = tNow;
      }
    }
    const frozen = pendingRestart.current != null;

    const near = nearest();

    // 통제 팀 스무딩 + 카운터프레스(5초룰) — 통제가 A→B로 넘어가면, 직전 통제팀 A가 압박적이면
    // 잠깐(4초) 추가 압박 인원을 붙인다(즉시 되찾기). 공간 노출 트레이드오프는 압박 인원으로 표현.
    const ctrl: 0 | 1 = lastTouch.current ?? near.possess;
    if (possTeam.current !== ctrl) {
      const lost = possTeam.current;
      possTeam.current = ctrl;
      const lt = lost != null && teams.current ? teams.current[lost] : null;
      if (lost != null && lost !== ctrl && lt && lt.press >= 0.7) {
        counterPress.current = { team: lost, until: tNow + 4000 };
      }
    }

    if (!frozen) updateKeepers(dt); // 프리즈 중엔 walk()가 키퍼(골킥)를 직접 제어
    if (run) updatePlayers(dt, near);
    placePlayers();

    if (!dragging.current && !frozen) {
      pos.current.x += vel.current.x * dt;
      pos.current.y += vel.current.y * dt;
      vel.current.x *= FRICTION;
      vel.current.y *= FRICTION;
      const r = ballDia() / 2;
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
    if (!dragging.current && !frozen) {
      players.current.forEach((p, i) => {
        const minD = ballDia() / 2 + PLAYER_R;
        const d = Math.hypot(pos.current.x - p.x, pos.current.y - p.y);
        if (d >= minD) return;
        if (run && i === near.overall && speed < CONTROL_SPEED && now - kickAt.current > KICK_CD) {
          playBall(p);
        } else {
          bounceBallOffPlayer(p);
        }
      });
    }

    // 스톨 복구 — 갇히거나 멈추면 볼 드롭(자동경기 끄기 전엔 안 멈춤). 프리즈 중엔 스킵.
    if (run && !dragging.current && !frozen) {
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
    const r = ballDia() / 2;
    let saved = false;
    if (!frozen) {
      for (const side of ["left", "right"] as Side[]) {
        const kx = keeperCenterX(side);
        if (Math.hypot(cx - kx, cy - keeperY.current[side]) < r + kdDia() / 2) {
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
    }

    const moving = speed > STOP_SPEED || frozen;
    if (enabledRef.current && (dragging.current || moving || runningRef.current)) {
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
    reduced.current = reduceMotionEnabled(); // OS reduce-motion 무시 — 앱 토글만(시각 효과 양 조절용)
    rotated.current = window.matchMedia?.("(max-width: 640px)").matches ?? false;
    setIsMobile(rotated.current);
    let en = true;
    let au = true;
    let savedAuto: string | null = null;
    try {
      if (window.localStorage.getItem("vic.worldcupGame") === "off") en = false;
      savedAuto = window.localStorage.getItem("vic.worldcupAuto");
      if (savedAuto === "off") au = false;
    } catch {
      /* ignore */
    }
    // 동작 줄이기: 자동 '시작'은 끈다(깜짝 모션 방지) — 단 사용자가 예전에 직접 켰으면(="on") 존중.
    if (reduced.current && savedAuto !== "on") au = false;
    enabledRef.current = en;
    runningRef.current = au;
    setEnabled(en);
    setRunning(au);

    const onResize = () => {
      rotated.current = window.matchMedia?.("(max-width: 640px)").matches ?? false;
      setIsMobile(rotated.current);
      const b = bounds();
      pos.current.x = clamp(pos.current.x, ballDia() / 2, b.w - ballDia() / 2);
      pos.current.y = clamp(pos.current.y, ballDia() / 2, b.h - ballDia() / 2);
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
      } else if (enabledRef.current && runningRef.current) {
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
    if (runningRef.current) ensureLoop(); // runningRef는 reduce-motion이면 마운트서 이미 off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // 게임 ON이면 뒤 일정 스크롤 잠금(모바일에서 집중 + 손가락 오조작 방지). CSS가 모바일로 한정.
  useEffect(() => {
    if (!enabled) return;
    document.body.classList.add("wc-game-lock");
    return () => document.body.classList.remove("wc-game-lock");
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

  // 화면(클라이언트) 좌표 → stage 로컬(landscape 물리) 좌표.
  // 모바일은 stage가 90° 세워져 있어 역회전 매핑: local=(cy, rectW-cx).
  const localFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = layerRef.current?.getBoundingClientRect();
    const cx = e.clientX - (rect?.left ?? 0);
    const cy = e.clientY - (rect?.top ?? 0);
    if (rotated.current) return { x: cy, y: (rect?.width ?? 0) - cx };
    return { x: cx, y: cy };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragging.current = true;
    const { x: lx, y: ly } = localFromEvent(e);
    grabOffset.current = { x: lx - pos.current.x, y: ly - pos.current.y };
    lastPointer.current = { x: lx, y: ly, t: performance.now() };
    pointerVel.current = { x: 0, y: 0 };
    vel.current = { x: 0, y: 0 };
    hapticTick();
    ensureLoop();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const { x: lx, y: ly } = localFromEvent(e);
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
  const kdRender = isMobile ? PLAYER_R * 2 : KD; // 키퍼 시각 크기(물리 kdDia()와 동일 소스)
  const keeperStyle = (side: Side): React.CSSProperties => ({
    [side]: `calc(${edge} + ${GOAL_W - kdRender}px)`,
    top: "0",
    width: `${kdRender}px`,
    height: `${kdRender}px`
  });

  return (
    <div className={`wc-play ${enabled ? "on" : ""}`} aria-hidden="true">
      {enabled ? (
        <>
          <div className="wc-dim" />
          {/* 피치 본체 — 모바일에선 이 stage만 90° 세워 세로 피치로. 물리는 landscape 그대로. */}
          <div className="wc-stage" ref={layerRef}>
            <div className="wc-pitch" aria-hidden="true">
              <span className="wc-mid" />
              <span className="wc-circle" />
              <span className="wc-spot" />
              <span className="wc-box wc-box-left" />
              <span className="wc-box wc-box-right" />
              <span className="wc-six wc-six-left" />
              <span className="wc-six wc-six-right" />
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
              className={`wc-ball ${isMobile ? "wc-ball-sm" : ""}`}
              ref={ballRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              ⚽
            </div>
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
        </>
      ) : null}

      {/* HUD — 모바일+게임ON이면 피치 stage와 똑같이 90° 돌려 landscape 프레임에 정렬(폰 가로로
          보면 똑바름). 게임 OFF면 회전 안 함(켜기 버튼 똑바로). 데스크탑은 항상 inset:0 똑바로. */}
      <div className={`wc-hud ${isMobile && enabled ? "wc-hud-rot" : ""}`}>
        {enabled ? (
          <>
            <div className="wc-score" role="status">
              <span className="wc-score-team wc-score-a">{teamNames[0] || "RED"}</span>
              <strong className="wc-score-num">
                {score[0]} <span>:</span> {score[1]}
              </strong>
              <span className="wc-score-team wc-score-b">{teamNames[1] || "BLUE"}</span>
            </div>
            {goalFlash ? <div className="wc-goal-text">GOAL!</div> : null}
            {saveFlash ? <div className={`wc-save-text wc-save-${saveFlash}`}>막았다!</div> : null}
            {setPiece ? <div className="wc-setpiece">{setPiece}</div> : null}
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
            <span className="wc-tg-full">자동 경기</span>
            <span className="wc-tg-short">자동</span>
          </button>
        ) : null}
        <button type="button" className="wc-toggle wc-toggle-event" onClick={toggleEnabled}>
          <span className="wc-toggle-ico" aria-hidden="true">
            ⚽
          </span>
          <span className="wc-tg-full">{enabled ? "미니게임 숨기기" : "미니게임 켜기"}</span>
          <span className="wc-tg-short">{enabled ? "숨기기" : "켜기"}</span>
        </button>
        </div>
      </div>
    </div>
  );
}
