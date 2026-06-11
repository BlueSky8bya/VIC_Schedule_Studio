"use client";

import { useEffect, useRef, useState } from "react";
import { hapticSuccess, hapticTick } from "@/lib/ui/haptics";
import { reduceMotionEnabled } from "@/lib/ui/motion"; // OS reduce-motion 무시, 앱 토글만
import type { PlayerPersona, Side, TeamPlan, Vec2 } from "@/lib/football/core/types";
import { makeRng, randomSeed } from "@/lib/football/core/rng";
import { makeMatchup, STYLES, type TacticStyle } from "@/lib/football/tactics/profiles";
import { createEventLog, type MatchEventKind } from "@/lib/football/core/event-log";
import "./worldcup-ball-goal.css";

// 월드컵 시즌 미니게임 — 좌/우 골대, 공 1개, 양 팀 11명(필드 10 + 골키퍼)이 자동 경기.
// 매 경기마다 두 팀이 '서로 다른' 포메이션·전술(하이프레스/티키타카/롱볼역습/텐백/밸런스)을 뽑고,
// 선수 20명 각자 성격(스피드·압박·패스·슛·규율)이 달라 다르게 움직인다. 세트피스(스로인·골킥·코너킥·
// 킥오프) + 스코어. 사용자는 마우스로 공을 뺏어 던질 수 있다(선수에 맞으면 튕김).
//
// 설계 근거(요약): 몰입=명확한 목표+즉각 피드백+적절한 난이도(GameFlow/Flow), 재미=자율성·유능감·
// 관계성(SDT/PENS), 게임=Mechanics·Dynamics·Aesthetics(MDA). 안전/성능: 레이어는 게임 중 입력을
// 가로채되(집중), 자동경기·숨기기 토글과 공만 조작 가능. transform만(reflow 0), 멈추면/숨기면 rAF 중단.

// 핵심 타입은 엔진(lib/football)이 단일 출처. 컴포넌트는 그 위에 '런타임 상태'만 얹는다.
type Vec = Vec2;
type Team = TeamPlan;
// 런타임 선수 = 엔진 성향(PlayerPersona) + 화면/AI 상태(좌표·체력·캐시목표·반응시각·흔들림).
type Player = PlayerPersona & {
  x: number;
  y: number;
  stamina: number; // 0..1 체력 — 압박/스프린트로 닳고 쉬면 회복. 낮으면 못 뛰고 압박서 빠짐(현실).
  tx: number; // 캐시된 AI 목표 — 스태거드 재결정 사이엔 유지(22명 동시 방향전환 방지).
  ty: number;
  thinkAt: number; // 다음 재결정 시각(개별 반응지연으로 분산).
  wob: number; // idle 흔들림 위상(선수마다 달라 정지 통일감 깨기).
  yellow: number; // 경고 누적(2장이면 퇴장).
  red: boolean; // 퇴장 — 더는 공에 관여하지 않고(패시브) 시각적으로 흐려진다.
  num: number; // 등번호(표시용).
};

const FRICTION = 0.98; // 잔디 마찰 — 높일수록 공이 빨리 죽어 라인아웃(스로인) 남발 감소
const WALL_RESTITUTION = 0.8;
const STOP_SPEED = 6;
const BALL = 16;
// 골·라인 치수는 stage(105:68 고정) 대비 '비율'로 둔다 — 고정 px면 작은 모바일 stage서 과대해진다.
// stage가 종횡비를 지켜 px/m가 등방(가로%·세로% 둘 다 같은 m). 실제 골대 7.32m/68 ≈ 10.8% 폭.
const GOALW_F = 0.024; // 골대 깊이(stage 폭 대비) — 골라인 밖 돌출, OUTX_F 띠 안에 들어감
const GOALH_F = 0.118; // 골대 입구(stage 높이 대비) — 실제 10.8%보다 살짝 키워 득점 가능하게
const WALL_T = 10;
const DRAG_BUFFER = 100;
const KEEPER_SPEED = 145; // 필드 선수(165)보다 약간 느리게 — 키퍼가 너무 빨라 보이던 것 완화(다이브는 *1.5)
const GOAL_COOLDOWN_MS = 1400;
const SAVE_COOLDOWN_MS = 350;
const PLAYER_R = 9;
const PLAYER_SPEED = 165;
const BALL_BOUNCE = 0.55; // 선수 몸 튕김 — 낮춰서 난반사로 라인 밖 튕겨나가는 빈도↓(스로인 남발 완화)
const CONTROL_SPEED = 150;
const KICK_CD = 480;
const MARGIN_Y_FRAC = 0.07;
const GRAVITY_Z = 1000; // 공 높이용 중력(px/s^2) — 띄운 공이 내려오는 속도
const AIR_MIN = 7; // 이 높이 위면 '떠 있음'(선수/키퍼 통과 + 흐려짐)
const PERIOD_END = [45, 90, 105, 120] as const; // 각 피리어드 끝나는 누적 게임분(추가시간 별도)
const PERIOD_NAME = ["전반", "후반", "연장 전반", "연장 후반"] as const;
const HALF_BREAK_MS = 2800; // 하프타임/피리어드 사이 휴식(real ms)
const MATCH_END_RESTART_MS = 6500; // 경기 종료 후 새 경기까지(real ms)
// 실제 축구처럼 경기장 라인을 화면 끝에서 안쪽에 둔다 → 라인 밖은 '아웃오브플레이' 띠.
// 골대는 입구(앞면)가 골라인 위에 오고 몸통(그물)은 라인 밖(바깥)으로 돌출한다 → 골라인이
// 골대 입구에 걸림(뒤통수 아님). 공이 이 라인을 넘으면 스로인/코너/골킥. 고정 px로 JS·CSS 정합.
const OUTX_F = 0.05; // 골라인이 좌우 끝에서 들어간 비율(stage 폭) — GOALW_F보다 커서 골대가 띠 안
const OUTY_F = 0.05; // 터치라인이 위아래 끝에서 들어간 비율(stage 높이)

// 포메이션·전술·선수 생성은 엔진(lib/football)이 시드 기반으로 담당(결정적·테스트 가능).
// 아래 rnd는 라이브 연출/AI 지터용(재현 불필요한 시각 흔들림). 생성에는 절대 쓰지 않는다.
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function WorldCupBallGoal() {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const ballRef = useRef<HTMLDivElement | null>(null);
  const keeperRef = useRef<Record<Side, HTMLDivElement | null>>({ left: null, right: null });
  // 키퍼 장갑 2개씩 — JS가 공 방향으로 배치(stage 좌표라 모바일 회전과 무관). [side]→[글러브0,글러브1]
  const glovesRef = useRef<Record<Side, (HTMLElement | null)[]>>({ left: [], right: [] });
  // 승부차기 키퍼 걷기 — 두 키퍼가 오른쪽 골 근처에 같이 있다가, 진영 바뀌면 걸어서 교체.
  // null=아직 미초기화(첫 프레임에 목표로 스냅). 그 외엔 목표로 lerp(걷는 모습).
  const skPos = useRef<Record<Side, { x: number; y: number } | null>>({ left: null, right: null });
  // 장갑 현재 오프셋(px) — 목표로 부드럽게 lerp. 손이 몸과 별개로 벌어지고/뻗는다.
  const glovePos = useRef<Record<Side, { x: number; y: number }[]>>({
    left: [
      { x: 0, y: 0 },
      { x: 0, y: 0 }
    ],
    right: [
      { x: 0, y: 0 },
      { x: 0, y: 0 }
    ]
  });
  const playerEls = useRef<(HTMLDivElement | null)[]>([]);
  // enabled는 false로 시작 — 마운트 effect가 localStorage(vic.worldcupGame)를 읽어 실제 값으로
  // 세팅한다. true로 시작하면 OFF 저장 유저도 첫 렌더에 게임이 잠깐 떴다 effect가 끄며 깜빡인다.
  // false 시작이면 SSR=client 첫 렌더 일치(hydration mismatch 0), OFF는 깜빡 없음, ON은 살짝 늦게 등장만.
  const [enabled, setEnabled] = useState(false);
  const [running, setRunning] = useState(true);
  const [isMobile, setIsMobile] = useState(false); // ≤640px — 공·키퍼를 작게(렌더용; 물리는 rotated.current)
  const [goalFlash, setGoalFlash] = useState(false);
  const [netFlash, setNetFlash] = useState<Side | null>(null); // 골 들어간 골대 그물 출렁임
  const [saveFlash, setSaveFlash] = useState<Side | null>(null);
  const [setPiece, setSetPiece] = useState<string | null>(null);
  const [score, setScore] = useState<[number, number]>([0, 0]); // [team0, team1]
  const scoreRef = useRef<[number, number]>([0, 0]); // step 클로저에서 현재 점수 읽기용(연장 판정)
  const [teamNames, setTeamNames] = useState<[string, string]>(["", ""]);
  const [confetti, setConfetti] = useState<
    { id: number; left: number; top: number; dx: number; dy: number; rot: number; color: string }[]
  >([]);

  const pos = useRef<Vec>({ x: 0, y: 0 });
  const vel = useRef<Vec>({ x: 0, y: 0 });
  const ballZ = useRef(0); // 공 높이(px) — 떠 있으면(>AIR_MIN) 선수/키퍼/골대벽 통과(롱볼이 넘어감)
  const ballVZ = useRef(0); // 수직 속도(px/s) — 중력 GRAVITY_Z로 포물선
  const players = useRef<Player[]>([]);
  const teams = useRef<[Team, Team] | null>(null);
  const keeperReact = useRef<Record<Side, number>>({ left: 0.07, right: 0.07 });
  const keeperY = useRef<Record<Side, number>>({ left: 0, right: 0 });
  const perceivedY = useRef<Record<Side, number>>({ left: 0, right: 0 });
  const dragging = useRef(false);
  const enabledRef = useRef(false); // enabled와 동일하게 false 시작(마운트 effect가 저장값으로 세팅)
  const runningRef = useRef(true);
  const grabOffset = useRef<Vec>({ x: 0, y: 0 });
  const lastPointer = useRef<{ x: number; y: number; t: number }>({ x: 0, y: 0, t: 0 });
  const pointerVel = useRef<Vec>({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);
  const goalAt = useRef(0);
  const saveAt = useRef(0);
  const saveGrace = useRef(0); // 세이브 직후 잠깐 재세이브 차단 — 공이 키퍼/장갑 근처서 매프레임
  // 재충돌해 진동·묶이고 손이 따라 떨리던 피드백 루프 차단(공이 깔끔히 튕겨 나간다).
  const foulAt = useRef(0); // 파울 쿨다운(연속 파울 스팸 방지)
  const restartGrace = useRef(0); // 세트피스 킥 직후 유예 — 라인아웃·접촉 무시(즉시 재아웃 루프 차단)
  const kickAt = useRef(0);
  const dribbleCount = useRef(0); // 연속 드리블 터치 수(상한으로 무한 드리블 방지)
  const lastBallPlayer = useRef<Player | null>(null); // 직전 볼 처리 선수 — 바뀌면 드리블 카운트 리셋
  const lastTouch = useRef<0 | 1 | null>(null);
  const lastActiveAt = useRef(0);
  const reduced = useRef(false);
  const rotated = useRef(false); // 모바일(≤640px): stage를 90° 세워 세로 피치로 — 입력 역매핑 필요
  const confettiId = useRef(0);
  const matchSeed = useRef(0); // 이번 경기 시드(리플레이/디버그) — 엔진 생성의 재현 키
  const matchStart = useRef(0); // 경기 시작 시각(이벤트 t 기준)
  const eventLog = useRef(createEventLog()); // 골/세트피스/오프사이드 등 이벤트 기록(Phase 0 토대)
  // 경기 시계 — 1 real초 = 1 게임분. 전반 0~45, 후반 45~90 + 추가시간(세트피스로 누적). 동점이면
  // 연장(90~105, 105~120). 종료 시 결과 띄우고 자동 새 경기. breakUntil 동안은 정지(하프타임).
  const clock = useRef({ t: 0, period: 1, added: 0, ended: false });
  // 경기 기록 — 점유(프레임 수)·슛·파울·카드. poss는 프레임 누적 → 비율로 환산해 표시.
  const stats = useRef({
    poss: [0, 0],
    shot: [0, 0],
    foul: [0, 0],
    yellow: [0, 0],
    red: [0, 0]
  });
  const [statText, setStatText] = useState<{
    poss: [number, number];
    shot: [number, number];
    foul: [number, number];
    yellow: [number, number];
    red: [number, number];
  } | null>(null);
  // 스코어박스 옆 카드 표시용(옐로/레드 개수) — 카드 받을 때만 갱신.
  const [cardCounts, setCardCounts] = useState<{ yellow: [number, number]; red: [number, number] }>({
    yellow: [0, 0],
    red: [0, 0]
  });
  const clockTick = useRef(0); // 표시 갱신 throttle용 프레임 카운터(매 프레임 setState 방지)
  const breakUntil = useRef(0); // real ms — 이 시각까지 하프타임/피리어드 사이 휴식(시계·플레이 정지)
  const [clockText, setClockText] = useState("");
  const [matchResult, setMatchResult] = useState<string | null>(null);
  // 승부차기 — 연장(4피리어드)까지 동점이면. 5키커 선축 후 서든데스. phase 타임라인으로 진행.
  const shootout = useRef({
    active: false,
    a: 0,
    b: 0,
    takenA: 0,
    takenB: 0,
    turn: 0 as 0 | 1,
    round: 1,
    phase: "" as "" | "setup" | "run" | "result",
    at: 0,
    scored: false,
    targetY: 0,
    guessY: 0,
    kicker: -1, // 이번 키커(선수 인덱스) — 실제 원이 도움닫기 후 찬다
    kx0: 0, // 키커 도움닫기 시작 좌표
    ky0: 0
  });
  const [pkText, setPkText] = useState<{
    a: number;
    b: number;
    turn: 0 | 1;
    round: number;
    note: string;
  } | null>(null);
  const [tacticsOpen, setTacticsOpen] = useState(false); // 전술 변경 패널 열림
  const [statsOpen, setStatsOpen] = useState(false); // 경기 기록 패널 열림
  const [pickPlayer, setPickPlayer] = useState<number | null>(null); // 호버/탭한 선수(정보 카드)
  const pinnedPlayer = useRef(false); // 클릭으로 고정됐는가(호버 이탈해도 유지)
  const [styleNames, setStyleNames] = useState<[string, string]>(["", ""]); // 현재 팀별 전술명(칩 강조용)
  // 세트피스(스로인/코너/골킥/킥오프/오프사이드)는 라인에 잠깐 멈췄다 재개 — 딜레이 후 kick 실행.
  const pendingRestart = useRef<{
    at: number;
    kick: () => void;
    walk?: () => void;
    team?: 0 | 1; // 재개를 차는 팀 — 준비 중 상대가 공에서 물러나도록(스페이싱)
  } | null>(null);
  const possTeam = useRef<0 | 1 | null>(null); // 통제 중인 팀(lastTouch 기반 스무딩) — 압박 방향 판단.
  const counterPress = useRef<{ team: 0 | 1; until: number } | null>(null); // 5초 카운터프레스 윈도우.
  const keeperAggro = useRef<Record<Side, number>>({ left: 0.5, right: 0.5 }); // 스위퍼 성향 0..1.
  const keeperX = useRef<Record<Side, number>>({ left: 0, right: 0 }); // 라인에서 전진한 거리(px).
  // GK 손 — 잡으면(catch) 잠깐 보유 후 배급(스로/킥). 백패스는 발로(손 금지). 박스 안에서만 손.
  const keeperHold = useRef<{ side: Side | null; until: number }>({ side: null, until: 0 });

  const bounds = () => {
    const el = layerRef.current;
    return { w: el?.clientWidth ?? window.innerWidth, h: el?.clientHeight ?? window.innerHeight };
  };
  const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
  // 모바일은 피치가 세로로 짧아(100vw) 공·키퍼가 상대적으로 커 골 넣기 어렵다 → 작게.
  // 키퍼는 선수와 같은 크기(PLAYER_R*2). 물리용이라 rotated.current(=isMobile) 기준.
  const ballDia = () => (rotated.current ? 11 : BALL);
  // 키퍼 크기 = 필드 선수의 1.2배(발 리치 없으니 살짝만 크게). 선수 시각: 웹 PLAYER_R*2=18, 모바일 13.
  const kdDia = () => (rotated.current ? 13 * 1.2 : PLAYER_R * 2 * 1.2);
  // 경기장 라인(아웃 판정 기준) — 화면 끝에서 인셋. 좌우=골라인, 위아래=터치라인.
  const insetX = () => bounds().w * OUTX_F;
  const insetY = () => bounds().h * OUTY_F;
  // 모바일은 입구는 키우고(0.15). 깊이(goalW)는 키퍼(kdDia=15.6px)가 그물 박스 안에 다 들어가 뒤로
  // 안 삐져나오게 키퍼보다 깊게(0.032 → ~20px > 15.6). 웹은 이미 충분히 깊음(GOALW_F).
  const goalW = () => bounds().w * (rotated.current ? 0.032 : GOALW_F);
  const goalH = () => bounds().h * (rotated.current ? 0.15 : GOALH_F);

  // 골대 박스 — 입구가 골라인(insetX) 위에 오고 몸통은 라인 밖(화면 끝 쪽)으로 돌출.
  // 좌측: [insetX-goalW, insetX], 입구=insetX. 우측: [w-insetX, w-insetX+goalW], 입구=w-insetX.
  const goalRect = (side: Side) => {
    const { w, h } = bounds();
    const gw = goalW();
    const gh = goalH();
    const x = side === "left" ? insetX() - gw : w - insetX();
    const y = h * 0.5 - gh / 2;
    return { x, y, w: gw, h: gh };
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
    if (!el) return;
    const z = ballZ.current;
    // 떠 있으면 위로 z만큼 올리고 살짝만 키운다(원근). 그림자·블러는 CSS .wc-ball-air가 입힌다.
    const scale = Math.min(1.3, 1 + z / 450);
    el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y - z}px, 0) scale(${scale})`;
    el.classList.toggle("wc-ball-air", z > AIR_MIN);
  };
  // 장갑 배치 — kX,kY=키퍼 중심. active면 공 따라 동적(평소 흔들/슛 한 손 리치/1v1 벌림/잡기 컵),
  // 비active(대기 키퍼)면 손 모으고 가만. deg는 '뻗는 방향(dir)'으로 — atan2(작은 cur)는 손이
  // 중심 근처일 때 미친듯 회전(부르르 떨림)해서 안 씀. + 최소 reach로 손이 겹쳐 떨리는 것도 방지.
  const placeGloves = (
    s: Side,
    kX: number,
    kY: number,
    active: boolean,
    now: number,
    clipSide: Side | null // 어느 골 박스로 clamp할지(null=clamp 안 함). 승부차기는 항상 "right".
  ) => {
    const el = keeperRef.current[s];
    if (!el) return;
    const kd = kdDia();
    const gl = glovesRef.current[s];
    const cur = glovePos.current[s];
    // 장갑이 골대 박스 밖(뒷벽·상하 포스트)으로 픽셀 한 톨도 안 삐지게 월드위치 clamp. 단 clamp 범위를
    // '몸 위치(kX,kY)까지 포함'하도록 확장 → 몸이 박스 밖이면 장갑도 몸 따라감(분리 방지). 입구(필드)는 자유.
    const clampGlove = (gi: number) => {
      if (!clipSide) return;
      const g = goalRect(clipSide);
      const gr = kd * 0.42;
      const yLo = Math.min(g.y + gr, kY);
      const yHi = Math.max(g.y + g.h - gr, kY);
      let wx = kX + cur[gi].x;
      const wy = clamp(kY + cur[gi].y, yLo, yHi);
      if (clipSide === "right") wx = Math.min(wx, Math.max(g.x + g.w - gr, kX)); // 뒷벽(오른쪽)
      else wx = Math.max(wx, Math.min(g.x + gr, kX)); // 뒷벽(왼쪽)
      cur[gi].x = wx - kX;
      cur[gi].y = wy - kY;
    };
    if (!active) {
      el.classList.remove("wc-keeper-catch");
      const dir = s === "left" ? 0 : Math.PI;
      const perp = dir + Math.PI / 2;
      const deg = (dir * 180) / Math.PI;
      for (let gi = 0; gi < 2; gi++) {
        const g = gl[gi];
        if (!g) continue;
        const sgn = gi === 0 ? 1 : -1;
        const tx = Math.cos(dir) * kd * 0.34 + Math.cos(perp) * kd * 0.26 * sgn;
        const ty = Math.sin(dir) * kd * 0.34 + Math.sin(perp) * kd * 0.26 * sgn;
        cur[gi].x += (tx - cur[gi].x) * 0.2;
        cur[gi].y += (ty - cur[gi].y) * 0.2;
        g.style.transform = `translate(calc(-50% + ${cur[gi].x}px), calc(-50% + ${cur[gi].y}px)) rotate(${deg}deg)`;
      }
      return;
    }
    const catching = keeperHold.current.side === s;
    el.classList.toggle("wc-keeper-catch", catching);
    const bdx = pos.current.x - kX;
    const bdy = pos.current.y - kY;
    const dist = Math.hypot(bdx, bdy) || 1;
    // 공이 키퍼에 닿는 순간(잡기·근접·막 쳐낸 직후)엔 '추적'을 멈추고 고정 컵 포즈로. 추적하면 공의
    // 미세 진동을 손이 따라가 부르르 떨리고 공과 비벼졌음. 추적은 공이 멀리서 다가올 때(아래)만.
    const nearBall = catching || dist < kd * 1.7 || now < saveGrace.current;
    if (nearBall) {
      const cdir = s === "left" ? 0 : Math.PI;
      const cperp = cdir + Math.PI / 2;
      const cdeg = (cdir * 180) / Math.PI;
      for (let gi = 0; gi < 2; gi++) {
        const g = gl[gi];
        if (!g) continue;
        const sgn = gi === 0 ? 1 : -1;
        const tx = Math.cos(cdir) * kd * 0.42 + Math.cos(cperp) * kd * 0.34 * sgn;
        const ty = Math.sin(cdir) * kd * 0.42 + Math.sin(cperp) * kd * 0.34 * sgn;
        cur[gi].x += (tx - cur[gi].x) * 0.4;
        cur[gi].y += (ty - cur[gi].y) * 0.4;
        clampGlove(gi);
        g.style.transform = `translate(calc(-50% + ${cur[gi].x}px), calc(-50% + ${cur[gi].y}px)) rotate(${cdeg}deg)`;
      }
      return;
    }
    const dir = Math.atan2(bdy, bdx);
    const perp = dir + Math.PI / 2;
    const speed = Math.hypot(vel.current.x, vel.current.y);
    const defT: 0 | 1 = s === "left" ? 0 : 1;
    const attackT: 0 | 1 = defT === 0 ? 1 : 0;
    const shotThreat = dist < kd * 4 && speed > 150;
    const closeDown =
      !shotThreat && lastTouch.current === attackT && dist < kd * 7 && speed <= 160;
    const threat = shotThreat || catching;
    const vperp = vel.current.x * Math.cos(perp) + vel.current.y * Math.sin(perp);
    const lead = vperp >= 0 ? 0 : 1;
    const deg = (dir * 180) / Math.PI; // 안정적 회전(공 방향)
    for (let gi = 0; gi < 2; gi++) {
      const g = gl[gi];
      if (!g) continue;
      const sgn = gi === 0 ? 1 : -1;
      const isLead = gi === lead;
      let reach = catching
        ? kd * 0.46
        : shotThreat
          ? isLead
            ? Math.min(dist * 0.92, kd * 1.15)
            : kd * 0.42
          : closeDown
            ? kd * 0.52
            : kd * 0.4;
      reach = Math.max(reach, kd * 0.26); // 손이 중심에 겹쳐 떨리는 것 방지
      // catching 간격 넓게(0.34) — 좁으면 두 장갑이 겹쳐 낑기고 떨려 보였음.
      const spread =
        (catching ? 0.34 : shotThreat ? (isLead ? 0.12 : 0.26) : closeDown ? 0.62 : 0.32) * kd;
      const ph = gi * 3.3 + (s === "left" ? 0 : 1.7);
      const bobP =
        threat || closeDown
          ? 0
          : (Math.sin(now / 560 + ph) * 0.6 + Math.sin(now / 247 + ph * 2.3) * 0.4) * kd * 0.04;
      const bobR = threat || closeDown ? 0 : Math.sin(now / 690 + ph * 1.4) * kd * 0.035;
      const tx = Math.cos(dir) * (reach + bobR) + Math.cos(perp) * (spread * sgn + bobP);
      const ty = Math.sin(dir) * (reach + bobR) + Math.sin(perp) * (spread * sgn + bobP);
      const k = catching ? 0.5 : threat ? 0.42 : closeDown ? 0.28 : 0.14;
      cur[gi].x += (tx - cur[gi].x) * k;
      cur[gi].y += (ty - cur[gi].y) * k;
      clampGlove(gi);
      g.style.transform = `translate(calc(-50% + ${cur[gi].x}px), calc(-50% + ${cur[gi].y}px)) rotate(${deg}deg)`;
    }
  };

  // 승부차기 키퍼 — 두 키퍼가 오른쪽 골 근처에 같이 있고, 막는 팀(차는 팀 반대) 키퍼는 골 안,
  // 쉬는 키퍼는 골 옆에서 대기. 진영이 바뀌면 목표가 뒤바뀌어 둘이 '걸어서' 교체된다(스냅 아님).
  const placeShootoutKeepers = (now: number) => {
    const { w, h } = bounds();
    const so = shootout.current;
    const kd = kdDia();
    const goalLineX = w - insetX();
    const spotY = h * 0.5;
    const inGoalX = goalLineX + kd * 0.15;
    // 대기 키퍼 — 골대 '뒤'(네트 뒤, 필드 밖)에서 대기해 경기 방해 안 되게. 위쪽 포스트 옆.
    const besideX = goalLineX + goalW() + kd * 0.7;
    const besideY = spotY - goalH() * 0.5;
    (["left", "right"] as Side[]).forEach((s) => {
      const el = keeperRef.current[s];
      if (!el) return;
      el.style.display = "";
      el.style.zIndex = ""; // 정상경기서 올린 z 잔류 방지(승부차기 키퍼는 골 안=그물 뒤)
      const team: 0 | 1 = s === "left" ? 0 : 1;
      el.classList.toggle("wc-keeper-def-red", team === 0);
      el.classList.toggle("wc-keeper-def-blue", team === 1);
      const defending = team !== so.turn;
      el.classList.toggle("wc-keeper-ingoal", defending); // 막는 키퍼만 골 안(흐릿)
      const tx = defending ? inGoalX : besideX;
      const ty = defending ? keeperY.current.right : besideY;
      let cur = skPos.current[s];
      if (!cur) {
        cur = { x: tx, y: ty };
        skPos.current[s] = cur;
      } else {
        cur.x += (tx - cur.x) * 0.05; // 천천히 걸어서 교체(현장감)
        cur.y += (ty - cur.y) * 0.05;
      }
      const ucx = s === "left" ? insetX() - kd / 2 : w - insetX() + kd / 2; // 요소 무변환 중심 x
      el.style.transform = `translate3d(${cur.x - ucx}px, ${cur.y - kd / 2}px, 0)`;
      // 승부차기: 막는 키퍼는 오른쪽 골 박스로 clip(몸·장갑 안 삐지게), 대기 키퍼는 null.
      placeGloves(s, cur.x, cur.y, defending, now, defending ? "right" : null);
    });
  };

  const placeKeepers = () => {
    const now = performance.now();
    if (shootout.current.active) {
      placeShootoutKeepers(now);
      return;
    }
    (["left", "right"] as Side[]).forEach((s) => {
      const el = keeperRef.current[s];
      if (!el) return;
      el.style.display = "";
      el.classList.remove("wc-keeper-def-red", "wc-keeper-def-blue");
      const ox = s === "left" ? keeperX.current[s] : -keeperX.current[s];
      el.style.transform = `translate3d(${ox}px, ${keeperY.current[s] - kdDia() / 2}px, 0)`;
      // 스위핑으로 골 라인 앞(필드)으로 나오면 그물 앞(z 위)에, 골 안이면 그물 뒤(기본 z, 흐릿).
      // 안 그러면 필드로 나와도 그물 뒤라 '골 안에 든' 듯 보였다(밖→안 통과 착시). 골 안일 땐 살짝
      // 블러로 골대와의 접촉을 흐릿하게(눈속임).
      const inField = keeperX.current[s] > kdDia() * 0.45;
      el.style.zIndex = inField ? "7" : "";
      el.classList.toggle("wc-keeper-ingoal", !inField);
      placeGloves(s, keeperCenterX(s), keeperY.current[s], true, now, s); // 정상경기: 자기 골 박스로 clip
    });
  };
  const placePlayers = () => {
    const pr = rotated.current ? 6.5 : PLAYER_R; // 모바일은 선수 시각 더 작게(중심 맞춰 오프셋)
    players.current.forEach((p, i) => {
      const el = playerEls.current[i];
      if (!el) return;
      if (p.red) {
        el.style.display = "none"; // 퇴장 — 필드서 시각적으로도 제거
        return;
      }
      el.style.display = "";
      el.style.transform = `translate3d(${p.x - pr}px, ${p.y - pr}px, 0)`;
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

  // 이벤트 기록(Phase 0) — 골/세트피스/오프사이드 등. 평가·해설·디버그·리플레이의 토대.
  const logEvent = (kind: MatchEventKind, team?: 0 | 1, x?: number, y?: number, detail?: string) => {
    eventLog.current.push({ t: performance.now() - matchStart.current, kind, team, x, y, detail });
  };

  const buildMatch = () => {
    matchStart.current = performance.now();
    // 엔진이 시드 기반으로 두 팀 전술·포메이션·선수 성향을 '결정적으로' 생성(리플레이/테스트 가능).
    // 매 경기 새 시드 → 다른 경기, 같은 시드 → 똑같은 경기. 라이브 연출(키퍼 성격 등)은 rnd로.
    const seed = randomSeed();
    matchSeed.current = seed;
    const rng = makeRng(seed);
    const { teams: plans, personas } = makeMatchup(rng);
    const [ta, tb] = plans;
    teams.current = [ta, tb];
    eventLog.current.clear();
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
    keeperHold.current = { side: null, until: 0 };
    // 엔진 성향(persona)에 런타임 상태를 입혀 화면용 Player로. stamina/wob도 같은 rng라 결정적.
    players.current = personas.map((pp, i) => ({
      ...pp,
      x: 0,
      y: 0,
      stamina: rng.range(0.85, 1),
      tx: 0,
      ty: 0,
      thinkAt: 0,
      wob: rng.range(0, Math.PI * 2),
      yellow: 0,
      red: false,
      num: (i % 10) + 2 // 2~11(1은 골키퍼 몫으로 비움)
    }));
    players.current.forEach((p) => {
      const home = roleHome(p, 0);
      p.x = home.x;
      p.y = home.y;
    });
    setTeamNames([ta.name, tb.name]);
    setStyleNames([ta.name, tb.name]);
    scoreRef.current = [0, 0];
    setScore([0, 0]);
    clock.current = { t: 0, period: 1, added: 0, ended: false };
    stats.current = { poss: [0, 0], shot: [0, 0], foul: [0, 0], yellow: [0, 0], red: [0, 0] };
    setStatText(null);
    setCardCounts({ yellow: [0, 0], red: [0, 0] });
    clockTick.current = 0;
    shootout.current = { ...shootout.current, active: false, phase: "", kicker: -1 };
    setPkText(null);
    breakUntil.current = 0;
    setMatchResult(null);
    setClockText("전반 00:00");
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
    ballZ.current = 0;
    ballVZ.current = 0;
    place();
  };

  const setVelTo = (tx: number, ty: number, power: number) => {
    const dx = tx - pos.current.x;
    const dy = ty - pos.current.y;
    const d = Math.hypot(dx, dy) || 1;
    vel.current.x = (dx / d) * power;
    vel.current.y = (dy / d) * power;
  };

  // 공 띄우기(롱패스·골킥·코너 크로스) — 수평 도달시간에 맞춰 수직속도를 줘서 그 시간 뒤 착지.
  // 떠 있는 동안 선수/키퍼/골대벽을 통과(롱볼이 넘어감). dist=수평거리, power=수평속도.
  const loftBall = (dist: number, power: number) => {
    const travel = clamp(dist / Math.max(120, power), 0.2, 1.05); // 도달까지 대략 시간(s)
    ballVZ.current = (GRAVITY_Z * travel) / 2; // 그 시간 뒤 착지
    if (ballZ.current < 1) ballZ.current = 1;
  };

  // 세트피스 재개 예약 — 공을 라인에 멈춰두고 delay(ms) 뒤 kick 실행. 프리즈 동안 walk()가 매
  // 프레임 키커(선수/키퍼)를 공으로 걸어오게 한다 → '실제로 누가 와서 차는' 모양. step()이
  // 프리즈 동안 공 물리·접촉을 건너뛴다.
  const scheduleRestart = (
    delay: number,
    kick: () => void,
    walk?: () => void,
    team?: 0 | 1
  ) => {
    vel.current = { x: 0, y: 0 };
    pendingRestart.current = { at: performance.now() + delay, kick, walk, team };
    clock.current.added += 0.12; // 세트피스 지체 → 추가시간 누적(게임분)
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
    const sp = KEEPER_SPEED / 60; // 골킥 걸어나옴 — 몸은 보통 속도(빠르지 않게)
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
    logEvent("kickoff", concede);
    scheduleRestart(
      700,
      () => passToNearestTeammate(concede, pos.current.x, pos.current.y, 200),
      () => walkTeammateToBall(concede),
      concede
    );
  };

  const throwIn = (where: "top" | "bottom") => {
    const { h } = bounds();
    const fx = fieldX();
    const team: 0 | 1 =
      lastTouch.current === 0 ? 1 : lastTouch.current === 1 ? 0 : Math.random() < 0.5 ? 0 : 1;
    pos.current.x = clamp(pos.current.x, fx.min, fx.max);
    pos.current.y = where === "top" ? insetY() : h - insetY(); // 터치라인 위
    flashPiece("스로인");
    logEvent("throwIn", team, pos.current.x, pos.current.y);
    // 라인에서 한 박자 쉰 뒤, 가까운 선수가 와서 던진다(약 1초). 던질 땐 안쪽으로.
    scheduleRestart(
      700,
      () => {
        passToNearestTeammate(team, pos.current.x, pos.current.y, 240);
        if (Math.hypot(vel.current.x, vel.current.y) < 5)
          vel.current.y = where === "top" ? 160 : -160;
      },
      () => walkTeammateToBall(team),
      team
    );
    lastActiveAt.current = performance.now();
  };

  // 골라인 아웃(좌/우 사이드, 골문 밖) → 마지막 터치가 공격수면 골킥, 수비수면 코너킥.
  const goalLineOut = (side: Side) => {
    const { w, h } = bounds();
    const g = goalRect(side);
    const defend: 0 | 1 = side === "left" ? 0 : 1; // 그 골을 지키는 팀
    const attack: 0 | 1 = defend === 0 ? 1 : 0;
    const byAttacker = lastTouch.current === attack;
    if (!byAttacker) {
      // 코너킥 — 공격팀이 코너(골라인×터치라인 교차)에서 박스로. 키커가 자리잡는 약 1.1초 뒤 올린다.
      const topCorner = pos.current.y < h * 0.5;
      pos.current.x = side === "left" ? insetX() : w - insetX();
      pos.current.y = topCorner ? insetY() : h - insetY();
      lastTouch.current = attack;
      flashPiece("코너킥");
      logEvent("cornerKick", attack, pos.current.x, pos.current.y);
      const boxX = side === "left" ? g.x + g.w + 60 : g.x - 60;
      // 공격팀 키커가 코너로 와서 박스로 띄워 올린다(크로스).
      scheduleRestart(
        800,
        () => {
          setVelTo(boxX, h * 0.5, 360);
          loftBall(Math.hypot(boxX - pos.current.x, h * 0.5 - pos.current.y), 360);
        },
        () => walkTeammateToBall(attack),
        attack
      );
    } else {
      // 골킥 — 키퍼가 골 에어리어로 나와 길게 찬다(약 1.1초 뒤). 킥 후 키퍼는 골문으로 복귀.
      pos.current.x = side === "left" ? g.x + g.w + 24 : g.x - 24;
      pos.current.y = clamp(pos.current.y, h * 0.3, h * 0.7);
      lastTouch.current = defend;
      flashPiece("골킥");
      logEvent("goalKick", defend, pos.current.x, pos.current.y);
      const upfield = side === "left" ? bounds().w * 0.6 : bounds().w * 0.4;
      const ty = h * 0.5 + rnd(-h * 0.2, h * 0.2);
      // 골킥은 길게 띄운다(롱볼).
      scheduleRestart(
        850,
        () => {
          setVelTo(upfield, ty, 520);
          loftBall(Math.abs(upfield - pos.current.x), 520);
        },
        () => walkKeeperToBall(side),
        defend
      );
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
    logEvent("offside", attacker, x, y);
    // 수비팀 간접 프리킥 — 가까운 수비수가 와서 한 박자 뒤 짧게 재개.
    scheduleRestart(
      700,
      () => passToNearestTeammate(defend, pos.current.x, pos.current.y, 260),
      () => walkTeammateToBall(defend),
      defend
    );
    lastActiveAt.current = performance.now();
  };

  // 파울 — 수비수(fouler)가 공 가진 상대를 거칠게 막음. 반칙당한 팀에 프리킥. 시니컬(규율↓)하면
  // 카드(옐로 누적 2 → 레드, 가끔 다이렉트 레드). 레드는 그 선수가 패시브가 된다.
  const callFoul = (fouler: Player) => {
    const fouled = lastTouch.current;
    if (fouled == null || fouler.team === fouled) return;
    const { w, h } = bounds();
    const fx = fieldX();
    const spotX = clamp(pos.current.x, fx.min, fx.max);
    const spotY = clamp(pos.current.y, insetY(), h - insetY());
    pos.current.x = spotX;
    pos.current.y = spotY;
    foulAt.current = performance.now();
    stats.current.foul[fouler.team] += 1;
    const cynical = 1 - fouler.discipline;
    let card = "";
    if (Math.random() < 0.03 + cynical * 0.05) {
      fouler.red = true;
      stats.current.red[fouler.team] += 1;
      card = " 🟥";
    } else if (Math.random() < 0.2 + cynical * 0.33) {
      fouler.yellow += 1;
      stats.current.yellow[fouler.team] += 1;
      card = " 🟨";
      if (fouler.yellow >= 2) {
        fouler.red = true;
        stats.current.red[fouler.team] += 1;
        card = " 🟨🟥";
      }
    }
    if (card) {
      // 스코어박스 옆 카드 표시 갱신.
      const st = stats.current;
      setCardCounts({ yellow: [st.yellow[0], st.yellow[1]], red: [st.red[0], st.red[1]] });
    }
    lastTouch.current = fouled;
    flashPiece(`파울${card}`);
    logEvent("foul", fouler.team, spotX, spotY, card.trim());
    // 프리킥 — 반칙당한 팀이 한 박자 뒤 찬다. 상대 골 가까우면 직접 슛, 아니면 전진 패스.
    const enemy: Side = fouled === 0 ? "right" : "left";
    const g = goalRect(enemy);
    const distGoal = Math.hypot(g.x + g.w / 2 - spotX, g.y + g.h / 2 - spotY);
    scheduleRestart(
      800,
      () => {
        if (distGoal < w * 0.32 && Math.random() < 0.6) {
          const tx = enemy === "left" ? g.x + g.w : g.x;
          const ty = g.y + g.h / 2 + rnd(-g.h * 0.35, g.h * 0.35);
          setVelTo(tx, ty, 520 + Math.random() * 120);
          stats.current.shot[fouled] += 1;
          lastTouch.current = fouled;
        } else {
          passToNearestTeammate(fouled, pos.current.x, pos.current.y, 300);
        }
      },
      () => walkTeammateToBall(fouled),
      fouled
    );
    lastActiveAt.current = performance.now();
  };

  const scoreGoal = (side: Side) => {
    const now = performance.now();
    if (now - goalAt.current < GOAL_COOLDOWN_MS) return;
    goalAt.current = now;
    const scorer: 0 | 1 = side === "left" ? 1 : 0; // 그 골에 넣은 = 그 골을 공격한 팀
    scoreRef.current = scorer === 0 ? [scoreRef.current[0] + 1, scoreRef.current[1]] : [scoreRef.current[0], scoreRef.current[1] + 1];
    setScore([scoreRef.current[0], scoreRef.current[1]]);
    logEvent("goal", scorer, pos.current.x, pos.current.y);
    const g = goalRect(side);
    const r = ballDia() / 2;
    burstConfetti(g.x + g.w / 2, g.y + g.h / 2);
    setGoalFlash(true);
    window.setTimeout(() => setGoalFlash(false), 1100);
    // 손맛 — 공이 골라인을 넘어 그물 '안'으로 쏙 굴러 들어가 박힌다(촤르륵). 세이브(공이 튕겨 나감)와
    // 확실히 구분되게: 공을 골대 안으로 옮기고 안쪽으로 살짝 굴려 뒤그물에 안착 + 그물 출렁임.
    setNetFlash(side);
    window.setTimeout(() => setNetFlash((s) => (s === side ? null : s)), 950);
    const into = side === "left" ? -1 : 1; // 네트는 골라인 바깥쪽 → 그쪽으로 굴러 들어감
    pos.current.x = clamp(g.x + g.w * 0.5, g.x + r, g.x + g.w - r);
    pos.current.y = clamp(pos.current.y, g.y + r, g.y + g.h - r);
    vel.current.x = into * 70; // 그물 안쪽으로 살짝(뒤그물에 걸려 멈춤)
    vel.current.y *= 0.18;
    ballZ.current = 0;
    ballVZ.current = 0;
    hapticSuccess();
    const concede: 0 | 1 = side === "left" ? 0 : 1;
    window.setTimeout(() => kickoff(concede), 1100);
  };

  // 골키퍼가 공에 닿음 — GK 손 액션. 백패스(아군이 발로 준 공)·박스 밖이면 손 못 쓰고 '발'로 처리.
  // 그 외(상대 슛)는 속도에 따라 catch(잡고 보유→배급) / parry(쳐냄) / punch(강하게 멀리).
  const doSave = (side: Side) => {
    const { w } = bounds();
    const defT: 0 | 1 = side === "left" ? 0 : 1;
    const incoming = lastTouch.current; // 손/발 판정 전에 '마지막 터치' 기록(백패스 판정)
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
    const speed = Math.hypot(vel.current.x, vel.current.y);
    const outward = side === "left" ? 1 : -1;
    const now = performance.now();
    const backPass = incoming === defT; // 아군이 준 공 → 손으로 못 잡음(규정)
    const inBox = keeperX.current[side] < w * 0.15; // 박스 밖으로 스위핑 나가면 손 금지

    if (backPass || !inBox) {
      // 발 처리 — 멀리 걷어낸다(클리어). 백패스를 손으로 잡으면 간접FK라 발로만.
      lastTouch.current = defT;
      vel.current.x = outward * (300 + Math.random() * 140);
      vel.current.y = rnd(-140, 140);
      if (now - saveAt.current > SAVE_COOLDOWN_MS) {
        saveAt.current = now;
        logEvent("save", defT, pos.current.x, pos.current.y, "clear");
      }
      return;
    }

    lastTouch.current = defT;
    if (speed < 360 && Math.abs(uy) < 0.7) {
      // CATCH — 정면·약한 공은 잡아서 보유(아래 keeperHold가 잠깐 들고 있다가 배급).
      keeperHold.current = { side, until: now + 820 };
      vel.current.x = 0;
      vel.current.y = 0;
      pos.current.x = kx + ux * minD * 0.6;
    } else {
      // PARRY/PUNCH — 빠를수록 강하게, 바깥으로 쳐낸다.
      const vn = vel.current.x * ux + vel.current.y * uy;
      if (vn < 0) {
        vel.current.x -= (1 + BALL_BOUNCE) * vn * ux;
        vel.current.y -= (1 + BALL_BOUNCE) * vn * uy;
      }
      const punch = speed >= 620;
      const minOut = punch ? 420 : 320; // 확실히 멀리 쳐내 키퍼서 빨리 벗어나게(재접촉·비빔 방지)
      if (Math.sign(vel.current.x) !== outward || Math.abs(vel.current.x) < minOut * 0.6) {
        vel.current.x = outward * Math.max(minOut, Math.abs(vel.current.x));
      }
      vel.current.y += rnd(-60, 60); // 쳐낸 방향 살짝 흩뜨림
      saveGrace.current = now + 450; // 쳐낸 직후 재세이브 차단 → 공이 깔끔히 튕겨 나감(루프 차단)
    }
    if (now - saveAt.current > SAVE_COOLDOWN_MS) {
      saveAt.current = now;
      setSaveFlash(side);
      logEvent("save", defT, pos.current.x, pos.current.y, speed < 360 ? "catch" : "parry");
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
        ? clamp(perceivedY.current[side] + wobble, g.y + kdDia() / 2 + 2.5, g.y + g.h - kdDia() / 2 - 2.5)
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
      // 몸 자체는 빠르지 않게(손 뻗기 다이브는 장갑이 따로 빠르게 처리). 러시도 선수 속도 안팎으로.
      const rushSpd = KEEPER_SPEED * (threat ? 0.55 + aggro * 0.45 : 0.6) * dt;
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
      if (p.red) return; // 퇴장 선수는 공 관여·점유 계산서 제외
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
        if (p.team === team && !p.red) ids.push(i); // 퇴장 선수는 순위·역할서 제외
      });
      const dOf = (i: number) => Math.hypot(players.current[i].x - bx, players.current[i].y - by);
      ids.sort((a, b) => dOf(a) - dOf(b));
      ids.forEach((idx, r) => {
        rank[idx] = r;
      });
    });

    // 세트피스 준비 중인가 — 그렇다면 키커(차는 팀 최근접)는 walk()가 공으로 데려가고, 나머지는
    // 스페이싱(상대는 공에서 법정거리 밖). 기본 축구 규정: 상대는 정해진 거리 물러나야 하며,
    // 던지려는/차려는 선수 주변에 떼로 압박하지 않는다(#4). 빈 공간 확보 → 즉시 재아웃 방지(#1).
    const pr = pendingRestart.current;
    let restartTaker = -1;
    if (pr && pr.team != null) {
      let td = Infinity;
      players.current.forEach((q, j) => {
        if (q.team !== pr.team || q.red) return;
        const dd = Math.hypot(q.x - bx, q.y - by);
        if (dd < td) {
          td = dd;
          restartTaker = j;
        }
      });
    }

    players.current.forEach((p, i) => {
      if (p.red) return; // 퇴장 — 더는 움직이지 않는다(필드서 빠짐, placePlayers가 시각도 숨김)
      // 세트피스 준비 — 키커는 walk()가 처리(스킵). 나머지는 자리 잡고, 상대는 공에서 물러난다.
      if (pr && pr.team != null) {
        if (i === restartTaker) return;
        const distBall = Math.hypot(p.x - bx, p.y - by);
        const legalR = w * 0.085; // ≈9.15m 스케일(상대 법정 거리)
        let stx: number;
        let sty: number;
        let sspd: number;
        if (p.team !== pr.team && distBall < legalR) {
          const aw = distBall > 0.1 ? Math.atan2(p.y - by, p.x - bx) : rnd(0, Math.PI * 2);
          stx = bx + Math.cos(aw) * legalR;
          sty = by + Math.sin(aw) * legalR;
          sspd = PLAYER_SPEED * 0.95;
        } else {
          const home = roleHome(p, p.team === pr.team ? 0.06 : -0.04);
          stx = home.x;
          sty = home.y;
          sspd = PLAYER_SPEED * 0.5;
        }
        const sdx = stx - p.x;
        const sdy = sty - p.y;
        const sd = Math.hypot(sdx, sdy) || 1;
        const smove = Math.min(sspd, sd * 4) * dt;
        p.x = clamp(p.x + (sdx / sd) * smove, fx.min, fx.max);
        p.y = clamp(p.y + (sdy / sd) * smove, PLAYER_R, h - PLAYER_R);
        return;
      }
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

    // 분리(separation) — 군집 자체는 막지 않는다(전술·성향상 모일 수 있음). 다만 '한 점'에 다 겹치는
    // 물리적으로 불가능한 상태만 막아, 아무리 붙어도 조랭이떡처럼 닿되 구분되게(최소간격=닿는 정도).
    // 모바일은 선수 시각크기(13)가 작으니 그만큼만 띄운다. O(n²)=400, 60fps 무리 없음.
    const minSep = (rotated.current ? 13 : PLAYER_R * 2) + 1;
    players.current.forEach((p, i) => {
      if (p.red) return;
      let sx = 0;
      let sy = 0;
      players.current.forEach((q, j) => {
        if (i === j || q.red) return;
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < minSep * minSep) {
          const d = Math.sqrt(d2);
          const f = (minSep - d) / minSep;
          sx += (dx / d) * f;
          sy += (dy / d) * f;
        }
      });
      if (sx !== 0 || sy !== 0) {
        const sd = Math.hypot(sx, sy) || 1;
        const sep = Math.min(PLAYER_SPEED * 0.6, sd * 30) * dt;
        p.x = clamp(p.x + (sx / sd) * sep, fx.min, fx.max);
        p.y = clamp(p.y + (sy / sd) * sep, PLAYER_R, h - PLAYER_R);
      }
    });
  };

  // 공 가진 선수 판단: 슛/패스(팀 점유성향+성격)/드리블. 성격(pass)이 낮으면 오차 큼.
  const playBall = (p: Player) => {
    lastTouch.current = p.team;
    kickAt.current = performance.now();
    const { w, h } = bounds();
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
      dribbleCount.current = 0;
      stats.current.shot[p.team] += 1;
      logEvent("shot", p.team, p.x, p.y);
      const tx = enemy === "left" ? g.x + g.w : g.x;
      const ty = g.y + g.h / 2 + (Math.random() * 2 - 1) * g.h * 0.5 * (1.2 - p.shoot);
      setVelTo(tx, ty, 480 + Math.random() * 150);
      return;
    }

    // ── 온볼 지능: 무작정 패스 X. 안 눌리고 앞 공간 있으면 끌고 가며(드리블) 간 보고, 압박이면
    //    개인기로 제치거나 안전하게 패스. 점유 성향 높을수록 더 끌고 유지. 연속 드리블은 cap 제한.
    if (lastBallPlayer.current !== p) {
      dribbleCount.current = 0; // 다른 선수가 잡으면 리셋
      lastBallPlayer.current = p;
    }
    const dir = enemy === "left" ? -1 : 1; // 공격 방향(+x 오른쪽 골 / -x 왼쪽 골)
    let oppNear = Infinity;
    let nearEx = 0;
    let nearEy = 0;
    let spaceAhead = w * 0.3;
    players.current.forEach((e) => {
      if (e.team === p.team) return;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < oppNear) {
        oppNear = d;
        nearEx = e.x;
        nearEy = e.y;
      }
      const fwd = (e.x - p.x) * dir; // 골 방향으로 얼마나 앞
      if (fwd > 0 && Math.abs(e.y - p.y) < h * 0.12) spaceAhead = Math.min(spaceAhead, fwd);
    });
    const pressed = oppNear < w * 0.05;
    const adventurous = p.pace * 0.4 + (1 - p.discipline) * 0.4; // 개인 드리블·모험 성향
    const canDribble = dribbleCount.current < 7;
    // 공간 있고 안 눌리면 끌고 간다(점유팀일수록 더). 압박이어도 개인기로 제치는 시도(모험가).
    const wantCarry =
      canDribble && !pressed && (spaceAhead > w * 0.1 || possession > 0.6) && Math.random() < 0.5 + (possession - 0.5) * 0.6;
    const wantBeatMan = canDribble && pressed && Math.random() < adventurous * 0.32;
    if (wantCarry || wantBeatMan) {
      dribbleCount.current += 1;
      let ang = Math.atan2(goalCy - p.y, goalCx - p.x); // 기본 골 방향
      if (wantBeatMan && oppNear < Infinity) {
        const away = Math.atan2(p.y - nearEy, p.x - nearEx); // 수비 반대쪽으로 제침(페인트)
        ang = ang * 0.45 + away * 0.55 + rnd(-0.3, 0.3);
      } else if (Math.random() < 0.32) {
        ang += rnd(-0.8, 0.8); // 간보기 — 횡으로 살짝 틀어 속이기(360도 간 보는 느낌)
      }
      const push = pressed ? 230 : 150 + Math.min(spaceAhead, w * 0.2);
      setVelTo(p.x + Math.cos(ang) * 60, p.y + Math.sin(ang) * 60, push);
      return;
    }
    dribbleCount.current = 0; // 패스/슛 결정하면 리셋

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
      const power = clamp(dpass * 3, 320, 760);
      setVelTo(m.x + rnd(-err, err), m.y + rnd(-err, err), power);
      // 롱패스는 띄워서 수비 너머로(점유 성향 낮은 직접축구일수록 더 짧은 거리에서도 띄운다).
      if (dpass > w * (0.2 + possession * 0.22)) loftBall(dpass, power);
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

  // 경기 시계 표시 문자열(피리어드 + MM:SS + 추가시간).
  const fmtClock = () => {
    const c = clock.current;
    const m = Math.floor(c.t);
    const s = Math.floor((c.t - m) * 60);
    const base = PERIOD_END[c.period - 1];
    const over = c.t > base ? ` +${Math.ceil(c.t - base)}'` : "";
    const pad = (n: number) => (n < 10 ? "0" + n : "" + n);
    return `${PERIOD_NAME[c.period - 1]} ${pad(m)}:${pad(s)}${over}`;
  };
  const startBreak = () => {
    breakUntil.current = performance.now() + HALF_BREAK_MS;
  };
  // ── 승부차기 ── 실제처럼 한 골만 쓰고, 차는 팀 선수 1명(원)이 도움닫기 후 차고, 막는 팀 키퍼가
  // 그 골을 지킨다. 매 키커마다 팀이 번갈며 키퍼도 교체(색 전환). 나머지는 하프라인서 관전.
  const pickKickerIndex = (team: 0 | 1, n: number): number => {
    const ids: number[] = [];
    players.current.forEach((p, i) => {
      if (p.team === team && !p.red) ids.push(i);
    });
    return ids.length ? ids[n % ids.length] : -1;
  };
  const shootoutDecided = (): 0 | 1 | null => {
    const s = shootout.current;
    const ra = Math.max(0, 5 - s.takenA);
    const rb = Math.max(0, 5 - s.takenB);
    if (s.takenA <= 5 && s.takenB <= 5) {
      if (s.a > s.b + rb) return 0; // 남은 킥으로 못 뒤집음
      if (s.b > s.a + ra) return 1;
    }
    // 정규 5키커 종료 또는 서든데스 — 같은 횟수 찬 뒤 차이나면 결정.
    if (s.takenA >= 5 && s.takenA === s.takenB && s.a !== s.b) return s.a > s.b ? 0 : 1;
    return null;
  };
  const pkBadge = (s: typeof shootout.current) =>
    `승부차기 ${s.round}R · ${s.turn === 0 ? "🔴" : "🔵"} 차례`;
  const startShootout = () => {
    const { w, h } = bounds();
    const s = shootout.current;
    s.active = true;
    s.a = 0;
    s.b = 0;
    s.takenA = 0;
    s.takenB = 0;
    s.round = 1;
    s.turn = Math.random() < 0.5 ? 0 : 1;
    s.phase = "setup";
    s.at = performance.now();
    s.scored = false;
    vel.current = { x: 0, y: 0 };
    ballZ.current = 0;
    ballVZ.current = 0;
    setMatchResult(null);
    setScore([0, 0]);
    scoreRef.current = [0, 0];
    flashPiece("승부차기");
    // 22명 하프라인(x=w/2)에 '한 줄'로 도열(관전). 골에서 보면 한 진영은 왼쪽(위 y), 다른 진영은
    // 오른쪽(아래 y)으로 촤르륵. tx/ty=각자 줄 위치(매 프레임 그쪽으로 천천히 복귀).
    players.current.forEach((p, i) => {
      const k = i % 10; // 팀 내 0..9
      p.red = false;
      p.x = w * 0.5;
      p.y =
        p.team === 0
          ? h * 0.5 - h * 0.05 - (k / 9) * h * 0.4 // 위 절반(중앙→위)
          : h * 0.5 + h * 0.05 + (k / 9) * h * 0.4; // 아래 절반(중앙→아래)
      p.tx = p.x;
      p.ty = p.y;
    });
    keeperX.current.left = 0;
    keeperX.current.right = 0;
    keeperY.current.left = h * 0.5;
    keeperY.current.right = h * 0.5;
    skPos.current = { left: null, right: null }; // 키퍼 걷기 위치 초기화(첫 프레임 스냅)
    s.kicker = pickKickerIndex(s.turn, 0); // 첫 키커(자기 줄에서 공까지 걸어나온다)
    setPkText({ a: 0, b: 0, turn: s.turn, round: 1, note: "" });
    setClockText(pkBadge(s));
  };
  const PK_SETUP = 1500; // 키커가 슬슬 걸어나와 공 뒤에 서는 도움닫기 시간
  const PK_RUN = 640;
  const PK_RESULT = 1300;
  // 승부차기는 항상 '오른쪽' 골 하나만 쓴다. 막는 팀(차는 팀의 반대) 키퍼가 그 골을 지킨다.
  const runShootout = (tNow: number, dt: number) => {
    const s = shootout.current;
    const { w, h } = bounds();
    const goalLineX = w - insetX();
    const spotX = goalLineX - w * 0.105; // 페널티 스폿
    const spotY = h * 0.5;
    const ballGap = kdDia() * 0.5 + 9; // 키커가 공 바로 뒤에 서는 간격
    // 관전자(키커 제외)는 자기 줄로 복귀.
    players.current.forEach((p, i) => {
      if (i === s.kicker) return;
      const sp = PLAYER_SPEED * 0.22 * dt; // 천천히 복귀(현장감)
      p.x += clamp(p.tx - p.x, -sp, sp);
      p.y += clamp(p.ty - p.y, -sp, sp);
    });
    if (s.phase === "setup") {
      pos.current.x = spotX;
      pos.current.y = spotY;
      vel.current = { x: 0, y: 0 };
      keeperX.current.right = 0;
      keeperY.current.right = spotY;
      // 키커 도움닫기 — 미드필드에서 공 뒤로 슬슬 걸어와 선다.
      const k = s.kicker >= 0 ? players.current[s.kicker] : null;
      // 도움닫기 — lerp라 거리 상관없이 일정 시간에 공 뒤 도착(웹의 먼 진영도). 천천히 걸어나옴.
      if (k) {
        k.x += (spotX - ballGap - k.x) * 0.055;
        k.y += (spotY - k.y) * 0.055;
      }
      // '실제로 공 뒤 도착'했을 때만 찬다 — 안 닿고 날아가던 문제 차단(시간 강제 없음, 도착이 조건).
      const kickerAtBall =
        !k || Math.hypot(k.x - (spotX - ballGap), k.y - spotY) < ballGap * 1.1;
      if (tNow - s.at >= 500 && kickerAtBall) {
        const skill = k ? k.shoot : 0.6;
        s.scored = Math.random() < 0.5 + skill * 0.32; // 키커 슛 능력 → 성공률
        const top = Math.random() < 0.5;
        s.targetY = spotY + (top ? -1 : 1) * goalH() * 0.42;
        s.guessY = s.scored ? spotY + (top ? 1 : -1) * goalH() * 0.55 : s.targetY; // 막으면 같은 쪽 다이브
        setVelTo(goalLineX + 6, s.targetY, 660);
        stats.current.shot[s.turn] += 1;
        s.phase = "run";
        s.at = tNow;
      }
    } else if (s.phase === "run") {
      // 키커 팔로스루(공 쪽으로 한두 발).
      const k = s.kicker >= 0 ? players.current[s.kicker] : null;
      if (k) {
        const sp = PLAYER_SPEED * 0.35 * dt;
        k.x += clamp(spotX - ballGap * 0.3 - k.x, -sp, sp);
      }
      // 다이브 — 단 키퍼 몸이 골 포스트(상·하) 밖으로 안 나가게 마우스 범위 안으로 clamp.
      const kp = keeperY.current.right;
      const gR = goalRect("right");
      const kdH = kdDia() / 2 + 2.5; // +ring(2px 테두리 하이라이트)도 포스트 안
      keeperY.current.right = clamp(
        kp + clamp(s.guessY - kp, -26, 26),
        gR.y + kdH,
        gR.y + gR.h - kdH
      );
      pos.current.x += vel.current.x * dt;
      pos.current.y += vel.current.y * dt;
      if (!s.scored && pos.current.x >= goalLineX - 2) {
        pos.current.x = goalLineX - 3; // 막힘 — 골라인서 멈춤
        vel.current = { x: 0, y: 0 };
      } else if (s.scored && pos.current.x >= goalLineX) {
        // 골 — 네트에 푹 박힌다(뚫고 날아가지 않게). 그물 출렁임은 골 판정 때 setNetFlash.
        pos.current.x = goalLineX + goalW() * 0.5;
        pos.current.y = s.targetY;
        vel.current = { x: 0, y: 0 };
        ballZ.current = 0;
      }
      if (tNow - s.at >= PK_RUN) {
        if (s.scored) {
          if (s.turn === 0) s.a += 1;
          else s.b += 1;
          burstConfetti(goalLineX, s.targetY);
          setGoalFlash(true);
          window.setTimeout(() => setGoalFlash(false), 800);
          setNetFlash("right"); // 승부차기에도 그물 출렁임
          window.setTimeout(() => setNetFlash((n) => (n === "right" ? null : n)), 700);
          hapticSuccess();
        } else {
          setSaveFlash("right");
          window.setTimeout(() => setSaveFlash(null), 800);
          hapticTick();
        }
        if (s.turn === 0) s.takenA += 1;
        else s.takenB += 1;
        setScore([s.a, s.b]); // 스코어 박스에 PK 누계 표시
        scoreRef.current = [s.a, s.b];
        setPkText({ a: s.a, b: s.b, turn: s.turn, round: s.round, note: s.scored ? "성공" : "실패" });
        s.phase = "result";
        s.at = tNow;
      }
    } else if (s.phase === "result") {
      if (tNow - s.at >= PK_RESULT) {
        const dec = shootoutDecided();
        if (dec != null) {
          endShootout(dec);
          return;
        }
        s.turn = s.turn === 0 ? 1 : 0; // 팀 교대(키퍼도 교체됨)
        s.round = Math.min(s.takenA, s.takenB) + 1;
        s.kicker = pickKickerIndex(s.turn, s.turn === 0 ? s.takenA : s.takenB); // 자기 줄에서 걸어나옴
        s.phase = "setup";
        s.at = tNow;
        s.scored = false;
        setPkText({ a: s.a, b: s.b, turn: s.turn, round: s.round, note: "" });
        setClockText(pkBadge(s));
      }
    }
  };
  const endShootout = (winner: 0 | 1) => {
    const s = shootout.current;
    s.active = false;
    clock.current.ended = true;
    setMatchResult(`${winner === 0 ? "🔴" : "🔵"} 승리 · PK ${s.a}:${s.b}`);
    setPkText(null);
    flashPiece("경기 종료");
    window.setTimeout(() => {
      clock.current.ended = false;
      buildMatch();
      centerBall();
      passToNearestTeammate(Math.random() < 0.5 ? 0 : 1, pos.current.x, pos.current.y, 200);
      lastActiveAt.current = performance.now();
    }, MATCH_END_RESTART_MS);
  };

  const endMatch = () => {
    clock.current.ended = true;
    const [a, b] = scoreRef.current;
    const res = a === b ? `무승부  ${a} : ${b}` : a > b ? `🔴 승리  ${a} : ${b}` : `🔵 승리  ${a} : ${b}`;
    setMatchResult(res);
    flashPiece("경기 종료");
    // 결과 보여준 뒤 자동 새 경기.
    window.setTimeout(() => {
      buildMatch();
      centerBall();
      passToNearestTeammate(Math.random() < 0.5 ? 0 : 1, pos.current.x, pos.current.y, 200);
      lastActiveAt.current = performance.now();
    }, MATCH_END_RESTART_MS);
  };
  const endPeriod = () => {
    const c = clock.current;
    let advanced = false;
    if (c.period === 1) {
      c.period = 2;
      c.t = 45;
      flashPiece("하프타임");
      advanced = true;
    } else if (c.period === 2) {
      if (scoreRef.current[0] === scoreRef.current[1]) {
        c.period = 3;
        c.t = 90;
        flashPiece("연장 전반");
        advanced = true;
      } else {
        endMatch();
      }
    } else if (c.period === 3) {
      c.period = 4;
      c.t = 105;
      flashPiece("연장 후반");
      advanced = true;
    } else if (scoreRef.current[0] === scoreRef.current[1]) {
      startShootout(); // 연장까지 동점 → 승부차기
    } else {
      endMatch();
    }
    if (advanced) {
      c.added = 0;
      startBreak();
      centerBall();
      window.setTimeout(() => kickoff(Math.random() < 0.5 ? 0 : 1), HALF_BREAK_MS);
    }
  };
  // 매 프레임 호출(플레이 중). 1 real초 = 1 게임분. 휴식 중엔 정지. 표시는 throttle.
  const tickClock = () => {
    const c = clock.current;
    if (c.ended || shootout.current.active || performance.now() < breakUntil.current) return;
    c.t += 1 / 60;
    if (possTeam.current != null) stats.current.poss[possTeam.current] += 1; // 점유 프레임 누적
    if (c.t >= PERIOD_END[c.period - 1] + c.added) endPeriod();
    if (++clockTick.current % 12 === 0) {
      setClockText(fmtClock());
      const s = stats.current;
      const tp = s.poss[0] + s.poss[1] || 1;
      setStatText({
        poss: [Math.round((s.poss[0] / tp) * 100), Math.round((s.poss[1] / tp) * 100)],
        shot: [s.shot[0], s.shot[1]],
        foul: [s.foul[0], s.foul[1]],
        yellow: [s.yellow[0], s.yellow[1]],
        red: [s.red[0], s.red[1]]
      });
    }
  };

  const step = () => {
    const { w, h } = bounds();
    const dt = 1 / 60;
    const tNow = performance.now();
    // 동작 줄이기(reduce-motion)여도, 사용자가 자동경기를 '직접' 켜면 돈다(명시적 opt-in).
    // 자동 '시작'만 reduce-motion에서 끈다(아래 마운트). 깜짝 모션 없음 + 켜면 작동.
    const run = runningRef.current;
    if (run) tickClock(); // 경기 시계(1 real초=1 게임분). 휴식/종료 중엔 내부에서 정지.

    // 세트피스 프리즈 — 공은 라인에 멈추고, walk()가 키커(선수/키퍼)를 매 프레임 공으로 데려온다.
    // 예약 시각이 되면 kick 실행(그 키커 위치에서 공이 나가 '누가 차는' 모양).
    if (pendingRestart.current) {
      if (pendingRestart.current.walk) pendingRestart.current.walk();
      if (tNow >= pendingRestart.current.at) {
        const k = pendingRestart.current.kick;
        pendingRestart.current = null;
        k();
        restartGrace.current = tNow + 450; // 킥 후 잠깐 라인아웃·접촉 무시 → 공이 깔끔히 인플레이
        lastActiveAt.current = tNow;
      }
    }
    // GK 잡기 보유 — 키퍼가 공을 손에 들고 있는 동안 공을 키퍼에 고정, 시간 되면 배급(스로/펀트).
    if (keeperHold.current.side) {
      const hside = keeperHold.current.side;
      const hT: 0 | 1 = hside === "left" ? 0 : 1;
      pos.current.x = keeperCenterX(hside);
      pos.current.y = keeperY.current[hside];
      vel.current = { x: 0, y: 0 };
      ballZ.current = 0;
      if (tNow >= keeperHold.current.until) {
        keeperHold.current = { side: null, until: 0 };
        const upX = hside === "left" ? 1 : -1;
        if (Math.random() < 0.55) {
          // 스로(가까운 동료에게 짧고 정확히).
          passToNearestTeammate(hT, pos.current.x, pos.current.y, 300);
        } else {
          // 펀트(업필드 롱·띄움).
          const { w: bw, h: bh } = bounds();
          const tx = pos.current.x + upX * bw * 0.5;
          setVelTo(tx, bh * 0.5 + rnd(-bh * 0.22, bh * 0.22), 540);
          loftBall(bw * 0.5, 540);
          lastTouch.current = hT;
        }
        restartGrace.current = tNow + 280;
      }
    }
    // 승부차기 — 정규 22인 시뮬을 멈추고 스크립트 시퀀스(키커·키퍼·공)만 돌린다.
    if (shootout.current.active) {
      runShootout(tNow, dt);
      placePlayers();
      placeKeepers();
      place();
      raf.current =
        enabledRef.current && runningRef.current ? window.requestAnimationFrame(step) : null;
      return;
    }

    // 프리즈 = 세트피스 대기 OR 하프타임/피리어드 휴식 OR 경기 종료 → 모든 플레이 정지(공·선수·득점).
    const frozen =
      pendingRestart.current != null ||
      keeperHold.current.side != null ||
      tNow < breakUntil.current ||
      clock.current.ended;

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

    // 공 높이(띄우기) 적분 — 떠 있으면(airborne) 선수·키퍼·골대벽을 통과(롱볼이 넘어감).
    if (!dragging.current && !frozen && (ballVZ.current !== 0 || ballZ.current > 0)) {
      ballZ.current += ballVZ.current * dt;
      ballVZ.current -= GRAVITY_Z * dt;
      if (ballZ.current <= 0) {
        ballZ.current = 0;
        ballVZ.current = 0;
      }
    }
    const airborne = ballZ.current > AIR_MIN;

    if (!dragging.current && !frozen) {
      pos.current.x += vel.current.x * dt;
      pos.current.y += vel.current.y * dt;
      vel.current.x *= FRICTION;
      vel.current.y *= FRICTION;
      const mx = insetX(); // 골라인(좌우)
      const my = insetY(); // 터치라인(위아래)
      // 좌우 = 골라인. 골문 안이면 득점/세이브/골대벽이 처리. 밖이면 경기 중 코너/골킥, 아니면 튕김.
      if (pos.current.x < mx || pos.current.x > w - mx) {
        const side: Side = pos.current.x < mx ? "left" : "right";
        const g = goalRect(side);
        const inMouth = pos.current.y > g.y && pos.current.y < g.y + g.h;
        if (inMouth) {
          // 골문 안으로 — 라인아웃 아님(골대 뒤벽/득점 로직이 처리).
        } else if (tNow < restartGrace.current) {
          // 세트피스 킥 유예 — 라인아웃 안 잡고 살짝 안으로 밀어 인플레이 유지(재아웃 루프 차단).
          pos.current.x = pos.current.x < mx ? mx + 2 : w - mx - 2;
        } else if (run) {
          goalLineOut(side);
        } else if (pos.current.x < mx) {
          pos.current.x = mx;
          vel.current.x = -vel.current.x * WALL_RESTITUTION;
        } else {
          pos.current.x = w - mx;
          vel.current.x = -vel.current.x * WALL_RESTITUTION;
        }
      }
      // 위/아래 = 터치라인. 경기 중이면 스로인.
      if (pos.current.y < my || pos.current.y > h - my) {
        if (tNow < restartGrace.current) {
          pos.current.y = pos.current.y < my ? my + 2 : h - my - 2;
        } else if (run) {
          throwIn(pos.current.y < my ? "top" : "bottom");
        } else if (pos.current.y < my) {
          pos.current.y = my;
          vel.current.y = -vel.current.y * WALL_RESTITUTION;
        } else {
          pos.current.y = h - my;
          vel.current.y = -vel.current.y * WALL_RESTITUTION;
        }
      }
      // 떠 있으면 골대벽도 통과(공중볼이 골문 위로/안으로 넘어갈 수 있게).
      if (!airborne) {
        for (const side of ["left", "right"] as Side[]) {
          for (const wll of goalWalls(side)) resolveCircleAABB(wll);
        }
      }
    }

    const speed = Math.hypot(vel.current.x, vel.current.y);
    const now = performance.now();
    if (!dragging.current && !frozen && !airborne && now >= restartGrace.current) {
      players.current.forEach((p, i) => {
        if (p.red) return; // 퇴장 선수는 공에 관여 안 함
        const minD = ballDia() / 2 + PLAYER_R;
        const d = Math.hypot(pos.current.x - p.x, pos.current.y - p.y);
        if (d >= minD) return;
        // 파울 — 공 가진 상대를 막는 수비수가 거칠게(규율 낮을수록↑). 쿨다운으로 스팸 방지.
        if (
          run &&
          lastTouch.current != null &&
          p.team !== lastTouch.current &&
          now - foulAt.current > 1600 &&
          now - kickAt.current > 200 &&
          Math.random() < 0.018 + (1 - p.discipline) * 0.03
        ) {
          callFoul(p);
          return;
        }
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
        logEvent("ballDrop");
      }
    }

    place();
    placeKeepers();

    const cx = pos.current.x;
    const cy = pos.current.y;
    const r = ballDia() / 2;
    let saved = false;
    if (!frozen) {
      // 떠 있는 공은 키퍼가 못 잡는다(머리 위로 넘어감) → 칩샷/로빙은 골 가능. 득점 판정은 유지.
      // 세이브 직후 유예(saveGrace) 동안은 재세이브 스킵 → 공이 튕겨 나가게(진동·묶임 방지).
      if (!airborne && now >= saveGrace.current) {
        for (const side of ["left", "right"] as Side[]) {
          const kx = keeperCenterX(side);
          const ky = keeperY.current[side];
          const bodyHit = Math.hypot(cx - kx, cy - ky) < r + kdDia() / 2;
          // 뻗은 장갑으로도 막는다 — 한 손이 멀리 나가 있으면 몸이 못 닿는 공도 쳐낸다(긴 리치).
          const gloveR = kdDia() * 0.34;
          const gloveHit = glovePos.current[side].some(
            (gp) => Math.hypot(cx - (kx + gp.x), cy - (ky + gp.y)) < r + gloveR
          );
          if (bodyHit || gloveHit) {
            doSave(side);
            saved = true;
          }
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
      // 숨기기 — 루프만 멈춘다. 경기 상태(선수·점수·시계·공)는 ref에 보존되어 다시 켜면 이어진다.
      if (raf.current != null) {
        window.cancelAnimationFrame(raf.current);
        raf.current = null;
      }
      return;
    }
    // 진행 중인 경기가 없을 때만(첫 진입) 새 경기. 숨겼다 켜면 기존 경기를 이어서 한다.
    const fresh = players.current.length === 0;
    if (fresh) {
      const { h } = bounds();
      keeperY.current.left = h * 0.5;
      keeperY.current.right = h * 0.5;
      perceivedY.current.left = h * 0.5;
      perceivedY.current.right = h * 0.5;
      buildMatch();
      centerBall();
      passToNearestTeammate(Math.random() < 0.5 ? 0 : 1, pos.current.x, pos.current.y, 200);
    }
    place();
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

  // 경기 중 팀 전술 변경 — 포메이션/위치는 두고 압박·점유·템포·라인·폭만 바꾼다(하이프레스↔텐백 등).
  const applyTeamStyle = (team: 0 | 1, s: TacticStyle) => {
    if (!teams.current) return;
    const cur = teams.current[team];
    teams.current[team] = {
      ...cur,
      name: s.name,
      press: s.press,
      possession: s.possession,
      tempo: s.tempo,
      lineHeight: s.lineHeight,
      width: s.width
    };
    setTeamNames((n) => (team === 0 ? [s.name, n[1]] : [n[0], s.name]));
    setStyleNames((n) => (team === 0 ? [s.name, n[1]] : [n[0], s.name]));
    hapticTick();
  };

  // 사용자가 명시적으로 새 경기 시작(점수·시계 리셋). 자동 종료 재시작과 별개.
  const newMatch = () => {
    buildMatch();
    centerBall();
    passToNearestTeammate(Math.random() < 0.5 ? 0 : 1, pos.current.x, pos.current.y, 200);
    lastActiveAt.current = performance.now();
    hapticTick();
    if (runningRef.current) ensureLoop();
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
    ballZ.current = 0; // 잡으면 공을 손/땅으로 내린다
    ballVZ.current = 0;
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

  // 골대 바깥 가장자리(px) — 입구가 골라인(insetX), 몸통은 라인 밖. 비율이라 bounds 기준 계산.
  const goalEdgePx = () => insetX() - goalW();
  const goalStyle = (side: Side): React.CSSProperties => ({
    [side]: `${goalEdgePx()}px`,
    top: `calc(50% - ${goalH() / 2}px)`,
    width: `${goalW()}px`,
    height: `${goalH()}px`
  });
  const kdRender = isMobile ? 13 * 1.2 : PLAYER_R * 2 * 1.2; // 시각 크기(kdDia와 동일 = 선수 1.2배)
  const keeperStyle = (side: Side): React.CSSProperties => ({
    [side]: `${goalEdgePx() + goalW() - kdRender}px`,
    top: "0",
    width: `${kdRender}px`,
    height: `${kdRender}px`
  });

  // 팀 카드 표시 — 웹은 개수만큼 핍(공간 여유), 모바일은 폭 절약 위해 색칩+숫자(🟨2 🟥1, 고정폭).
  const renderTeamCards = (y: number, r: number) => {
    if (y + r === 0) return null;
    if (isMobile) {
      return (
        <span className="wc-score-cards wc-cards-mini">
          {y > 0 ? <em className="wc-cmini wc-cmini-y">{y}</em> : null}
          {r > 0 ? <em className="wc-cmini wc-cmini-r">{r}</em> : null}
        </span>
      );
    }
    return (
      <span className="wc-score-cards">
        {Array.from({ length: Math.min(y, 4) }).map((_, i) => (
          <i key={`y${i}`} className="wc-card wc-card-y" />
        ))}
        {Array.from({ length: Math.min(r, 4) }).map((_, i) => (
          <i key={`r${i}`} className="wc-card wc-card-r" />
        ))}
      </span>
    );
  };

  return (
    <div className={`wc-play ${enabled ? "on" : ""}`} aria-hidden="true">
      {enabled ? (
        <>
          <div
            className="wc-dim"
            onClick={() => {
              // 빈 곳 탭/클릭하면 열린 패널(선수카드·전술·기록) 모두 닫기.
              pinnedPlayer.current = false;
              setPickPlayer(null);
              setTacticsOpen(false);
              setStatsOpen(false);
            }}
          />
          {/* 피치 본체 — 모바일에선 이 stage만 90° 세워 세로 피치로. 물리는 landscape 그대로. */}
          <div className="wc-stage" ref={layerRef}>
            <div className="wc-pitch" aria-hidden="true">
              <span className="wc-bound" />
              <span className="wc-mid" />
              <span className="wc-circle" />
              <span className="wc-spot" />
              <span className="wc-box wc-box-left" />
              <span className="wc-box wc-box-right" />
              <span className="wc-six wc-six-left" />
              <span className="wc-six wc-six-right" />
            </div>

            {(["left", "right"] as Side[]).map((side) => (
              <div
                className={`wc-goal wc-goal-${side} ${netFlash === side ? "wc-goal-scored" : ""}`}
                key={side}
                style={goalStyle(side)}
              >
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
                <i
                  className="wc-glove"
                  ref={(el) => {
                    glovesRef.current[side][0] = el;
                  }}
                />
                <i
                  className="wc-glove"
                  ref={(el) => {
                    glovesRef.current[side][1] = el;
                  }}
                />
              </div>
            ))}
            {Array.from({ length: 20 }).map((_, i) => {
              const team = i < 10 ? 0 : 1;
              return (
                <div
                  key={`p-${i}`}
                  className={`wc-player wc-team-${team} ${pickPlayer === i ? "wc-player-pick" : ""}`}
                  style={{
                    width: `${isMobile ? 13 : PLAYER_R * 2}px`,
                    height: `${isMobile ? 13 : PLAYER_R * 2}px`
                  }}
                  onPointerEnter={
                    // 웹: 마우스로 스치기만 해도 카드가 뜨고 그대로 유지(이탈해도 안 사라짐). 화면(딤)
                    // 클릭하면 닫힘. 작은 점도 잘 걸리게 ::after로 히트영역 확대(CSS).
                    isMobile ? undefined : () => setPickPlayer(i)
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    setPickPlayer((c) => (c === i ? null : i)); // 모바일 탭/웹 클릭 토글
                    hapticTick();
                  }}
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

      {/* HUD — 항상 똑바로(회전 X). 피치가 105:68로 줄어 생긴 여백(모바일 위/아래)에 스코어·버튼이
          놓여 경기장을 가리지 않는다. */}
      <div className="wc-hud">
        {enabled ? (
          <>
            <div className="wc-score" role="status">
              <span className="wc-score-team wc-score-a">
                {teamNames[0] || "RED"}
                {renderTeamCards(cardCounts.yellow[0], cardCounts.red[0])}
              </span>
              <strong className="wc-score-num">
                {score[0]} <span>:</span> {score[1]}
              </strong>
              <span className="wc-score-team wc-score-b">
                {renderTeamCards(cardCounts.yellow[1], cardCounts.red[1])}
                {teamNames[1] || "BLUE"}
              </span>
            </div>
            {clockText ? <div className="wc-clock">{clockText}</div> : null}
            <button
              type="button"
              className={`wc-tac-btn ${tacticsOpen ? "on" : ""}`}
              onClick={() => {
                setTacticsOpen((o) => !o);
                hapticTick();
              }}
              aria-pressed={tacticsOpen}
            >
              ⚙ 전술
            </button>
            <button
              type="button"
              className={`wc-tac-btn wc-stat-btn ${statsOpen ? "on" : ""}`}
              onClick={() => {
                setStatsOpen((o) => !o);
                hapticTick();
              }}
              aria-pressed={statsOpen}
            >
              📊 기록
            </button>
            {statsOpen && statText ? (
              <div className="wc-stats">
                <div className="wc-stat-head">
                  <b className="a">{teamNames[0] || "RED"}</b>
                  <span>경기 기록</span>
                  <b className="b">{teamNames[1] || "BLUE"}</b>
                </div>
                {(
                  [
                    ["점유", `${statText.poss[0]}%`, `${statText.poss[1]}%`],
                    ["슛", statText.shot[0], statText.shot[1]],
                    ["파울", statText.foul[0], statText.foul[1]],
                    ["🟨 옐로", statText.yellow[0], statText.yellow[1]],
                    ["🟥 레드", statText.red[0], statText.red[1]]
                  ] as const
                ).map(([label, a, bb]) => (
                  <div className="wc-stat-row" key={label}>
                    <b className="a">{a}</b>
                    <span>{label}</span>
                    <b className="b">{bb}</b>
                  </div>
                ))}
              </div>
            ) : null}
            {goalFlash ? <div className="wc-goal-text">GOAL!</div> : null}
            {saveFlash ? <div className={`wc-save-text wc-save-${saveFlash}`}>막았다!</div> : null}
            {setPiece ? <div className="wc-setpiece">{setPiece}</div> : null}
            {matchResult ? <div className="wc-result">{matchResult}</div> : null}
            {pickPlayer != null && players.current[pickPlayer]
              ? (() => {
                  const p = players.current[pickPlayer];
                  const roleKo: Record<string, string> = {
                    DF: "수비",
                    DM: "수비형 MF",
                    MF: "중앙 MF",
                    WG: "윙",
                    FW: "공격"
                  };
                  const form = teams.current?.[p.team]?.formation ?? "";
                  const cards = p.red ? "🟥" : p.yellow >= 2 ? "🟨🟨" : p.yellow === 1 ? "🟨" : "";
                  const rows: [string, number][] = [
                    ["스피드", p.pace],
                    ["압박", p.press],
                    ["패스", p.pass],
                    ["슛", p.shoot],
                    ["침착", p.discipline]
                  ];
                  return (
                    <div className={`wc-pcard wc-pcard-${p.team}`}>
                      <div className="wc-pcard-head">
                        <b className="num">{p.num}</b>
                        <span>
                          {roleKo[p.slot.role]} · {form}
                        </span>
                        {cards ? <span className="pc-card">{cards}</span> : null}
                      </div>
                      <div className="wc-pcard-stam-row">
                        <span>체력</span>
                        <div className="wc-pcard-bar">
                          <i style={{ width: `${Math.round(p.stamina * 100)}%` }} />
                        </div>
                      </div>
                      {rows.map(([label, v]) => (
                        <div className="wc-pcard-stat" key={label}>
                          <span>{label}</span>
                          <div className="wc-pcard-bar">
                            <i style={{ width: `${Math.round(v * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              : null}
          </>
        ) : null}
        {enabled && tacticsOpen ? (
          <div className="wc-tactics">
            {([0, 1] as const).map((team) => (
              <div className={`wc-tac-col wc-tac-${team}`} key={team}>
                <span className="wc-tac-label">{team === 0 ? "🔴" : "🔵"}</span>
                <div className="wc-tac-chips">
                  {STYLES.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      className={`wc-tac-chip ${styleNames[team] === s.name ? "on" : ""}`}
                      onClick={() => applyTeamStyle(team, s)}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
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
            {isMobile ? "자동" : "자동 경기"}
          </button>
        ) : null}
        {enabled ? (
          <button type="button" className="wc-toggle" onClick={newMatch}>
            <span className="wc-toggle-ico" aria-hidden="true">
              ↻
            </span>
            {isMobile ? "새경기" : "새 경기"}
          </button>
        ) : null}
        <button type="button" className="wc-toggle wc-toggle-event" onClick={toggleEnabled}>
          <span className="wc-toggle-ico" aria-hidden="true">
            ⚽
          </span>
          {enabled ? (isMobile ? "숨기기" : "미니게임 숨기기") : isMobile ? "켜기" : "미니게임 켜기"}
        </button>
        </div>
      </div>
    </div>
  );
}
