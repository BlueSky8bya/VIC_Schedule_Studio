"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { hapticSuccess, hapticTick } from "@/lib/ui/haptics";
import { reduceMotionEnabled } from "@/lib/ui/motion"; // OS reduce-motion 무시, 앱 토글만
import type { PlayerPersona, RestartKind, Side, TeamPlan, Vec2 } from "@/lib/football/core/types";
import { makeRng, randomSeed } from "@/lib/football/core/rng";
import { makeMatchup, STYLES, type TacticStyle } from "@/lib/football/tactics/profiles";
import { createEventLog, type MatchEventKind } from "@/lib/football/core/event-log";
import { xgFromShot } from "@/lib/football/analytics/xg-lite";
import { xtValue } from "@/lib/football/analytics/xt-grid";
import { passProbability } from "@/lib/football/analytics/pitch-control-lite";
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
  knock: number; // 0..1 타박/부상 — 거친 태클로 누적. 속도·민첩 저하, 시간이 지나면 회복(천천히).
  downUntil: number; // 이 시각까지 부상으로 쓰러져 정지(심한 knock 직후 잠깐).
  tackleAt: number; // 마지막 태클 시도 시각(개별 쿨다운 — 견제 거리서 발 넣기 스팸 방지).
  vmag: number; // 현재 이동 속력(px/s) — 가속/감속 램프(정지→전력·전력→정지 즉발 방지).
  acute: number; // 0..1 급성 피로 — 스프린트로 빠르게↑, 걸으면 빠르게↓. 톱스피드·정확도·압박의지 저하.
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
const TRAP_MAX = 660; // 이보다 빠르면 못 받고 튕긴다(아주 강한 슛/롱볼). 이하면 퍼스트터치 시도.
const KICK_CD = 340; // 통제 후 다음 결정까지(짧을수록 패스/슛 빨리 — 발밑에 오래 잡고 안 있게)
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
  const keeperFront = useRef<Record<Side, boolean>>({ left: false, right: false }); // z 전환 히스테리시스
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
  // 드리블 턴 스무딩 — 캐리(끌기) 터치는 공 진행방향을 '즉시' 꺾지 않고 목표 속도로 매 프레임
  // 수렴시킨다 → 공 잡고 방향 틀 때 휙 도는 대신 호를 그리며 이어지듯 돈다(패스/슛은 즉발 유지).
  const carrySteer = useRef<{ vx: number; vy: number } | null>(null);
  // 주 발 회전(커브/바나나킥) — 차는 순간 정한 각속도(rad/s, 부호=휘는 방향). 비행 중 매 프레임 속도
  // 벡터를 이만큼 돌려 공이 휜다. 느려지면/다음 터치면 0. 오른발=왼쪽으로, 왼발=오른쪽으로 인스윙.
  const ballSpin = useRef(0);
  const ballRoll = useRef(0); // 공 시각 회전각(deg) — 커브(ballSpin) 방향·세기에 따라 실제로 돈다(스핀)
  const dribbleCount = useRef(0); // 연속 드리블 터치 수(상한으로 무한 드리블 방지)
  const angleCarry = useRef(0); // 패스길 없을 때 '각 만들기' 끌기 수(상한 닿으면 안전 패스로 전환)
  const lastBallPlayer = useRef<Player | null>(null); // 직전 볼 처리 선수 — 바뀌면 드리블 카운트 리셋
  const lastTouch = useRef<0 | 1 | null>(null);
  const lastActiveAt = useRef(0);
  const headerCount = useRef(0); // 연속 헤딩 수 — 캡 넘으면 공을 죽여 지면 컨트롤로(헤딩 남발 방지)
  // 골 세레모니 — 득점 직후 잠깐 득점 팀이 신나서 뛴다(kind별 연출). x/y=연출 초점(코너·득점지점 등).
  const celebrate = useRef<{ team: 0 | 1; until: number; kind: number; x: number; y: number } | null>(
    null
  );
  const reduced = useRef(false);
  const rotated = useRef(false); // 모바일(≤640px): stage를 90° 세워 세로 피치로 — 입력 역매핑 필요
  const confettiId = useRef(0);
  const matchSeed = useRef(0); // 이번 경기 시드(리플레이/디버그) — 엔진 생성의 재현 키
  const matchStart = useRef(0); // 경기 시작 시각(이벤트 t 기준)
  const eventLog = useRef(createEventLog()); // 골/세트피스/오프사이드 등 이벤트 기록(Phase 0 토대)
  // 경기 시계 — 1 real초 = 1 게임분. 전반 0~45, 후반 45~90 + 추가시간(세트피스로 누적). 동점이면
  // 연장(90~105, 105~120). 종료 시 결과 띄우고 자동 새 경기. breakUntil 동안은 정지(하프타임).
  const clock = useRef({ t: 0, period: 1, added: 0, ended: false, addedAnnounced: false });
  // 진영 교체 — 실제 축구처럼 매 피리어드(전반→후반, 연장 포함)마다 두 팀이 골대를 바꾼다. false면
  // 기본(team0가 오른쪽 골 공격), true면 반대. 모든 방향 로직은 아래 atkDir/enemyGoalOf 등을 통한다.
  const periodFlip = useRef(false);
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
  const [phaseBanner, setPhaseBanner] = useState<string | null>(null); // 하프타임·연장·추가시간 중앙 배너
  const bannerTimer = useRef<number | null>(null);
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
  const [tacticDesc, setTacticDesc] = useState<TacticStyle | null>(null); // 전술 호버/탭 → 풀네임+설명 박스
  const [namesOpen, setNamesOpen] = useState<0 | 1 | null>(null); // 모바일: 탭한 진영 전술명 풀네임(...된 것만)
  const [pickPlayer, setPickPlayer] = useState<number | null>(null); // 호버/탭한 선수(정보 카드)
  const [pickKeeper, setPickKeeper] = useState<Side | null>(null); // 탭/클릭한 골키퍼(정보 카드)
  // 필드 위치 단서 — 오프사이드(세로 라인+깃발)·파울/카드(호루라기/카드)를 발생 위치에 잠깐 띄움.
  // 공이 갑자기 순간이동(오프사이드)하거나 파울 위치를 모르던 가시성 문제 해결.
  const [fieldCue, setFieldCue] = useState<{
    id: number;
    kind: "offside" | "foul" | "setpiece";
    x: number;
    y: number;
    lineX?: number;
    label: string;
  } | null>(null);
  const cueTimer = useRef<number | null>(null);
  const pinnedPlayer = useRef(false); // 클릭으로 고정됐는가(호버 이탈해도 유지)
  const [styleNames, setStyleNames] = useState<[string, string]>(["", ""]); // 현재 팀별 전술명(칩 강조용)
  // 세트피스(스로인/코너/골킥/킥오프/오프사이드)는 라인에 잠깐 멈췄다 재개 — 딜레이 후 kick 실행.
  const pendingRestart = useRef<{
    at: number;
    kick: () => void;
    walk?: () => boolean; // 키커를 공으로 데려오고, '도착했는가' 반환(도착 전엔 안 참)
    team?: 0 | 1; // 재개를 차는 팀 — 준비 중 상대가 공에서 물러나도록(스페이싱)
    wall?: { team: 0 | 1; goalSide: Side }; // 수비벽 — 위험한 프리킥서 수비팀이 공·골 사이에 줄선다
    snap?: boolean; // 즉시 배치(킥오프) — 천천히 걷지 말고 첫 프레임에 합법 위치로 스냅
    kind?: RestartKind; // 재개 종류 — 종류별 상대 법정 거리(스로인 2m·골킥 박스밖·코너 9.15m 등)
  } | null>(null);
  const possTeam = useRef<0 | 1 | null>(null); // 통제 중인 팀(lastTouch 기반 스무딩) — 압박 방향 판단.
  const counterPress = useRef<{ team: 0 | 1; until: number } | null>(null); // 5초 카운터프레스 윈도우.
  const transition = useRef<{ team: 0 | 1; until: number } | null>(null); // 막 공 뺏은 팀의 역습 윈도우(약 3.5s).
  const keeperAggro = useRef<Record<Side, number>>({ left: 0.5, right: 0.5 }); // 스위퍼 성향 0..1.
  // GK 능력치(정보 카드용) — 반응/핸들링/킥/스위핑/침착. 매 경기 buildMatch서 새로.
  // GK는 손던지기 손(hand)·차기 발(foot)을 각각 가진다(왼/오 독립, -1=왼 +1=오). 박스 안에선 손/발
  // 둘 다, 박스 밖에선 발만(룰). 배급 시 그 손/발 방향으로 공이 감긴다(스핀).
  const keeperStats = useRef<
    Record<
      Side,
      { reflex: number; handling: number; kick: number; sweep: number; composure: number; hand: -1 | 1; foot: -1 | 1 }
    >
  >({
    left: { reflex: 0.7, handling: 0.7, kick: 0.6, sweep: 0.5, composure: 0.7, hand: 1, foot: 1 },
    right: { reflex: 0.7, handling: 0.7, kick: 0.6, sweep: 0.5, composure: 0.7, hand: 1, foot: 1 }
  });
  const keeperX = useRef<Record<Side, number>>({ left: 0, right: 0 }); // 라인에서 전진한 거리(px).
  // GK 손 — 잡으면(catch) 잠깐 보유 후 배급(스로/킥). 백패스는 발로(손 금지). 박스 안에서만 손.
  const keeperHold = useRef<{ side: Side | null; until: number }>({ side: null, until: 0 });
  const goalKickKeeper = useRef<Side | null>(null); // 골킥 중인 키퍼 — 박스 밖으로 공 가지러 나옴(하드 Y clamp 면제)

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

  // ── 진영(공격 방향) — 진영 교체(periodFlip) 단일 출처. 기본(flip=false): team0가 오른쪽 골 공격.
  //    매 피리어드 toggle되며 모든 방향 의존 로직이 이 헬퍼들만 통하게 해 사인 실수를 막는다.
  const atkDir = (team: 0 | 1) => ((team === 0) !== periodFlip.current ? 1 : -1); // +1 오른쪽 골 공격
  const enemyGoalOf = (team: 0 | 1): Side => (atkDir(team) > 0 ? "right" : "left"); // 공격(슛)하는 골
  const ownGoalOf = (team: 0 | 1): Side => (atkDir(team) > 0 ? "left" : "right"); // 지키는 골
  const teamDefending = (side: Side): 0 | 1 =>
    side === "left" ? (periodFlip.current ? 1 : 0) : periodFlip.current ? 0 : 1; // 그 골 지키는 팀
  const teamAttacking = (side: Side): 0 | 1 => (teamDefending(side) === 0 ? 1 : 0); // 그 골에 넣는 팀
  // 공 전진도(0=자기 골 .. 1=상대 골) — 진영 교체 반영.
  const advFrac = (team: 0 | 1, x: number) => {
    const fx = fieldX();
    const half = fx.max - fx.min || 1;
    return atkDir(team) > 0 ? (x - fx.min) / half : (fx.max - x) / half;
  };

  // px 화면 좌표 → 피치 미터 좌표(엔진/analytics 좌표계: 중앙원점, x[-52.5,52.5]·y[-34,34]).
  // 라이브 정책 결정(슛 xG 등)을 헤드리스 lib와 같은 출처로 쓰기 위한 변환.
  const pitchMeters = (px: number, py: number): Vec2 => {
    const { h } = bounds();
    const fx = fieldX();
    const top = h * MARGIN_Y_FRAC;
    const span = fx.max - fx.min || 1;
    const ySpan = h - 2 * top || 1;
    return {
      x: ((px - fx.min) / span - 0.5) * 105,
      y: ((py - top) / ySpan - 0.5) * 68
    };
  };

  const place = () => {
    const el = ballRef.current;
    if (!el) return;
    const z = ballZ.current;
    // 떠 있으면 위로 z만큼 올리고 살짝만 키운다(원근). 그림자·블러는 CSS .wc-ball-air가 입힌다.
    const scale = Math.min(1.3, 1 + z / 450);
    // 커브(스핀) 방향·세기에 따라 공이 실제로 돈다 — ballRoll(deg)을 회전으로 입힌다.
    el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y - z}px, 0) scale(${scale}) rotate(${ballRoll.current}deg)`;
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
    // 손 사용은 자기 박스 안에서만(Law 12). 박스 밖으로 나간 키퍼는 컵(손으로 감싸기) 포즈 금지 →
    // 발 처리로 보이게(시각적으로도 핸들링처럼 안 보이게). keeperX가 박스 깊이 넘으면 박스 밖.
    const handsLegal = keeperX.current[s] < bounds().w * 0.15;
    // 공이 키퍼에 닿는 순간(잡기·근접·막 쳐낸 직후)엔 '추적'을 멈추고 고정 컵 포즈로. 추적하면 공의
    // 미세 진동을 손이 따라가 부르르 떨리고 공과 비벼졌음. 추적은 공이 멀리서 다가올 때(아래)만.
    const nearBall = (catching || dist < kd * 1.7 || now < saveGrace.current) && handsLegal;
    if (nearBall) {
      // 승부차기는 막는 키퍼가 항상 오른쪽 골서 키커(−x)를 본다(s가 좌팀이어도). 정상경기는 자기 골 기준.
      const cdir = shootout.current.active ? Math.PI : s === "left" ? 0 : Math.PI;
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
    let dir = Math.atan2(bdy, bdx);
    if (shootout.current.active) {
      // 승부차기 — 막는 키퍼는 키커(필드, −x)를 본다. 세이브 후 공이 등 뒤(네트쪽, +x)로 빠져도
      // 공을 따라 뒤돌지 않게 전방(−x) 반구로 방향을 가둔다(장갑은 위/아래로만 따라가 막는다).
      const cl = clamp(Math.cos(dir), -1, -0.05);
      dir = Math.atan2(Math.sin(dir), cl);
    }
    const perp = dir + Math.PI / 2;
    const speed = Math.hypot(vel.current.x, vel.current.y);
    const defT: 0 | 1 = teamDefending(s);
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
      // 골키퍼도 진영 교체 반영 — 그 골을 '지키는 팀' 색을 입힌다. 키퍼는 골문에 고정(이동 불가)이라
      // 전·후반 진영이 바뀌면 같은 골문 키퍼의 색이 바뀐다 → 어느 팀 골문인지 한눈에, 스위치가 명확.
      const kdef = teamDefending(s);
      el.classList.toggle("wc-keeper-def-red", kdef === 0);
      el.classList.toggle("wc-keeper-def-blue", kdef === 1);
      // 하드 충돌(RL 핵심) — 키퍼가 '골 박스 안'에 있을 때만 상·하 포스트 안으로 강제(포스트 통과 금지).
      // 단 골킥 등으로 라인 앞(필드)으로 나올 땐 포스트가 없으니 Y 자유 — 안 그러면 골킥 키퍼가
      // 공의 Y로 못 가서 공에 못 다가가던 버그.
      {
        const g = goalRect(s);
        const cX = keeperCenterX(s);
        const line = s === "left" ? g.x + g.w : g.x; // 골라인(필드 쪽 면)
        // 박스는 라인 바깥쪽. 좌골 박스는 x<line, 우골 박스는 x>line. 키퍼 중심이 박스 안일 때만 Y clamp
        // (라인 앞 필드로 나오면 포스트 없으니 자유 — 골킥 키퍼가 공의 Y로 갈 수 있게).
        const inBox = s === "left" ? cX < line + kdDia() * 0.3 : cX > line - kdDia() * 0.3;
        // 골킥으로 공 가지러 나온 키퍼는 면제(안 그러면 마우스에 묶여 공의 Y로 못 감).
        if (inBox && goalKickKeeper.current !== s) {
          const m = kdDia() / 2 + 2.5;
          keeperY.current[s] = clamp(keeperY.current[s], g.y + m, g.y + g.h - m);
        }
      }
      const ox = s === "left" ? keeperX.current[s] : -keeperX.current[s];
      el.style.transform = `translate3d(${ox}px, ${keeperY.current[s] - kdDia() / 2}px, 0)`;
      // 스위핑으로 골 라인 앞(필드)이면 그물 앞(z7, 또렷), 골 안이면 그물 뒤(기본 z, 흐릿). 경계서
      // 깜빡이지 않게 히스테리시스(나올 땐 0.6kd, 들어갈 땐 0.3kd).
      const x = keeperX.current[s];
      const front = x > kdDia() * 0.6 ? true : x < kdDia() * 0.3 ? false : keeperFront.current[s];
      keeperFront.current[s] = front;
      // 잡는 중이면 키퍼를 공(z 0)보다 위(z 1)로 → 글러브가 공을 덮어 '잡은' 느낌(그물 z5보단 아래라
      // 여전히 골 안 흐릿). 평소 골 안=기본 z, 필드로 나오면 z7.
      const catching = keeperHold.current.side === s;
      el.style.zIndex = catching ? "1" : front ? "7" : "";
      el.classList.toggle("wc-keeper-ingoal", !front && !catching);
      placeGloves(s, keeperCenterX(s), keeperY.current[s], true, now, s); // 정상경기: 자기 골 박스로 clip
    });
  };
  const placePlayers = () => {
    const pr = rotated.current ? 6.5 : PLAYER_R; // 모바일은 선수 시각 더 작게(중심 맞춰 오프셋)
    // 풀타임 — 이긴 팀은 신나서(셀레브레이션), 진 팀은 침울하게(고개 숙임) 시각. 무승부는 둘 다 중립.
    const ended = clock.current.ended;
    const sc = scoreRef.current;
    const winner = !ended ? -2 : sc[0] === sc[1] ? -1 : sc[0] > sc[1] ? 0 : 1;
    const cel = celebrate.current;
    const celTeam = cel && performance.now() < cel.until ? cel.team : -2; // 골 세레모니 중 득점 팀
    players.current.forEach((p, i) => {
      const el = playerEls.current[i];
      if (!el) return;
      if (p.red) {
        el.style.display = "none"; // 퇴장 — 필드서 시각적으로도 제거
        return;
      }
      el.style.display = "";
      el.style.transform = `translate3d(${p.x - pr}px, ${p.y - pr}px, 0)`;
      // 부상 — 쓰러져 있으면(down) 또는 타박 큼 → 절뚝/다운 시각.
      el.classList.toggle("wc-player-down", performance.now() < p.downUntil);
      el.classList.toggle("wc-player-hurt", p.knock > 0.35 && performance.now() >= p.downUntil);
      el.classList.toggle("wc-player-carded", p.yellow > 0); // 옐로카드 머리 위 표시
      el.classList.toggle(
        "wc-player-celebrate",
        (winner >= 0 && p.team === winner) || p.team === celTeam
      );
      el.classList.toggle("wc-player-dejected", winner >= 0 && p.team !== winner);
    });
  };

  // 역할 home(필드 좌표) — 팀 전술(lineHeight·width) + 공/수 페이즈 push 반영.
  const roleHome = (p: Player, push: number) => {
    const { h } = bounds();
    const fx = fieldX();
    const t = teams.current ? teams.current[p.team] : null;
    const lh = t ? t.lineHeight : 0.1;
    const wd = t ? t.width : 1;
    // 전술 대비 강화 — 라인 높이/폭의 팀 간 차이를 과장해 전술이 한눈에 구분되게(하이라인은 더 높이,
    // 텐백은 더 깊이 / 넓은 팀은 더 넓게, 좁은 팀은 더 좁게). 중앙값(lh 0.1, wd 1)은 그대로.
    const lhAmp = (lh - 0.1) * 2.2 + 0.1;
    const wdAmp = 1 + (wd - 1) * 1.8;
    const bx = clamp(p.slot.bx + lhAmp + push, 0, 1);
    const span = fx.max - fx.min;
    const x = atkDir(p.team) > 0 ? fx.min + bx * span : fx.max - bx * span;
    const top = h * MARGIN_Y_FRAC;
    const by = clamp((p.slot.by - 0.5) * wdAmp + 0.5, 0, 1);
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
    (["left", "right"] as Side[]).forEach((s) => {
      keeperStats.current[s] = {
        reflex: rnd(0.55, 0.95),
        handling: rnd(0.5, 0.92),
        kick: rnd(0.4, 0.9),
        sweep: keeperAggro.current[s],
        composure: rnd(0.5, 0.9),
        hand: Math.random() < 0.5 ? -1 : 1, // 던지는 손(왼/오 독립)
        foot: Math.random() < 0.5 ? -1 : 1 // 차는 발(왼/오 독립)
      };
    });
    keeperX.current.left = 0;
    keeperX.current.right = 0;
    possTeam.current = null;
    counterPress.current = null;
    pendingRestart.current = null;
    keeperHold.current = { side: null, until: 0 };
    goalKickKeeper.current = null;
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
      num: (i % 10) + 2, // 2~11(1은 골키퍼 몫으로 비움)
      knock: 0,
      downUntil: 0,
      tackleAt: 0,
      vmag: 0,
      acute: 0
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
    clock.current = { t: 0, period: 1, added: 0, ended: false, addedAnnounced: false };
    periodFlip.current = false; // 새 경기는 기본 진영(team0 오른쪽 골)부터
    stats.current = { poss: [0, 0], shot: [0, 0], foul: [0, 0], yellow: [0, 0], red: [0, 0] };
    setStatText(null);
    setCardCounts({ yellow: [0, 0], red: [0, 0] });
    clockTick.current = 0;
    shootout.current = { ...shootout.current, active: false, phase: "", kicker: -1 };
    setPkText(null);
    breakUntil.current = 0;
    setMatchResult(null);
    setClockText("전반 00:00");
    // 경기 시작 매치업 — 화면 중앙 배너로(🔴 전술 vs 전술 🔵).
    showBanner(`🔴 ${ta.name}  vs  ${tb.name} 🔵`, 2600);
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
    carrySteer.current = null;
    ballSpin.current = 0;
    pos.current = { x: w * 0.5, y: h * 0.5 };
    vel.current = { x: 0, y: 0 };
    ballZ.current = 0;
    ballVZ.current = 0;
    place();
  };

  const setVelTo = (tx: number, ty: number, power: number) => {
    carrySteer.current = null; // 차는(패스/슛/클리어) 순간은 즉발 — 진행 중인 드리블 스무딩 무효화
    ballSpin.current = 0; // 기본 직선(커브는 kickCurved가 별도로 건다)
    const dx = tx - pos.current.x;
    const dy = ty - pos.current.y;
    const d = Math.hypot(dx, dy) || 1;
    vel.current.x = (dx / d) * power;
    vel.current.y = (dy / d) * power;
  };

  // 주 발 부호 — 오른발 +1(공이 진행방향 기준 왼쪽으로 인스윙), 왼발 -1(오른쪽), 양발 0(거의 직선).
  const footSign = (p: Player) =>
    p.preferredFoot === "right" ? 1 : p.preferredFoot === "left" ? -1 : 0;

  // 주 발 커브로 차기(패스·슛 공용) — 목표(tx,ty)로 power로 차되, 주 발에 따라 공을 휜다(바나나킥).
  // 핵심: 선수는 자기 주 발 회전을 '계산'해서 찬다 → 초기 조준각을 커브의 절반만큼 미리 반대로 틀어
  // (aim = 목표각 - θ/2), 휜 공의 현(chord)이 결국 목표를 향하게 한다. 그래서 공은 눈에 띄게 감기되
  // 원하는 곳(패스 받을 동료·골 구석)에 도달한다. 양발은 거의 직선.
  const CURVE_RATE = 0.95; // rad/s — 한 발잡이가 세게 감았을 때의 최대 회전(과회전은 θ 캡으로 제한)
  // 커브 차기 코어 — sign(부호=휘는 방향: +1/-1, 0=직선)과 weak(약발/서툰 정도 0..1)로 회전량 결정.
  // 선수 발(kickCurved)·골키퍼 손/발(키퍼 배급)이 공용으로 쓴다.
  const kickCurvedSign = (tx: number, ty: number, power: number, sign: number, weak: number) => {
    const dx = tx - pos.current.x;
    const dy = ty - pos.current.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (sign === 0) {
      setVelTo(tx, ty, power); // 직선(setVelTo가 spin 0으로)
      return;
    }
    const mag = (0.5 + (1 - weak) * 0.6) * (0.85 + Math.random() * 0.3); // 또렷할수록(weak↓) 더 감음
    const flight = clamp(dist / Math.max(120, power), 0.15, 1.2); // 대략 비행시간(s)
    let theta = CURVE_RATE * Math.sign(sign) * mag * flight; // 비행 동안 총 회전각
    theta = clamp(theta, -0.5, 0.5); // 과회전 방지(±~28°) — 조준 보정이 빗나가지 않게
    ballSpin.current = theta / flight; // 매 프레임 적용할 각속도(rad/s)
    carrySteer.current = null;
    const aim = Math.atan2(dy, dx) - theta / 2; // 휜 공의 현이 목표를 향하도록 초기각 보정
    vel.current.x = Math.cos(aim) * power;
    vel.current.y = Math.sin(aim) * power;
  };
  const kickCurved = (p: Player, tx: number, ty: number, power: number) =>
    kickCurvedSign(tx, ty, power, footSign(p), p.weakFoot);

  // 캐리(드리블 끌기) 터치 — setVelTo처럼 즉시 꺾지 않고 목표 속도를 carrySteer에 걸어둔다. step의
  // 적분 루프가 매 프레임 vel을 그 목표로 부드럽게 수렴시켜 공이 호를 그리며 돈다(이어지는 턴).
  const carryVelTo = (tx: number, ty: number, power: number) => {
    ballSpin.current = 0; // 드리블 끌기는 커브 없음
    const dx = tx - pos.current.x;
    const dy = ty - pos.current.y;
    const d = Math.hypot(dx, dy) || 1;
    // 목표 속도만 걸어둔다 — 적분 루프의 각(角) 스티어가 현재 진행방향에서 천천히 돌려 잇는다.
    // (예전엔 멈춘 공을 목표방향으로 즉시 vel=40 시드해서, 그게 곧 '방향 순간전환'의 원인이었음.)
    carrySteer.current = { vx: (dx / d) * power, vy: (dy / d) * power };
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
    walk?: () => boolean,
    team?: 0 | 1,
    wall?: { team: 0 | 1; goalSide: Side },
    snap?: boolean
  ) => {
    vel.current = { x: 0, y: 0 };
    carrySteer.current = null; // 세트피스로 멈춤 — 드리블 점유 락/회전 해제(잔류 방지)
    ballSpin.current = 0;
    pendingRestart.current = { at: performance.now() + delay, kick, walk, team, wall, snap };
    clock.current.added += 0.12; // 세트피스 지체 → 추가시간 누적(게임분)
    place();
  };

  // 가까운 동료(받을 사람)에게 공을 보낸다(킥오프/세트피스/키퍼 배급 공용). spinSign≠0이면 그 손/발
  // 방향으로 감아 던지거나 찬다(키퍼 손던지기 등). 기본 0=직선.
  const passToNearestTeammate = (
    team: 0 | 1,
    fromX: number,
    fromY: number,
    power: number,
    spinSign = 0
  ) => {
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
    if (ti >= 0) {
      const m = players.current[ti];
      if (spinSign !== 0) kickCurvedSign(m.x, m.y, power, spinSign, 0.45);
      else setVelTo(m.x, m.y, power);
    }
    lastTouch.current = team;
  };

  // 세트피스 키커 — 가장 가까운 같은 팀 선수를 공 바로 뒤까지 빠르게 데려온다(프리즈 중 매 프레임).
  // 반환: 키커가 공 바로 뒤에 '도착했는가'(true면 이제 차도 됨). 도착 전엔 공이 안 날아가게 한다.
  const walkTeammateToBall = (team: 0 | 1): boolean => {
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
    if (ti < 0) return true;
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
    return d <= stand + 6;
  };

  // 골킥 키커 — 해당 골 키퍼가 공(골 에어리어)까지 나온다. 킥 후엔 updateKeepers가 복귀시킨다.
  const walkKeeperToBall = (side: Side): boolean => {
    const g = goalRect(side);
    const lineX = side === "left" ? g.x + g.w : g.x;
    const distToBall = Math.abs(pos.current.x - lineX);
    const wantX = Math.max(0, distToBall - ballDia() / 2); // 키퍼 앞면이 공 바로 뒤에 닿게
    const sp = KEEPER_SPEED / 60; // 골킥 걸어나옴 — 몸은 보통 속도(빠르지 않게)
    keeperX.current[side] += clamp(wantX - keeperX.current[side], -sp, sp);
    keeperY.current[side] += clamp(pos.current.y - keeperY.current[side], -sp, sp);
    return (
      Math.abs(keeperX.current[side] - wantX) < kdDia() * 0.45 &&
      Math.abs(keeperY.current[side] - pos.current.y) < kdDia() * 0.6
    );
  };

  const flashPiece = (label: string) => {
    setSetPiece(label);
    window.setTimeout(() => setSetPiece((s) => (s === label ? null : s)), 850);
  };

  const kickoff = (concede: 0 | 1) => {
    centerBall();
    // 키퍼 골라인 복귀 — 직전 피리어드에 스위핑으로 나가 있던 위치가 남아 킥오프 때 키퍼가 미드필드에
    // 떠 있던 버그 방지(연장 시작 등). 골킥용 keeperX 전진도 0으로.
    const { h } = bounds();
    keeperX.current.left = 0;
    keeperX.current.right = 0;
    keeperY.current.left = h * 0.5;
    keeperY.current.right = h * 0.5;
    lastTouch.current = null;
    lastActiveAt.current = performance.now();
    flashPiece("킥오프");
    showCue({ kind: "setpiece", x: pos.current.x, y: pos.current.y, label: "킥오프" });
    logEvent("kickoff", concede);
    scheduleRestart(
      700,
      () => passToNearestTeammate(concede, pos.current.x, pos.current.y, 200),
      () => walkTeammateToBall(concede),
      concede,
      undefined,
      true // 킥오프 — 선수들을 즉시 포메이션 자리로 스냅(센터서클 밖). 몰렸다 빠지는 것 방지.
    );
    if (pendingRestart.current) pendingRestart.current.kind = "kickoff";
  };

  const throwIn = (where: "top" | "bottom") => {
    const { h } = bounds();
    const fx = fieldX();
    const team: 0 | 1 =
      lastTouch.current === 0 ? 1 : lastTouch.current === 1 ? 0 : Math.random() < 0.5 ? 0 : 1;
    pos.current.x = clamp(pos.current.x, fx.min, fx.max);
    pos.current.y = where === "top" ? insetY() : h - insetY(); // 터치라인 위
    flashPiece("스로인");
    showCue({ kind: "setpiece", x: pos.current.x, y: pos.current.y, label: "스로인" });
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
    if (pendingRestart.current) pendingRestart.current.kind = "throwIn";
    lastActiveAt.current = performance.now();
  };

  // 골라인 아웃(좌/우 사이드, 골문 밖) → 마지막 터치가 공격수면 골킥, 수비수면 코너킥.
  const goalLineOut = (side: Side) => {
    const { w, h } = bounds();
    const g = goalRect(side);
    const defend: 0 | 1 = teamDefending(side); // 그 골을 지키는 팀(진영 교체 반영)
    const attack: 0 | 1 = defend === 0 ? 1 : 0;
    const byAttacker = lastTouch.current === attack;
    if (!byAttacker) {
      // 코너킥 — 공격팀이 코너(골라인×터치라인 교차)에서 박스로. 키커가 자리잡는 약 1.1초 뒤 올린다.
      const topCorner = pos.current.y < h * 0.5;
      pos.current.x = side === "left" ? insetX() : w - insetX();
      pos.current.y = topCorner ? insetY() : h - insetY();
      lastTouch.current = attack;
      flashPiece("코너킥");
      showCue({ kind: "setpiece", x: pos.current.x, y: pos.current.y, label: "코너킥" });
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
      if (pendingRestart.current) pendingRestart.current.kind = "cornerKick";
    } else {
      // 골킥 — 키퍼가 골 에어리어로 나와 길게 찬다(약 1.1초 뒤). 킥 후 키퍼는 골문으로 복귀.
      pos.current.x = side === "left" ? g.x + g.w + 24 : g.x - 24;
      pos.current.y = clamp(pos.current.y, h * 0.3, h * 0.7);
      lastTouch.current = defend;
      flashPiece("골킥");
      showCue({ kind: "setpiece", x: pos.current.x, y: pos.current.y, label: "골킥" });
      logEvent("goalKick", defend, pos.current.x, pos.current.y);
      const upfield = side === "left" ? bounds().w * 0.6 : bounds().w * 0.4;
      const ty = h * 0.5 + rnd(-h * 0.2, h * 0.2);
      goalKickKeeper.current = side; // 키퍼가 박스 밖으로 공 가지러 나오는 동안 하드 Y clamp 면제
      // 골킥은 길게 띄운다(롱볼).
      scheduleRestart(
        850,
        () => {
          // 골킥은 키퍼가 '발'로 찬다(박스 밖이라 손 금지) → 차는 발 방향으로 감긴다.
          kickCurvedSign(upfield, ty, 520, keeperStats.current[side].foot, 0.4);
          loftBall(Math.abs(upfield - pos.current.x), 520);
          // goalKickKeeper는 여기서 바로 비우지 않는다 — 비우면 placeKeepers 하드 Y clamp가 박스 밖
          // Y를 마우스로 순간이동시킴. updateKeepers가 부드럽게 골문 복귀시킨 뒤 거기서 해제한다.
        },
        () => walkKeeperToBall(side),
        defend
      );
      if (pendingRestart.current) pendingRestart.current.kind = "goalKick";
    }
    lastActiveAt.current = performance.now();
  };

  // 오프사이드 라인 — 상대 최후방 수비(키퍼는 골라인이라 사실상 2번째 최후방)의 x. 하프라인 이하 없음.
  const offsideLineFor = (team: 0 | 1) => {
    const { w } = bounds();
    let line = atkDir(team) > 0 ? -Infinity : Infinity;
    players.current.forEach((e) => {
      if (e.team === team || e.red) return; // 퇴장 선수는 필드 밖 — 라인 계산서 제외(유령 라인 방지)
      line = atkDir(team) > 0 ? Math.max(line, e.x) : Math.min(line, e.x);
    });
    if (!isFinite(line)) line = w * 0.5; // 상대 전원 퇴장 등 방어
    // 클램프(중앙선으로 강제 당김) 제거 — 진짜 2번째 최후방 수비수 위치를 그대로. 클램프가 있으면
    // 수비가 올라가 있을 때 라인이 중앙에 박혀 가짜 오프사이드 + 깃발/노란선 위치 어긋남이 났다.
    // '자기 진영선 면제'는 isOffside의 inOppHalf가 따로 처리하므로 클램프 불필요.
    return line;
  };

  // 필드 단서 띄우기 — 발생 위치에 라벨(+오프사이드 라인) 잠깐. 1.4초 뒤 자동 제거.
  const showCue = (cue: Omit<NonNullable<typeof fieldCue>, "id">) => {
    setFieldCue({ ...cue, id: performance.now() });
    if (cueTimer.current) window.clearTimeout(cueTimer.current);
    cueTimer.current = window.setTimeout(() => setFieldCue(null), 1400);
  };

  // 화면 중앙 배너 — 하프타임·연장 전/후반·추가시간 등 시간 이벤트. 기본 2.2초.
  const showBanner = (text: string, ms = 2200) => {
    setPhaseBanner(text);
    if (bannerTimer.current) window.clearTimeout(bannerTimer.current);
    bannerTimer.current = window.setTimeout(() => setPhaseBanner(null), ms);
  };

  const callOffside = (attacker: 0 | 1, x: number, y: number, lineX?: number) => {
    const { h } = bounds();
    const defend: 0 | 1 = attacker === 0 ? 1 : 0;
    const fx = fieldX();
    pos.current.x = clamp(x, fx.min, fx.max);
    pos.current.y = clamp(y, ballDia() / 2, h - ballDia() / 2);
    lastTouch.current = defend;
    flashPiece("오프사이드");
    // 깃발은 노란 오프사이드 라인 '위'에(같은 x), 높이는 반칙 선수 y → 깃발과 선이 어긋나지 않게.
    showCue({ kind: "offside", x: lineX ?? x, y, lineX, label: "🚩" });
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
    // 부상 — 반칙당한 선수(공 보유자/근접)가 타박. 카드성 거친 태클일수록 크게. 심하면 잠깐 쓰러진다.
    {
      let victim: Player | null =
        lastBallPlayer.current && lastBallPlayer.current.team === fouled && !lastBallPlayer.current.red
          ? lastBallPlayer.current
          : null;
      if (!victim) {
        let vd = Infinity;
        players.current.forEach((q) => {
          if (q.team !== fouled || q.red) return;
          const d = Math.hypot(q.x - spotX, q.y - spotY);
          if (d < vd) {
            vd = d;
            victim = q;
          }
        });
      }
      if (victim) {
        const sev = card.includes("🟥") ? 0.5 : card.includes("🟨") ? 0.34 : 0.16;
        victim.knock = clamp(victim.knock + sev + rnd(0, 0.15), 0, 1);
        if (victim.knock > 0.55) victim.downUntil = performance.now() + rnd(500, 1100);
      }
    }
    lastTouch.current = fouled;
    flashPiece(`파울${card}`);
    logEvent("foul", fouler.team, spotX, spotY, card.trim());
    const enemy: Side = enemyGoalOf(fouled); // 반칙당한 팀이 공격하는 골(=반칙한 팀의 박스, 진영 교체 반영)
    const g = goalRect(enemy);
    const goalLine = enemy === "left" ? insetX() : w - insetX();

    // 박스 안 수비 반칙 = 페널티킥(프리킥 아님). 스폿에 놓고 키커가 강하게 한 방, 키퍼 1대1.
    const inBox = Math.abs(spotX - goalLine) < w * 0.16 && Math.abs(spotY - h * 0.5) < h * 0.3;
    if (inBox) {
      const penX = enemy === "left" ? insetX() + w * 0.105 : w - insetX() - w * 0.105;
      pos.current.x = penX;
      pos.current.y = h * 0.5;
      showCue({ kind: "foul", x: penX, y: h * 0.5, label: `${card.trim()} 페널티킥`.trim() });
      showBanner("페널티킥", 1600);
      scheduleRestart(
        950,
        () => {
          const tx = enemy === "left" ? g.x + g.w : g.x; // 골 입구
          const ty = g.y + g.h * (Math.random() < 0.5 ? 0.22 : 0.78); // 좌우 구석
          setVelTo(tx, ty, 720);
          stats.current.shot[fouled] += 1;
          lastTouch.current = fouled;
        },
        () => walkTeammateToBall(fouled),
        fouled
      );
      if (pendingRestart.current) pendingRestart.current.kind = "penaltyKick";
      lastActiveAt.current = performance.now();
      return;
    }

    // 프리킥 — 반칙당한 팀이 한 박자 뒤 찬다. 상대 골 가까우면 직접 슛, 아니면 전진 패스.
    // 파울 = 상대 프리킥. 카드 받았으면 카드 + 프리킥 같이 표기(예: "🟨 프리킥").
    showCue({ kind: "foul", x: spotX, y: spotY, label: `${card.trim()} 프리킥`.trim() });
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
      fouled,
      // 슈팅 사정권(상대 골 가까운) 프리킥이면 수비팀이 벽을 세운다.
      distGoal < w * 0.45 ? { team: fouler.team, goalSide: enemy } : undefined
    );
    if (pendingRestart.current) pendingRestart.current.kind = "directFreeKick";
    lastActiveAt.current = performance.now();
  };

  const scoreGoal = (side: Side) => {
    const now = performance.now();
    if (now - goalAt.current < GOAL_COOLDOWN_MS) return;
    goalAt.current = now;
    const scorer: 0 | 1 = teamAttacking(side); // 그 골에 넣은 = 그 골을 공격하는 팀(진영 교체 반영)
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
    // 골 세레모니 — 득점 팀이 잠깐 신나게(랜덤 kind). 코너로 우르르 / 득점지점 모여 안기 / 무작위 질주.
    const { w, h } = bounds();
    const kind = Math.floor(Math.random() * 4); // 0,3=질주 1=코너 2=모여안기
    let cx = g.x + g.w * 0.5;
    let cy = h * 0.5;
    if (kind === 1) {
      cx = side === "left" ? insetX() : w - insetX();
      cy = Math.random() < 0.5 ? insetY() : h - insetY();
    } else if (kind === 2) {
      cx = side === "left" ? g.x + g.w + w * 0.06 : g.x - w * 0.06;
      cy = h * 0.5;
    }
    celebrate.current = { team: scorer, until: now + 2400, kind, x: cx, y: cy };
    const concede: 0 | 1 = teamDefending(side);
    window.setTimeout(() => {
      celebrate.current = null;
      kickoff(concede);
    }, 2500);
  };

  // 골키퍼가 공에 닿음 — GK 손 액션. 백패스(아군이 발로 준 공)·박스 밖이면 손 못 쓰고 '발'로 처리.
  // 그 외(상대 슛)는 속도에 따라 catch(잡고 보유→배급) / parry(쳐냄) / punch(강하게 멀리).
  const doSave = (side: Side) => {
    const { w } = bounds();
    const defT: 0 | 1 = teamDefending(side);
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

      // 골킥으로 박스 밖에 나갔던 키퍼 — 라인+마우스로 충분히 복귀했으면 하드 Y clamp 다시 켠다(해제).
      if (goalKickKeeper.current === side) {
        const inMouthY =
          keeperY.current[side] > g.y + kdDia() / 2 && keeperY.current[side] < g.y + g.h - kdDia() / 2;
        if (keeperX.current[side] < kdDia() * 0.5 && inMouthY) goalKickKeeper.current = null;
      }
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

    // 마킹 배정 — 수비(비점유)팀의 '비압박' 선수가 상대를 1:1로 맡아 패스길을 끊는다. 핵심: '현재 위치'가
    // 아니라 '자기 포지션(존)' 기준으로 가까운 상대를 맡는다 → 구역 안에 들어온 상대만 잡고, 멀면 안 쫓아
    // (포지션 유지). 공만 우르르 몰리지 않고 축구 기본 수비 형태(존/맨 혼합)가 나온다.
    const markOf = new Array<number>(players.current.length).fill(-1);
    {
      const defTeam: 0 | 1 = poss === 0 ? 1 : 0;
      const nP = pressersOf(defTeam);
      const opps: number[] = [];
      players.current.forEach((q, j) => {
        if (q.team === defTeam || q.red) return; // 공격팀(=맡을 상대)만
        if (j === near.overall) return; // 볼 캐리어는 press 인원이 맡음
        opps.push(j);
      });
      const markers: number[] = [];
      const homeOf = new Map<number, { x: number; y: number }>();
      players.current.forEach((p, i) => {
        if (p.team !== defTeam || p.red) return;
        if (rank[i] < nP) return; // 압박 인원(공으로 가는 nP명) 제외
        markers.push(i);
        homeOf.set(i, roleHome(p, -0.06)); // 수비 시 자기 포지션(존 중심)
      });
      const taken = new Set<number>();
      markers.forEach((mi) => {
        const hm = homeOf.get(mi)!;
        // 마킹 존 반경 — 역할별. 수비수(DF/DM)는 넓은 존을 책임지고 적극적으로 상대를 픽업(마크),
        // 미드는 보통, 공격수(FW/WG)는 거의 안 내려와 좁게(존 밖 상대는 안 쫓아 포지션 유지).
        const mr = players.current[mi].slot.role;
        const reach = mr === "DF" || mr === "DM" ? w * 0.34 : mr === "MF" ? w * 0.25 : w * 0.16;
        let bo = -1;
        let bd = reach; // 존 반경 안의 상대만
        opps.forEach((oj) => {
          if (taken.has(oj)) return;
          // 자기 포지션(존)에서 가까운 상대 — 현재 위치가 아니라 home 기준이라 구역을 안 벗어난다.
          const d = Math.hypot(hm.x - players.current[oj].x, hm.y - players.current[oj].y);
          if (d < bd) {
            bd = d;
            bo = oj;
          }
        });
        if (bo >= 0) {
          markOf[mi] = bo;
          taken.add(bo);
        }
      });
    }

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
    // 수비벽 — 위험한 프리킥서 수비팀의 공 근접 2~3명이 공·골 사이에 줄선다.
    const wallIds: number[] = [];
    if (pr && pr.wall) {
      const wt = pr.wall.team;
      players.current
        .map((q, j) => ({ q, j }))
        .filter((x) => x.q.team === wt && !x.q.red)
        .sort(
          (a, b) =>
            Math.hypot(a.q.x - bx, a.q.y - by) - Math.hypot(b.q.x - bx, b.q.y - by)
        )
        .slice(0, 3)
        .forEach((x) => wallIds.push(x.j));
    }

    players.current.forEach((p, i) => {
      if (p.red) return; // 퇴장 — 더는 움직이지 않는다(필드서 빠짐, placePlayers가 시각도 숨김)
      // 세트피스 준비 — 키커는 walk()가 처리(스킵). 나머지는 자리 잡고, 상대는 공에서 물러난다.
      if (pr && pr.team != null) {
        if (i === restartTaker) return;
        const distBall = Math.hypot(p.x - bx, p.y - by);
        const legalR = w * 0.087; // ≈9.15m = 그려진 센터서클 반지름(width 17.4%)과 일치
        // 킥오프 — 천천히 걷지 말고 포메이션 자리로 '즉시 스냅'(센터서클 밖 보장). 양 팀 모두(차는 팀
        // 비키커 포함) 원 밖. 예전엔 공으로 몰렸다가 ~1초 뒤 원 밖으로 빠져 어수선했음.
        if (pr.snap) {
          const home = roleHome(p, p.team === pr.team ? 0.04 : -0.04);
          let hx = home.x;
          let hy = home.y;
          const dc = Math.hypot(hx - bx, hy - by);
          const out = legalR + PLAYER_R;
          if (dc < out) {
            const aa = dc > 0.1 ? Math.atan2(hy - by, hx - bx) : p.team === pr.team ? Math.PI : 0;
            hx = bx + Math.cos(aa) * out;
            hy = by + Math.sin(aa) * out;
          }
          p.x = clamp(hx, fx.min, fx.max);
          p.y = clamp(hy, PLAYER_R, h - PLAYER_R);
          p.tx = p.x;
          p.ty = p.y;
          return;
        }
        let stx = p.x;
        let sty = p.y;
        let sspd = PLAYER_SPEED * 0.5;
        const wallPos = wallIds.indexOf(i);
        if (pr.wall && wallPos >= 0) {
          // 공→골 선상 법정거리(9.15m≈8.5%)에 서고, 인원수만큼 좌우로 벌려 벽을 만든다.
          const gc = goalRect(pr.wall.goalSide);
          const ang = Math.atan2(gc.y + gc.h / 2 - by, gc.x + gc.w / 2 - bx);
          const perp = ang + Math.PI / 2;
          const off = (wallPos - (wallIds.length - 1) / 2) * (PLAYER_R * 2 + 2);
          stx = bx + Math.cos(ang) * legalR + Math.cos(perp) * off;
          sty = by + Math.sin(ang) * legalR + Math.sin(perp) * off;
          sspd = PLAYER_SPEED * 0.9;
        } else if (p.team !== pr.team) {
          // 상대 법정 위치 — 재개 종류별(Law 13/15/16/17). 스로인=2m, 골킥=페널티박스 밖,
          // 그 외(코너/프리킥/페널티/드롭볼)=9.15m. 몸(반경)까지 선 밖이게 +PLAYER_R.
          const home = roleHome(p, -0.04);
          let pushed = false;
          if (pr.kind === "throwIn") {
            const keep = w * 0.02 + PLAYER_R; // 2m
            if (distBall < keep) {
              const aw = distBall > 0.1 ? Math.atan2(p.y - by, p.x - bx) : rnd(0, Math.PI * 2);
              stx = bx + Math.cos(aw) * keep;
              sty = by + Math.sin(aw) * keep;
              sspd = PLAYER_SPEED * 0.95;
              pushed = true;
            }
          } else if (pr.kind === "goalKick") {
            // 상대는 페널티 박스 밖에서 대기(공이 인플레이될 때까지). 박스 안이면 라인 밖으로.
            const boxDepth = (fx.max - fx.min) * 0.157; // 16.5m
            const boxHalfH = h * 0.3;
            const leftBox = pr.team === 0; // 차는 팀의 자기 골 = 박스 위치
            const inX = leftBox ? p.x < fx.min + boxDepth : p.x > fx.max - boxDepth;
            const inY = Math.abs(p.y - h * 0.5) < boxHalfH;
            if (inX && inY) {
              stx = leftBox ? fx.min + boxDepth + PLAYER_R : fx.max - boxDepth - PLAYER_R;
              sty = p.y;
              sspd = PLAYER_SPEED * 0.9;
              pushed = true;
            }
          } else if (distBall < legalR + PLAYER_R) {
            const aw = distBall > 0.1 ? Math.atan2(p.y - by, p.x - bx) : rnd(0, Math.PI * 2);
            const out = legalR + PLAYER_R;
            stx = bx + Math.cos(aw) * out;
            sty = by + Math.sin(aw) * out;
            sspd = PLAYER_SPEED * 0.95;
            pushed = true;
          }
          if (!pushed) {
            stx = home.x;
            sty = home.y;
            sspd = PLAYER_SPEED * 0.5;
          }
        } else if (pr.kind === "cornerKick") {
          // 코너 공격팀 — 키커 외 전원 박스로 쇄도(니어/중앙/파포 분산), 수비형(DF 일부)은 에지/뒤.
          const span = fx.max - fx.min;
          const gside: Side = enemyGoalOf(pr.team ?? 0); // 공격하는 골(진영 교체 반영)
          const g = goalRect(gside);
          if (p.slot.role === "DF") {
            const home = roleHome(p, 0.12); // 박스 에지 부근 전진(세컨드볼/레스트)
            stx = home.x;
            sty = home.y;
          } else {
            const boxX = gside === "left" ? g.x + g.w + span * 0.06 : g.x - span * 0.06;
            stx = boxX + rnd(-span * 0.05, span * 0.04);
            sty = clamp(h * 0.5 + (p.slot.by - 0.5) * g.h * 1.4, g.y - 24, g.y + g.h + 24) + rnd(-14, 14);
          }
          sspd = PLAYER_SPEED * 0.7;
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
      // 풀타임 — 공 쫓기 끝. 이긴 팀은 신나서 필드를 무작위로 활발히 뛰어다니고(셀레브레이션), 진/무
      // 팀은 그 자리에 침울하게 멈춰 선다(고개 숙임은 CSS). 경기 끝났는데 공 따라다니던 것 교체.
      if (clock.current.ended) {
        const sc = scoreRef.current;
        const winner = sc[0] === sc[1] ? -1 : sc[0] > sc[1] ? 0 : 1;
        if (winner >= 0 && p.team === winner) {
          if (now >= p.thinkAt) {
            p.tx = rnd(fx.min, fx.max);
            p.ty = rnd(PLAYER_R, h - PLAYER_R);
            p.thinkAt = now + rnd(500, 1300);
          }
          const dx = p.tx - p.x;
          const dy = p.ty - p.y;
          const d = Math.hypot(dx, dy) || 1;
          const spd = PLAYER_SPEED * (0.7 + p.pace * 0.45); // 신나서 빠르게 뛰논다
          const mv = Math.min(spd, d * 4) * dt;
          p.x = clamp(p.x + (dx / d) * mv, fx.min, fx.max);
          p.y = clamp(p.y + (dy / d) * mv, PLAYER_R, h - PLAYER_R);
        } else {
          // 진/무 팀 — 완전 정지 X. 활발하진 않게 느릿느릿 돌아다닌다(드물게 새 목표 + 느린 속도).
          if (now >= p.thinkAt) {
            p.tx = rnd(fx.min, fx.max);
            p.ty = rnd(PLAYER_R, h - PLAYER_R);
            p.thinkAt = now + rnd(1400, 2900);
          }
          const dx = p.tx - p.x;
          const dy = p.ty - p.y;
          const d = Math.hypot(dx, dy) || 1;
          const mv = Math.min(PLAYER_SPEED * 0.3, d * 4) * dt;
          p.x = clamp(p.x + (dx / d) * mv, fx.min, fx.max);
          p.y = clamp(p.y + (dy / d) * mv, PLAYER_R, h - PLAYER_R);
        }
        return;
      }
      // 골 세레모니 — 득점 직후 잠깐. 득점 팀은 kind별로 신나게 뛰고(코너로/모여안기/무작위 질주),
      // 실점 팀은 천천히 자기 진영으로(허탈하게 복귀). 킥오프(2.5s 뒤)까지.
      const cel = celebrate.current;
      if (cel && now < cel.until) {
        if (p.team === cel.team) {
          // 인간적인 무질서 — 정해진 기하학 슬롯(cos(i*..))에 줄세우지 않는다. 각자 '다른 타이밍'에
          // (스태거) 초점 주변으로 대충 모이되 큰 랜덤 오프셋을 두고, 제각각 속도 + 흔들림으로
          // 어수선하게 뛰논다. kind는 '모이는 정도'만 다르게 — 2=촘촘 안기, 1=코너로 느슨히, 그 외=넓게
          // 흩어져 질주. 같은 i라도 매번 위치가 달라 줄선 듯한 기계적 느낌이 사라진다.
          if (now >= p.thinkAt) {
            const spread =
              cel.kind === 2 ? PLAYER_R * 3.5 : cel.kind === 1 ? PLAYER_R * 7 : PLAYER_R * 13;
            const pull = cel.kind === 2 ? 0.85 : cel.kind === 1 ? 0.6 : 0.28; // 초점으로 당기는 정도
            const fxT = cel.x + rnd(-spread, spread);
            const fyT = cel.y + rnd(-spread, spread);
            p.tx = clamp(p.x + (fxT - p.x) * pull + rnd(-PLAYER_R * 5, PLAYER_R * 5), fx.min, fx.max);
            p.ty = clamp(
              p.y + (fyT - p.y) * pull + rnd(-PLAYER_R * 5, PLAYER_R * 5),
              PLAYER_R,
              h - PLAYER_R
            );
            p.thinkAt = now + rnd(180, 820); // 제각각 타이밍 — 동시에 안 움직인다
          }
          const dx = p.tx - p.x;
          const dy = p.ty - p.y;
          const d = Math.hypot(dx, dy) || 1;
          // 속도 제각각 + 가끔 폭발적(버스트, 선수별 위상 p.wob). 직선 이동을 흔들림으로 깨 사람처럼 들썩.
          const burst = 0.8 + p.pace * 0.55 + Math.sin(now / 95 + p.wob * 2) * 0.3;
          const mv = Math.min(PLAYER_SPEED * Math.max(0.5, burst), d * 4) * dt;
          const wob = PLAYER_R * 1.4 * dt;
          p.x = clamp(p.x + (dx / d) * mv + Math.cos(now / 80 + p.wob * 3) * wob, fx.min, fx.max);
          p.y = clamp(p.y + (dy / d) * mv + Math.sin(now / 65 + p.wob * 4) * wob, PLAYER_R, h - PLAYER_R);
        } else {
          // 실점 팀 — 자기 진영 포메이션 자리로 천천히(허탈).
          const home = roleHome(p, -0.04);
          const dx = home.x - p.x;
          const dy = home.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          const mv = Math.min(PLAYER_SPEED * 0.35, d * 4) * dt;
          p.x = clamp(p.x + (dx / d) * mv, fx.min, fx.max);
          p.y = clamp(p.y + (dy / d) * mv, PLAYER_R, h - PLAYER_R);
        }
        return;
      }
      // 하프타임/피리어드 휴식 — 공(중앙) 쫓지 말고 자기 진영 포메이션 자리로 흩어져 선다. 안 그러면
      // 전원이 센터(공)로 수렴해 센터서클에 한 덩어리로 몰려 있었음(휴식인데 경합하듯).
      if (now < breakUntil.current && !clock.current.ended) {
        const home = roleHome(p, -0.02);
        const sdx = home.x - p.x;
        const sdy = home.y - p.y;
        const sd = Math.hypot(sdx, sdy) || 1;
        const smove = Math.min(PLAYER_SPEED * 0.4, sd * 4) * dt;
        p.x = clamp(p.x + (sdx / sd) * smove, fx.min, fx.max);
        p.y = clamp(p.y + (sdy / sd) * smove, PLAYER_R, h - PLAYER_R);
        p.tx = p.x;
        p.ty = p.y;
        return;
      }
      // 부상 — knock은 천천히 회복. 심한 직후엔 잠깐 쓰러져 정지(치료 대기).
      p.knock = Math.max(0, p.knock - 0.02 * dt);
      if (now < p.downUntil) return;
      const t = teams.current ? teams.current[p.team] : null;
      const tempo = t ? t.tempo : 1;
      const attacking = p.team === poss;
      const r = rank[i];
      const dBall = Math.hypot(p.x - bx, p.y - by);
      const loose = dBall < w * 0.045; // 발밑 루즈볼 — 누구나 툭

      // 역할: 공격=볼캐리어 1명 + 나머지 지원(벌려서 패스길). 수비=press/cover/balance.
      // 압박 인원은 PPDA로, 단 체력<0.22면 못 눌러 빠진다 → 지친 팀은 압박 헐거워져 공간 열림(현실).
      let mode: "carry" | "press" | "cover" | "support" | "shape" | "mark";
      if (attacking) {
        mode = r === 0 ? "carry" : "support";
      } else {
        const nP = pressersOf(p.team);
        // 압박 '높이' — 전술 press가 결정(전술색 핵심). 하이프레스/게겐은 상대 진영까지 공을 쫓고,
        // 로우블록/텐백은 공이 자기 블록에 들어올 때까지 안 쫓고 내려앉는다. 공이 허용선(pressReach)보다
        // 높으면 press 대신 마킹/블록 유지. 단 발밑 루즈볼(loose)은 전술 무관 가장 가까운 1명이 다툰다.
        const teamPress = t ? t.press : 0.6;
        const pressReach = 0.32 + teamPress * 0.62; // 자기 골 기준 허용 거리(0.32 로우블록 .. ~0.94 게겐)
        const ballAdv = advFrac(p.team, bx); // 0 자기골 .. 1 상대골(진영 교체 반영)
        const canEngage = ballAdv <= pressReach;
        // 압박은 '가장 가까운 nP명'만. 나머지는 마킹(자기 존 상대 패스길 차단)·커버·블록 유지 → 공으로
        // 우르르 몰리지 않고, 전술별로 압박 높이가 달라 한눈에 구분된다.
        if ((loose && r === 0) || (r < nP && p.stamina > 0.22 && p.acute < 0.92 && canEngage))
          mode = "press";
        else if (markOf[i] >= 0) mode = "mark";
        else if (r <= nP + 1 && ballAdv <= pressReach + 0.15) mode = "cover";
        else mode = "shape";
      }
      // 역습 전환 — 막 뺏은 팀의 최전방(FW)만 잠깐 전진 런. (MF/WG까지 시키면 전원 스프린트로 개떼가
      // 됐어서 FW 1~2명으로 축소.)
      const counterRun =
        attacking &&
        transition.current != null &&
        transition.current.team === p.team &&
        now < transition.current.until &&
        p.slot.role === "FW";
      const sprint = mode === "press" || mode === "carry";

      // 스태거드 재결정 — 압박/캐리는 자주, 나머지는 드물게 + 개별 반응지연. 캐시 목표 유지로
      // 22명이 같은 프레임에 일제히 방향 트는 것 방지(규율 높을수록 반응 빠름).
      if (now >= p.thinkAt) {
        const lagBase = sprint ? rnd(70, 150) : rnd(190, 430);
        // 지치면 반응이 굼떠진다 — 급성 피로가 재결정 지연을 늘린다(현실의 피로 인지저하).
        p.thinkAt = now + lagBase * (1.25 - p.discipline * 0.55) * (1 + p.acute * 0.3);
        let tx: number;
        let ty: number;
        if (sprint) {
          // 압박은 공으로 직접 박지 않고 '견제 거리(standoff)'서 멈춰 길을 막는다 — 몸이 캐리어에
          // 파묻혀 공이 두 몸 사이에 끼던(wedge) 게 붙은-채-드리블/거짓 드롭볼의 원인이었음. 단,
          // 루즈볼(주인 없음/내 차례)은 standoff 없이 직접 달려가 줍는다.
          const ballOwned = lastTouch.current != null && lastTouch.current !== p.team;
          if (mode === "press" && ballOwned) {
            const aimX = bx + vel.current.x * 0.1;
            const aimY = by + vel.current.y * 0.1;
            const adx = aimX - p.x;
            const ady = aimY - p.y;
            const ad = Math.hypot(adx, ady) || 1;
            const stand = ballDia() / 2 + PLAYER_R * 1.35; // 발 닿을 듯 말 듯(태클 사거리 안)
            tx = aimX - (adx / ad) * stand;
            ty = aimY - (ady / ad) * stand;
          } else {
            const lead = mode === "press" ? 0.1 : 0.05;
            tx = bx + vel.current.x * lead;
            ty = by + vel.current.y * lead;
          }
        } else if (mode === "cover") {
          // 공과 자기 골 사이를 막는 커버 포인트(수비 2선).
          const og = goalRect(ownGoalOf(p.team));
          tx = bx + (og.x + og.w / 2 - bx) * 0.32;
          ty = by + (og.y + og.h / 2 - by) * 0.32;
        } else if (mode === "mark") {
          // 마킹 — 맡은 상대와 공 사이(상대 쪽에 가깝게)에 서서 패스 레인을 끊고, 골사이드로 살짝
          // 당겨 배후 침투를 막는다. 자기 상대를 따라가므로 선수들이 공으로 몰리지 않고 퍼진다.
          const o = players.current[markOf[i]];
          const lx = o.x + (bx - o.x) * 0.3;
          const ly = o.y + (by - o.y) * 0.3;
          const og = goalRect(ownGoalOf(p.team));
          tx = lx + (og.x + og.w / 2 - lx) * 0.12;
          ty = ly + (og.y + og.h / 2 - ly) * 0.12;
        } else {
          // shape/support — 역할 home(포메이션 슬롯) 우선, 공쪽으론 '살짝만' 시프트. 횡(y) 끌림을
          // 크게 주면 비수비수 전원이 공.y로 수렴해 졸졸 따라다녔음 → 폭(자기 자리)을 지키게 infY·maxY를
          // 낮춤. 깊이(x) 시프트는 팀 블록이 함께 오르내리는 것이라 유지. (DF는 아래 라인 로직이 덮음.)
          const fwd = p.slot.role === "FW" || p.slot.role === "WG";
          // 인포제션 페이즈(3.1) — 공 전진도(prog 0=자기 골 .. 1=상대 골)에 따라 공격팀이 단계적으로
          // 전진. 빌드업(prog<0.3)=낮고 넓게(추가 push 0), 전개=전진, 파이널서드(>0.62)=박스 점유.
          const prog = advFrac(p.team, bx);
          const phasePush = attacking ? clamp((prog - 0.3) * 0.5, 0, 0.22) : 0;
          const push = counterRun ? 0.26 : attacking ? (fwd ? 0.18 : 0.1) + phasePush : -0.06;
          const home = roleHome(p, push);
          const infX = attacking ? 0.1 : 0.12;
          const infY = attacking ? 0.12 : 0.16;
          const maxX = w * (attacking ? 0.12 : 0.14);
          const maxY = h * 0.13;
          tx = home.x + clamp((bx - home.x) * infX, -maxX, maxX);
          ty = home.y + clamp((by - home.y) * infY, -maxY, maxY);
          // 공격수는 형태 유지 중엔 오프사이드 라인 안쪽(온사이드)에 머문다 — 라인 너머 camp하면
          // 패서의 전방 옵션이 전부 오프사이드가 돼 깃발이 남발됐음. 침투(sprint/carry)는 자유.
          if (attacking && fwd) {
            const offL = offsideLineFor(p.team);
            tx = atkDir(p.team) > 0 ? Math.min(tx, offL - PLAYER_R) : Math.max(tx, offL + PLAYER_R);
          }
          // 수비 라인 — 수비 중 DF는 공통 라인 X로 정렬해 한 줄로 함께 오르내린다(컴팩트 블록).
          // 공이 자기 골에 가까우면 내려앉고, 멀거나 하이라인 전술이면 올라간다. ty(폭)는 각자 유지.
          if (!attacking && p.slot.role === "DF") {
            const half = fx.max - fx.min;
            const lh = t ? t.lineHeight : 0.1;
            const prog = advFrac(p.team, bx);
            const depth = clamp(prog * 0.42 + lh * 2.8, 0.1, 0.7);
            const lineX =
              atkDir(p.team) > 0 ? fx.min + depth * half * 0.5 : fx.max - depth * half * 0.5;
            tx = lineX + clamp((bx - lineX) * 0.04, -w * 0.03, w * 0.03);
            // 폭 유지가 핵심 — 공쪽으로 ty를 크게 당기면(infY 0.3) DF 전원이 공.y로 수렴해 한 점에
            // 쌓인다(골대 앞 파일). 라인은 자기 자리(home.y)를 지키며 공쪽으로 '살짝만' 시프트.
            ty = home.y + clamp((by - home.y) * 0.12, -h * 0.09, h * 0.09);
          }
          // 후방 빌드업 — 점유팀이 자기 진영 깊은 곳에서 공을 돌릴 땐 폭을 벌려 패스 레인을 연다(중앙
          // 밀집 완화 + 사이드 전개). 공격 지원 선수(DF 제외)에게만.
          if (attacking && p.slot.role !== "DF") {
            const third = (fx.max - fx.min) * 0.38;
            const inOwnThird = atkDir(p.team) > 0 ? bx < fx.min + third : bx > fx.max - third;
            if (inOwnThird) ty = clamp(h * 0.5 + (ty - h * 0.5) * 1.3, PLAYER_R, h - PLAYER_R);
          }
          // 파이널서드 박스 점유(4.3) — 공이 상대 깊숙이 가면 FW/WG는 박스 안 포스트로 침투(슬롯 위/아래
          // 로 니어·파포 분담). 오프사이드 라인 안에서. 크로스/컷백 받을 타깃을 박스에 채운다.
          if (attacking && fwd && prog > 0.62) {
            const span = fx.max - fx.min;
            const boxX = atkDir(p.team) > 0 ? fx.max - span * 0.1 : fx.min + span * 0.1;
            const g = goalRect(enemyGoalOf(p.team));
            const postY = p.slot.by < 0.5 ? g.y + g.h * 0.35 : g.y + g.h * 0.65;
            tx = tx * 0.4 + boxX * 0.6;
            ty = ty * 0.5 + postY * 0.5;
            const offL = offsideLineFor(p.team);
            tx = atkDir(p.team) > 0 ? Math.min(tx, offL - PLAYER_R) : Math.max(tx, offL + PLAYER_R);
          }
          // 레스트 디펜스(4.9) — 공격 중에도 DF는 후방 라인을 유지(전원 전진 방지). 항상 공보다 뒤
          // (margin)에 서서 역습 대비. 공 전진하면 같이 오르되 깊이 8~50%로 가둬 공을 앞질러 가지 않게.
          if (attacking && p.slot.role === "DF") {
            const half = fx.max - fx.min;
            const margin = w * 0.14;
            tx =
              atkDir(p.team) > 0
                ? clamp(bx - margin, fx.min + half * 0.08, fx.min + half * 0.5)
                : clamp(bx + margin, fx.max - half * 0.5, fx.max - half * 0.08);
            ty = home.y + clamp((by - home.y) * 0.1, -h * 0.08, h * 0.08);
          }
          // 수비 컴팩트(4.8) — 수비 블록이 세로로 늘어지지 않게. 미드/공격(비DF)은 DF 라인에서 최대
          // ~42%(반쪽 기준) 앞까지만 — 블록과 라인 사이 간격 유지(중앙 차단·전환 대비).
          if (!attacking && p.slot.role !== "DF") {
            const half = fx.max - fx.min;
            const lh = t ? t.lineHeight : 0.1;
            const prog = advFrac(p.team, bx);
            const depth = clamp(prog * 0.42 + lh * 2.8, 0.1, 0.7);
            const lineX =
              atkDir(p.team) > 0 ? fx.min + depth * half * 0.5 : fx.max - depth * half * 0.5;
            const band = half * 0.42;
            tx = atkDir(p.team) > 0 ? clamp(tx, lineX, lineX + band) : clamp(tx, lineX - band, lineX);
          }
        }
        const jit = mode === "shape" || mode === "support" ? 26 : 12;
        p.tx = tx + rnd(-jit, jit);
        p.ty = ty + rnd(-jit, jit);
      }

      // 이동 — 캐시 목표로. 속도는 모드·페이스·체력. 지치면 느려짐(0.6..1).
      let spd = PLAYER_SPEED * tempo * (sprint ? 0.72 + p.pace * 0.6 : 0.42 + p.pace * 0.4);
      spd *= 0.6 + 0.4 * p.stamina; // 만성 피로(stamina)
      spd *= 1 - p.acute * 0.18; // 급성 피로 — 최근 스프린트 누적이 순간 톱스피드 깎음
      spd *= 1 - p.knock * 0.45; // 타박 — 절뚝(속도 저하)
      if (mode === "cover") spd *= 1.1;
      const wob = sprint ? 0 : Math.sin(now / 700 + p.wob) * 1.4; // idle 미세 흔들림(통일감 깨기)
      const dx = p.tx - p.x;
      const dy = p.ty + wob - p.y;
      const d = Math.hypot(dx, dy) || 1;
      // 가속/감속 — 정지→전력, 전력→정지가 즉발이 아니라 램프(민첩 높을수록 빠른 변속). 방향은 즉시
      // 목표로(벡터 관성은 기차놀이·쏠림 유발해 회피), 속력 크기만 점진. 도착 가까우면 감속(d*4).
      const targetSpd = Math.min(spd, d * 4);
      const agile = 0.7 + p.agility * 0.6;
      const accRate = (sprint ? 520 : 420) * agile; // px/s^2
      const decRate = 900 * agile;
      const rate = targetSpd > p.vmag ? accRate : decRate;
      p.vmag = clamp(targetSpd, p.vmag - decRate * dt, p.vmag + rate * dt);
      const move = p.vmag * dt;
      const vx = (dx / d) * move;
      const vy = (dy / d) * move;
      p.x = clamp(p.x + vx, fx.min, fx.max);
      p.y = clamp(p.y + vy, PLAYER_R, h - PLAYER_R);

      // 체력 — 스프린트/압박은 소모, 걸으면 회복. 실제 이동량 비례(90분 내내 못 누름).
      const speedUsed = Math.hypot(vx, vy) / dt;
      const intensity = 0.5 + (speedUsed / PLAYER_SPEED) * 0.5;
      const drain = (sprint ? 0.05 : 0.012) * intensity;
      const recover = sprint ? 0 : 0.022;
      p.stamina = clamp(p.stamina - drain * dt + recover * dt, 0, 1);
      // 급성 피로 — 스프린트 중 빠르게 누적, 걸으면 빠르게 회복(최근 5~30초 부하 근사). 만성과 별개.
      const acuteGain = sprint ? 0.05 * intensity : 0;
      const acuteRec = sprint ? 0 : 0.09;
      p.acute = clamp(p.acute + acuteGain * dt - acuteRec * dt, 0, 1);
    });

    // 분리(separation) — 2단. (1) 물리 겹침(minSep=닿는 정도)은 항상 막는다(조랭이떡 방지).
    // (2) 개인 공간(psr, 더 넓게)은 '공에서 먼' 선수끼리만 부드럽게 벌린다 → 공과 무관한 곳에서 양 팀이
    // 한 덩어리로 뭉쳐 안 풀리던 잔여 스크럼을 흩는다. 단, 공 경합 중(공 근처)인 선수는 제외해 진짜
    // 듀얼·압박은 그대로 붙게 둔다. 모바일은 선수 시각크기(13) 기준. O(n²)=400, 60fps 무리 없음.
    const minSep = (rotated.current ? 13 : PLAYER_R * 2) + 1;
    const psr = minSep * 1.75; // 개인 공간 — 닿는 것보다 넓게(군집 풀기)
    const ballNear2 = (w * 0.06) * (w * 0.06); // 이 안이면 공 경합 → 안 벌림
    players.current.forEach((p, i) => {
      if (p.red) return;
      const pContest = (p.x - bx) * (p.x - bx) + (p.y - by) * (p.y - by) < ballNear2;
      let sx = 0;
      let sy = 0;
      players.current.forEach((q, j) => {
        if (i === j || q.red) return;
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= 0.01) return;
        if (d2 < minSep * minSep) {
          // 물리 겹침 — 항상 분리(닿되 안 겹치게).
          const d = Math.sqrt(d2);
          const f = (minSep - d) / minSep;
          sx += (dx / d) * f;
          sy += (dy / d) * f;
        } else if (!pContest && d2 < psr * psr) {
          // 개인 공간 — 공서 멀 때만, 부드럽게(0.5). 상대도 공 경합이면 안 민다(듀얼 보존).
          const qContest =
            (q.x - bx) * (q.x - bx) + (q.y - by) * (q.y - by) < ballNear2;
          if (qContest) return;
          const d = Math.sqrt(d2);
          const f = ((psr - d) / psr) * 0.5;
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
    headerCount.current = 0; // 지면 컨트롤·결정으로 내려오면 헤딩 연쇄 리셋
    const { w, h } = bounds();
    const t = teams.current ? teams.current[p.team] : null;
    const possession = t ? t.possession : 0.5;
    const enemy: Side = enemyGoalOf(p.team);
    const g = goalRect(enemy);
    const goalCx = g.x + g.w / 2;
    const goalCy = g.y + g.h / 2;
    // 약발 — 정확도 페널티(약발 낮을수록 패스/슛 오차↑). 개인성 발현. 피로(만성+급성)도 오차↑.
    const fatigue = (1 - p.stamina) * 0.5 + p.acute * 0.5;
    const err = (1 - p.pass) * 110 * (1.35 - p.weakFoot * 0.5) * (1 + fatigue * 0.45);
    // 슛 결정 — 헤드리스 lib와 같은 정책 출처: xgFromShot(거리+슈팅각 인지)로 슛 확률 산정.
    // 각도 좁은 측면 깊숙은 xG 낮아 덜 쏘고, 정면 가까이는 적극. 직접축구는 먼 거리도 가산.
    // 사람다운 변동은 random 유지(렌더러 연출).
    const xg = xgFromShot(pitchMeters(p.x, p.y), p.team);
    // 역할(포지션)별 성향 — FW/WG는 슛·공격 적극, MF/DM은 볼 배분(패스) 우선, DF는 오픈플레이 슛 자제.
    const role = p.slot.role;
    const isFwd = role === "FW" || role === "WG";
    const isMid = role === "MF" || role === "DM";
    const isDef = role === "DF";
    const dir = enemy === "left" ? -1 : 1; // 공격 방향(+x 오른쪽 골 / -x 왼쪽 골)
    // 슛 성향 — 슛 능력 + 포처(FW poaching)는 박스서 더 노리고, 이타적(altruism)이면 덜 쏘고 패스 선호.
    // 역할 가중: FW 적극(×1.35), MF 보통(×0.95), DF 자제(×0.55).
    const poach = isFwd ? p.poaching * 0.4 : 0;
    const roleShoot = isFwd ? 1.35 : isMid ? 0.95 : 0.55;
    const shootProb =
      (xg * (1.0 + p.shoot * 0.8) + (possession < 0.4 ? xg * 0.4 : 0)) *
      (1 + poach) *
      (1 - p.altruism * 0.3) *
      roleShoot;
    // 클리어찬스/1대1 — 나와 골 사이(슈팅 콘)에 막는 '필드' 수비가 없고 사정권이면 역할 불문 거의 무조건
    // 슛. 키퍼는 players에 없으므로 blockers==0 = 사실상 키퍼와 단독. (수비 다 제치고 1대1인데 백 롱패스
    // 띄워 풀백에 주는 끔찍한 장면 방지 — 찬스면 무조건 마무리.)
    const goalDist = Math.hypot(goalCx - p.x, goalCy - p.y);
    let blockers = 0;
    players.current.forEach((e) => {
      if (e.team === p.team || e.red) return;
      const ahead = (e.x - p.x) * dir > 0; // 나보다 골 쪽 앞
      const beforeGoal = (goalCx - e.x) * dir >= 0; // 골과 나 사이(슈팅 길을 막는 위치)
      if (ahead && beforeGoal && Math.abs(e.y - p.y) < h * 0.17) blockers += 1;
    });
    const clearChance = goalDist < w * 0.4 && blockers === 0;
    if (clearChance || (xg > 0.05 && Math.random() < shootProb)) {
      dribbleCount.current = 0;
      angleCarry.current = 0;
      stats.current.shot[p.team] += 1;
      logEvent("shot", p.team, p.x, p.y);
      const tx = enemy === "left" ? g.x + g.w : g.x;
      // 클리어찬스는 침착하게 구석(스프레드 작게), 그 외엔 슛 능력 따라 흩어진다.
      const spread = clearChance ? g.h * 0.3 : g.h * 0.5 * (1.2 - p.shoot);
      const ty = g.y + g.h / 2 + (Math.random() * 2 - 1) * spread;
      kickCurved(p, tx, ty, 480 + Math.random() * 150); // 주 발로 감아 차 구석 노림(커브슛)
      return;
    }

    // ── 온볼 지능: 무작정 패스 X. 안 눌리고 앞 공간 있으면 끌고 가며(드리블) 간 보고, 압박이면
    //    개인기로 제치거나 안전하게 패스. 점유 성향 높을수록 더 끌고 유지. 연속 드리블은 cap 제한.
    if (lastBallPlayer.current !== p) {
      dribbleCount.current = 0; // 다른 선수가 잡으면 리셋
      angleCarry.current = 0;
      lastBallPlayer.current = p;
    }
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
    const canDribble = dribbleCount.current < 3; // 연속 드리블 cap(7→3) — 끌기만 반복 방지
    // 끌기는 '앞 공간 + 개인 성향' 기준으로 가끔만. 점유 전술일수록 패스 선호(드리블↓ — 예전엔 거꾸로
    // 점유↑일수록 끌어서 모든 전술이 드리블 과다였음). 기본 확률도 낮춤(패스가 우선되게).
    // 드리블 — 앞 공간 + 개인기 성향 + 직접 전술일수록 더. (밀어서 끌던 아티팩트는 셸드로 해결됐으니
    // 이제 진짜 carry를 적정 빈도로.) 점유 전술은 패스 우선이라 덜 끔.
    // 역할 가중 — FW/WG는 더 끌고(돌파), DF는 거의 안 끌고 안전 패스(수비수가 무리한 드리블 X).
    const roleCarry = isFwd ? 1.3 : isDef ? 0.55 : 1;
    const carryProb = clamp(
      (0.14 + adventurous * 0.22 - (possession - 0.5) * 0.42) * roleCarry,
      0.04,
      0.5
    );
    const wantCarry = canDribble && !pressed && spaceAhead > w * 0.16 && Math.random() < carryProb;
    const wantBeatMan = canDribble && pressed && Math.random() < adventurous * 0.16;
    if (wantCarry || wantBeatMan) {
      dribbleCount.current += 1;
      let ang = Math.atan2(goalCy - p.y, goalCx - p.x); // 기본 골 방향
      // 윙어 개인성 — cutInside 낮으면 클래식 윙어(측면 바이라인으로 돌파→크로스), 높으면 인사이드
      // 포워드(중앙으로 접어 슛). 성향대로 드리블 방향이 갈린다.
      if (p.slot.role === "WG" && !wantBeatMan) {
        const flankY = p.y < h * 0.5 ? insetY() : h - insetY();
        const lineAng = Math.atan2(flankY - p.y, goalCx - p.x); // 측면 깊숙
        const inAng = Math.atan2(h * 0.5 - p.y, goalCx - p.x); // 중앙
        ang = lineAng * (1 - p.cutInside) + inAng * p.cutInside;
      }
      if (wantBeatMan && oppNear < Infinity) {
        const away = Math.atan2(p.y - nearEy, p.x - nearEx); // 수비 반대쪽으로 제침(페인트)
        ang = ang * 0.45 + away * 0.55 + rnd(-0.3, 0.3);
      } else if (Math.random() < 0.32) {
        ang += rnd(-0.8, 0.8); // 간보기 — 횡으로 살짝 틀어 속이기(360도 간 보는 느낌)
      }
      const push = pressed ? 230 : 150 + Math.min(spaceAhead, w * 0.2);
      carryVelTo(p.x + Math.cos(ang) * 60, p.y + Math.sin(ang) * 60, push);
      return;
    }
    dribbleCount.current = 0; // 패스/슛 결정하면 리셋

    // 분위기 전환(가끔) — 경기 안 풀릴 때 길게 질러 흐름을 바꾼다: 반대편 스위치(롱 다이애고널) 또는
    // 뻥(전방 공간으로 롱 클리어, 세컨드볼 노림). 패스길 못 찾아 끌기가 누적될수록·직접 전술일수록 자주,
    // 평소엔 드물게(흐름 환기용). 슛 사정권(전진 우선)에선 안 한다.
    const directBias = 1 - possession; // 0(점유) .. 1(직접)
    const stuck = angleCarry.current >= 2; // 패스길 못 찾아 이미 몇 번 끌었음
    const changeUpProb = (stuck ? 0.4 : 0.03) * (0.55 + directBias * 0.9);
    if (xg < 0.05 && Math.random() < changeUpProb) {
      // 반대편 스위치 — 현재 y 반대 절반의 '먼+열린' 동료로 띄운다(롱 다이애고널).
      let sw = -1;
      let swOpen = -Infinity;
      players.current.forEach((m, j) => {
        if (m.team !== p.team || m === p || m.red) return;
        if ((m.y - h * 0.5) * (p.y - h * 0.5) >= 0) return; // 반대 절반만
        const dpass = Math.hypot(m.x - p.x, m.y - p.y);
        if (dpass < w * 0.24 || dpass > w * 0.7) return; // 충분히 먼 스위치 거리
        let nd = Infinity;
        players.current.forEach((e) => {
          if (e.team === p.team || e.red) return;
          nd = Math.min(nd, Math.hypot(e.x - m.x, e.y - m.y));
        });
        if (nd > swOpen) {
          swOpen = nd;
          sw = j;
        }
      });
      angleCarry.current = 0;
      if (sw >= 0 && swOpen > w * 0.05) {
        const m = players.current[sw];
        const dpass = Math.hypot(m.x - p.x, m.y - p.y);
        const power = clamp(dpass * 3.2, 520, 820);
        setVelTo(m.x + rnd(-err, err), m.y + rnd(-err, err), power);
        loftBall(dpass, power); // 띄워서 수비 위로
        return;
      }
      // 스위치 옵션 없으면 뻥 — 전방 공간으로 길게 띄워 세컨드볼 경합을 노린다.
      const tx = atkDir(p.team) > 0 ? w * 0.82 : w * 0.18;
      const ty = clamp(p.y + rnd(-h * 0.22, h * 0.22), insetY(), h - insetY());
      const dlong = Math.hypot(tx - p.x, ty - p.y);
      setVelTo(tx + rnd(-err, err), ty, 640);
      loftBall(dlong, 640);
      return;
    }

    // 오프사이드 판정 — 받는 순간 받을 선수가 상대 최후방 라인(키퍼 제외 사실상 2번째 최후방)
    // 너머 + 상대 진영이면 오프사이드. 레벨(같은 선)은 온사이드라 PLAYER_R*2 여유를 둔다.
    const offLine = offsideLineFor(p.team);
    const isOffside = (m: Player) => {
      // 레벨(거의 같은 선)은 온사이드 — 관용폭을 넉넉히(PLAYER_R*3.5) 줘 아슬한 판정이 공격수에 유리.
      const tol = PLAYER_R * 3.5;
      const beyond = atkDir(p.team) > 0 ? m.x > offLine + tol : m.x < offLine - tol;
      const inOppHalf = atkDir(p.team) > 0 ? m.x > w * 0.5 : m.x < w * 0.5;
      return beyond && inOppHalf;
    };
    // 패스: 전진+열린 동료. 온사이드를 강하게 우선(오프사이드 후보엔 큰 페널티) → 실제 선수처럼
    // 보통은 온사이드로 연결하고, 전진 옵션이 전부 오프사이드일 때만 위험한 패스가 걸린다(드묾).
    // lib analytics(헤드리스 RL과 같은 출처)로 패스 후보 평가에 패스 성공률·전진위협을 섞는다.
    const fromM = pitchMeters(p.x, p.y);
    const oppM = players.current.filter((e) => e.team !== p.team && !e.red).map((e) => pitchMeters(e.x, e.y));
    let best = -1;
    let bestScore = -Infinity;
    let bestProb = 0; // 선택된 패스의 레인 개방도(0..1) — 낮으면 '길 안 열림'으로 보고 끌어서 각을 만든다
    players.current.forEach((m, j) => {
      if (m.team !== p.team || m === p) return;
      const adv = (m.x - p.x) * atkDir(p.team);
      // 횡/약간 뒤 패스도 후보에 포함(전진만 고집 X) → 거의 항상 패스 옵션이 있어 드리블 fallback을 안 탄다.
      // 점수에서 전진(adv)에 가중치를 주므로 좋은 전진 패스가 있으면 그쪽이 우선된다.
      if (adv < -w * 0.22) return;
      const dpass = Math.hypot(m.x - p.x, m.y - p.y);
      if (dpass > w * 0.55) return;
      let nd = Infinity;
      players.current.forEach((e) => {
        if (e.team === p.team) return;
        nd = Math.min(nd, Math.hypot(e.x - m.x, e.y - m.y));
      });
      const toM = pitchMeters(m.x, m.y);
      const prob = passProbability(fromM, toM, oppM); // 0..1 패스길 안 막힘
      const threat = xtValue(toM, p.team); // 0..1 받는 위치 위협
      let score =
        adv * (0.4 + (1 - possession) * 0.8) +
        nd * (0.3 + possession * 0.7) -
        dpass * (possession * 0.4 + 0.05) +
        prob * 180 + // 성공 가능성 높은 레인 선호
        threat * 140; // 전진 위협 큰 곳 선호
      if (isOffside(m)) score -= 100000; // 온사이드 옵션이 있으면 그쪽을 무조건 먼저
      if (score > bestScore) {
        bestScore = score;
        best = j;
        bestProb = prob;
      }
    });
    // 전진 옵션이 전부 오프사이드뿐 — 깃발은 가끔만(35%), 보통은 무리한 전진 대신 끌거나 기다린다.
    if (best >= 0 && isOffside(players.current[best])) {
      const m = players.current[best];
      if (Math.random() < 0.35) {
        callOffside(p.team, m.x, m.y, offLine);
        return;
      }
      dribbleCount.current += 1;
      carryVelTo(goalCx, goalCy, 240);
      return;
    }
    const fx = fieldX();
    const clampTx = (x: number) => clamp(x, fx.min, fx.max);
    const clampTy = (y: number) => clamp(y, insetY(), h - insetY());
    // 패스길이 '보이면'(레인 개방도 충분) 깔끔히 연결. 타깃은 필드 안으로 clamp해 라인 밖(스로인) 헌납 방지.
    // 임계 0.34 — passProbability는 거리 페널티(lenPenalty, 긴 패스 0.4~0.5)를 포함해 0.5로 잡으면
    // '열려 있어도 긴 패스'가 죄다 막혀 과드리블이 났음. 레인이 실제로 막힌 경우만(낮은 prob) 끈다.
    const LANE_OPEN = 0.34;
    if (best >= 0 && bestProb >= LANE_OPEN) {
      angleCarry.current = 0;
      const m = players.current[best];
      const dpass = Math.hypot(m.x - p.x, m.y - p.y);
      const power = clamp(dpass * 3, 320, 760);
      // 주 발로 감아 찬다 — 선수가 자기 발 회전을 계산해 조준 보정하므로 휘어도 동료에게 도착한다.
      kickCurved(p, clampTx(m.x + rnd(-err, err)), clampTy(m.y + rnd(-err, err)), power);
      // 롱패스는 띄워서 수비 너머로(점유 성향 낮은 직접축구일수록 더 짧은 거리에서도 띄운다). 단 '전진'
      // 패스만 띄운다 — 뒤로 가는 백패스를 길게 띄우면(롱 백패스) 보기 끔찍하므로 지면으로 짧게.
      const fwdPass = (m.x - p.x) * dir > 0;
      if (fwdPass && dpass > w * (0.2 + possession * 0.22)) loftBall(dpass, power);
      return;
    }
    // 패스길이 안 열림 — 엉뚱한 곳에 질러 스로인 주지 말고, 공을 끌고 이동해 패스 각을 만든다(드리블).
    // 가까운 수비 반대쪽 + 골 방향으로 빠지되 터치라인으로 몰리지 않게 중앙 y로 보정. 상한 닿으면 그때
    // 가장 열린(상대서 먼) 동료에게 안전하게 짧게 연결한다.
    if (angleCarry.current < 5) {
      angleCarry.current += 1;
      let vx = goalCx - p.x;
      let vy = goalCy - p.y;
      const vl = Math.hypot(vx, vy) || 1;
      vx /= vl;
      vy /= vl;
      if (oppNear < Infinity) {
        const ax = p.x - nearEx;
        const ay = p.y - nearEy;
        const al = Math.hypot(ax, ay) || 1;
        vx = vx * 0.6 + (ax / al) * 0.4; // 수비 반대쪽으로 각 벌리기
        vy = vy * 0.6 + (ay / al) * 0.4;
      }
      vy += ((h * 0.5 - p.y) / (h * 0.5)) * 0.35; // 터치라인 회피(중앙으로 당김)
      const vn = Math.hypot(vx, vy) || 1;
      carryVelTo(p.x + (vx / vn) * 60, p.y + (vy / vn) * 60, pressed ? 210 : 175);
      return;
    }
    // 끌기 상한 도달 — 가장 열린(상대 수비서 가장 먼) 동료에게 안전 연결(필드 안으로 clamp).
    angleCarry.current = 0;
    let safe = -1;
    let safeOpen = -Infinity;
    players.current.forEach((m, j) => {
      if (m.team !== p.team || m === p || m.red) return;
      if (Math.hypot(m.x - p.x, m.y - p.y) > w * 0.5) return;
      let nd = Infinity;
      players.current.forEach((e) => {
        if (e.team === p.team || e.red) return;
        nd = Math.min(nd, Math.hypot(e.x - m.x, e.y - m.y));
      });
      if (nd > safeOpen) {
        safeOpen = nd;
        safe = j;
      }
    });
    if (safe >= 0) {
      const m = players.current[safe];
      const dd = Math.hypot(m.x - p.x, m.y - p.y);
      setVelTo(clampTx(m.x + rnd(-err, err)), clampTy(m.y + rnd(-err, err)), clamp(dd * 3, 300, 660));
      lastTouch.current = p.team;
      return;
    }
    // 정말 아무 동료도 없을 때만 골 쪽으로 살짝 끈다.
    dribbleCount.current += 1;
    carryVelTo(goalCx, goalCy, 240);
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

  // 퍼스트터치/트래핑 — 빠른 패스가 도착하면 한 번에 안 멈추고 '터치'로 받는다. 능력(페이스·패스·침착)
  // 높고 압박 적으면 발밑에 딱 죽이고, 낮거나 압박·강한 패스면 터치가 튀어(loose) 뺏길 수 있다.
  const trapBall = (p: Player) => {
    const now = performance.now();
    carrySteer.current = null; // 트래핑은 vel을 직접 정함 — 스티어 잔류 방지
    ballSpin.current = 0; // 받은 공은 회전 멈춤(발밑 정리)
    headerCount.current = 0; // 지면서 받으면 헤딩 연쇄 리셋
    const speed = Math.hypot(vel.current.x, vel.current.y);
    let oppD = Infinity;
    players.current.forEach((e) => {
      if (e.team === p.team || e.red) return;
      oppD = Math.min(oppD, Math.hypot(e.x - p.x, e.y - p.y));
    });
    const pressure = oppD < PLAYER_R * 4 ? (1 - oppD / (PLAYER_R * 4)) * 0.3 : 0;
    const ft = clamp(0.5 + (p.pace * 0.15 + p.pass * 0.3 + p.composure * 0.3) - speed / 1600 - pressure, 0.08, 0.93);
    const residual = speed * (1 - ft); // 좋은 터치=거의 0(발밑), 나쁜 터치=많이 남음
    const baseAng = Math.atan2(vel.current.y, vel.current.x);
    const ang = baseAng + (1 - ft) * rnd(-1.1, 1.1); // 나쁜 터치일수록 방향이 튄다
    vel.current.x = Math.cos(ang) * residual;
    vel.current.y = Math.sin(ang) * residual;
    ballZ.current = 0;
    ballVZ.current = 0;
    lastTouch.current = p.team;
    kickAt.current = now; // 방금 터치 — 잠깐(통제 쿨다운) 뒤 playBall/다음 터치
  };

  // 헤더 — 내려오는 공중볼(크로스·롱볼)을 다툰 선수가 받아친다. 공격 위치면 헤더 슛, 아니면 걷어냄.
  const headerBall = (p: Player) => {
    const now = performance.now();
    const { w, h } = bounds();
    lastTouch.current = p.team;
    const oppSide: Side = enemyGoalOf(p.team);
    const inAttackThird = oppSide === "right" ? p.x > w * 0.62 : p.x < w * 0.38;
    if (inAttackThird) {
      const g = goalRect(oppSide);
      const tx = oppSide === "left" ? g.x + g.w : g.x;
      const ty = g.y + g.h * (Math.random() < 0.5 ? 0.25 : 0.75);
      setVelTo(tx, ty, 340 + p.shoot * 220); // 헤더 슛 — 골 구석으로
      stats.current.shot[p.team] += 1;
      ballZ.current = 0;
      ballVZ.current = 0;
    } else {
      const dir = atkDir(p.team); // 상대 진영 쪽으로 크게 걷어냄(클리어/플릭, 진영 교체 반영)
      const tx = clamp(p.x + dir * w * 0.3, insetX(), w - insetX());
      const ty = clamp(p.y + rnd(-h * 0.15, h * 0.15), insetY(), h - insetY());
      setVelTo(tx, ty, 320);
      loftBall(Math.abs(tx - p.x), 320);
    }
    kickAt.current = now;
  };

  const bounceBallOffPlayer = (p: Player) => {
    const minD = ballDia() / 2 + PLAYER_R;
    const dx = pos.current.x - p.x;
    const dy = pos.current.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d >= minD) return;
    carrySteer.current = null; // 몸에 튕긴 공 — 스티어가 다시 끌어가지 않게 해제
    ballSpin.current = 0; // 튕긴 공은 회전 리셋(난반사)
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
    // 관전자는 자기 '줄' 위치로 복귀. 줄 위치는 저장된 tx/ty에 의존하지 않고 인덱스로 매 프레임 직접
    // 계산 → tx/ty가 어떤 이유로든 오염돼도(예: 직전 키커가 골대 옆에 남던 버그) 항상 제자리로 간다.
    // 현재 '걸어나오는/차는' 키커(setup·run)만 제외 — result 단계의 직전 키커는 바로 복귀시킨다.
    const activeKicker = s.phase === "setup" || s.phase === "run";
    players.current.forEach((p, i) => {
      if (i === s.kicker && activeKicker) return;
      const team = i < 10 ? 0 : 1;
      const k = i % 10;
      const lineX = w * 0.5;
      const lineY =
        team === 0 ? h * 0.5 - h * 0.05 - (k / 9) * h * 0.4 : h * 0.5 + h * 0.05 + (k / 9) * h * 0.4;
      const dx = lineX - p.x;
      const dy = lineY - p.y;
      const d = Math.hypot(dx, dy);
      const sp = PLAYER_SPEED * clamp(0.2 + d * 0.006, 0.2, 1.4) * dt;
      p.x += clamp(dx, -sp, sp);
      p.y += clamp(dy, -sp, sp);
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
      showBanner("하프타임");
      advanced = true;
    } else if (c.period === 2) {
      if (scoreRef.current[0] === scoreRef.current[1]) {
        c.period = 3;
        c.t = 90;
        showBanner("연장 전반");
        advanced = true;
      } else {
        endMatch();
      }
    } else if (c.period === 3) {
      c.period = 4;
      c.t = 105;
      showBanner("연장 후반");
      advanced = true;
    } else if (scoreRef.current[0] === scoreRef.current[1]) {
      startShootout(); // 연장까지 동점 → 승부차기
    } else {
      endMatch();
    }
    if (advanced) {
      c.added = 0;
      c.addedAnnounced = false;
      periodFlip.current = !periodFlip.current; // 진영 교체 — 매 피리어드(전/후반·연장)마다 골대를 바꾼다
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
    // 정규시간 끝 → 추가시간 진입 시 한 번 중앙 배너로 알림(+N분).
    const base = PERIOD_END[c.period - 1];
    if (!c.addedAnnounced && c.t >= base) {
      c.addedAnnounced = true;
      showBanner(`추가 시간 +${Math.max(1, Math.ceil(c.added))}분`, 1800);
    }
    if (c.t >= base + c.added) endPeriod();
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
      // walk가 매 프레임 키커를 공으로 데려오고 '도착했는가'를 반환. 예약 시각이 지났고 키커가
      // '실제로 공 뒤에 도착'했을 때만 찬다(선수 안 왔는데 공만 날아가던 몰입 저하 제거). 혹시 못
      // 오면 failsafe(at+3.5s)로 강제 — 영구 프리즈 방지.
      const arrived = pendingRestart.current.walk ? pendingRestart.current.walk() : true;
      if (
        tNow >= pendingRestart.current.at &&
        (arrived || tNow >= pendingRestart.current.at + 3500)
      ) {
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
      const hT: 0 | 1 = teamDefending(hside);
      // 잡은 공은 키퍼 '앞'(컵 위치)에 둔다 → 글러브(키퍼 z1)가 공 위로 덮여 '잡은' 느낌.
      const outward = hside === "left" ? 1 : -1;
      pos.current.x = keeperCenterX(hside) + outward * kdDia() * 0.32;
      pos.current.y = keeperY.current[hside];
      vel.current = { x: 0, y: 0 };
      ballZ.current = 0;
      if (tNow >= keeperHold.current.until) {
        keeperHold.current = { side: null, until: 0 };
        const upX = hside === "left" ? 1 : -1;
        const ks = keeperStats.current[hside];
        if (Math.random() < 0.55) {
          // 스로(가까운 동료에게 짧고 정확히) — 던지는 '손' 방향으로 감긴다.
          passToNearestTeammate(hT, pos.current.x, pos.current.y, 300, ks.hand);
        } else {
          // 펀트(업필드 롱·띄움) — 차는 '발' 방향으로 감긴다.
          const { w: bw, h: bh } = bounds();
          const tx = pos.current.x + upX * bw * 0.5;
          kickCurvedSign(tx, bh * 0.5 + rnd(-bh * 0.22, bh * 0.22), 540, ks.foot, 0.4);
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
      // 막 공 뺏은 팀 → 역습 윈도우(약 2.5s). 단 경합서 점유가 깜빡깜빡 바뀔 때 매번 켜지면 전원
      // 상시 스프린트로 개떼가 되므로, 직전 윈도우 끝나고 3.5s 지난 뒤에만(쿨다운) 재발동.
      const tc = transition.current;
      if (
        lost != null &&
        lost !== ctrl &&
        pendingRestart.current == null &&
        (tc == null || tNow > tc.until + 3500)
      ) {
        transition.current = { team: ctrl, until: tNow + 2500 };
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
      // 드리블 턴 스무딩 — 캐리 터치가 건 목표 속도(carrySteer)로 vel을 매 프레임 수렴시킨다.
      // 즉시 꺾지 않고 호를 그리며 도는 효과. 목표에 충분히 가까워지면 해제하고 마찰로 자연 감속.
      // 떠 있는(airborne) 공은 통과/포물선 중이라 스티어 안 함.
      if (carrySteer.current && ballZ.current <= AIR_MIN) {
        // 캐리 턴 — 속도 '벡터'를 그대로 lerp하면 반대방향으로 꺾을 때 중간에 크기가 0으로 collapse돼
        // 공이 멈췄다 튀어나가(툭툭/순간이동) 보였다. 대신 '진행 방향(각)'만 최대 회전율로 천천히 돌리고
        // 속도(크기)는 따로 이징 → 절대 멈추지 않고 호를 그리며 스윽 돈다(120도 급선회도 끊김 없이).
        const s = carrySteer.current;
        const curSp = Math.hypot(vel.current.x, vel.current.y);
        const tgtSp = Math.hypot(s.vx, s.vy) || 1;
        const tgtAng = Math.atan2(s.vy, s.vx);
        const curAng = curSp > 4 ? Math.atan2(vel.current.y, vel.current.x) : tgtAng; // 거의 정지면 목표서 출발
        let dA = tgtAng - curAng;
        while (dA > Math.PI) dA -= Math.PI * 2;
        while (dA < -Math.PI) dA += Math.PI * 2;
        const maxTurn = 0.11; // rad/frame(~6.3°/프레임 ≈ 380°/s) — 작을수록 더 느긋한 턴
        const newAng = curAng + clamp(dA, -maxTurn, maxTurn);
        const newSp = curSp + (tgtSp - curSp) * 0.2; // 크기는 0으로 안 죽고 목표 속도로 부드럽게
        vel.current.x = Math.cos(newAng) * newSp;
        vel.current.y = Math.sin(newAng) * newSp;
        // 수렴해도 carrySteer를 자동 해제하지 않는다 — '드리블 점유 락'으로 유지해, 빠르게 굴러가는
        // 공이 trapBall에 안 걸리고(자기 공 안 끊김) 다음 캐리에서 현재 진행방향부터 매끄럽게 이어진다.
        // 해제는 패스/슛(setVelTo·kickCurved)·태클·트래핑(상대)·세트피스·드래그가 담당한다.
      }
      // 주 발 커브 — 비행 중 속도 벡터를 ballSpin(rad/s)만큼 회전시켜 공이 휜다(바나나). 충분히
      // 빠를 때만(느려지면 직진하다 멈춤). 떠 있는 공(롱볼)도 휘게 둔다(크로스 감김).
      if (ballSpin.current !== 0) {
        const sp = Math.hypot(vel.current.x, vel.current.y);
        if (sp > STOP_SPEED * 3) {
          const a = ballSpin.current * dt;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const vx = vel.current.x;
          const vy = vel.current.y;
          vel.current.x = vx * ca - vy * sa;
          vel.current.y = vx * sa + vy * ca;
          // 시각 스핀 — 커브 방향·세기에 비례해 공을 돌린다(빠를수록 더 빨리). 600=가시성 계수.
          ballRoll.current += ballSpin.current * 600 * dt * (0.4 + Math.min(1, sp / 500) * 0.6);
        } else {
          ballSpin.current = 0; // 느려지면 회전 종료
        }
      }
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
        // 태클 — 견제 거리(standoff)서 압박수가 공 가진 상대 발에 발을 넣어 끊는다(접촉 직전 사거리).
        //   능력(press·aggression)+체력 확률. 성공: 공을 자기 진행쪽으로 떼어내 점유 가로챔. 실패:
        //   개별 쿨다운으로 잠깐 못 넣음(아래 접촉/파울 로직으로 흘러가 거친 발은 파울이 될 수 있음).
        const TACKLE_R = minD + PLAYER_R * 0.9;
        if (
          run &&
          lastTouch.current != null &&
          p.team !== lastTouch.current &&
          d < TACKLE_R &&
          speed < CONTROL_SPEED * 1.3 &&
          now - p.tackleAt > 460 &&
          now - kickAt.current > 130
        ) {
          p.tackleAt = now;
          const winP = clamp(0.26 + p.press * 0.26 + p.aggression * 0.16 - (1 - p.stamina) * 0.2, 0.12, 0.7);
          if (Math.random() < winP) {
            const fdir = atkDir(p.team); // 자기 공격 방향으로 끊어 나감(진영 교체 반영)
            carrySteer.current = null; // 태클로 끊김 — 뺏긴 팀 드리블 스티어 무효
            ballSpin.current = 0;
            lastTouch.current = p.team;
            kickAt.current = now;
            pos.current.x = p.x + fdir * minD;
            pos.current.y = p.y;
            vel.current.x = fdir * 120 + rnd(-40, 40);
            vel.current.y = rnd(-40, 40);
            return; // 끊김 — 이 프레임 이 선수의 접촉 처리 종료
          }
        }
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
        if (i === near.overall) {
          // 캐리어/리시버 처리. 가까운 상대까지 거리로 결정 쿨다운 — 압박 받으면 빨리 내보낸다.
          let oppD = Infinity;
          players.current.forEach((e) => {
            if (e.team === p.team || e.red) return;
            oppD = Math.min(oppD, Math.hypot(e.x - p.x, e.y - p.y));
          });
          const cd = oppD < bounds().w * 0.06 ? 150 : KICK_CD;
          if (carrySteer.current) {
            // ★ 드리블 캐리 중 — 스티어가 공을 부드럽게(角 단위로) 몰고 간다. '자기 공'을 트랩/튕김/셸드로
            // 절대 끊지 않는다. 예전엔 캐리 속도(>CONTROL_SPEED)의 공이 trapBall 가지에 걸려 매 결정마다
            // 랜덤 각(±63°)으로 redirect돼 공이 '툭툭 순간이동(120도 급회전)'하던 게 진짜 원인이었다.
            // 결정 시점이 되면 다음 드리블 방향/패스/슛만 재결정(playBall)한다.
            if (run && now - kickAt.current > cd) playBall(p);
          } else if (run && speed < CONTROL_SPEED) {
            // 발밑 컨트롤(드리블 아님) — 결정 시점이면 처리, 아니면 발밑에 잡고 선다(셸드).
            if (now - kickAt.current > cd) {
              playBall(p);
            } else {
              vel.current.x *= 0.6;
              vel.current.y *= 0.6;
              const hx = pos.current.x - p.x;
              const hy = pos.current.y - p.y;
              const hd = Math.hypot(hx, hy) || 1;
              const hold = ballDia() / 2 + PLAYER_R * 0.6;
              pos.current.x = p.x + (hx / hd) * hold;
              pos.current.y = p.y + (hy / hd) * hold;
            }
          } else if (run && speed < TRAP_MAX && now - kickAt.current > 150) {
            // 빠른 공 받기 — 퍼스트터치(트래핑). 내 드리블이 아닐 때만(carrySteer 없을 때) 여기로 온다.
            trapBall(p);
          } else {
            bounceBallOffPlayer(p);
          }
        } else {
          bounceBallOffPlayer(p); // 캐리어 외 선수에 닿으면 튕김(수비 차단·난반사)
        }
      });
    }

    // 헤더 — 내려오는 공중볼(크로스·롱볼)이 헤딩 높이까지 오면 근처 선수가 다툰다(키 큰 쪽 유리).
    if (run && !frozen && airborne && ballVZ.current < 0 && ballZ.current < 34 && now >= restartGrace.current) {
      const HEADER_R = ballDia() / 2 + PLAYER_R + 10;
      let bestI = -1;
      let bestScore = Infinity;
      players.current.forEach((p, i) => {
        if (p.red) return;
        const d = Math.hypot(pos.current.x - p.x, pos.current.y - p.y);
        if (d > HEADER_R) return;
        const score = d - (p.heightCm - 178) * 0.3; // 키 클수록 유리
        if (score < bestScore) {
          bestScore = score;
          bestI = i;
        }
      });
      // 헤딩은 '경합/크로스' 상황에서만 — 박스 근처로 뜬 공(코너·크로스)이거나 양 팀이 같은 공중볼을
      // 다툴 때. 필드 중앙의 평범한 로빙 패스는 헤딩 안 하고 그냥 떨어뜨려(낙하 후 trap) 발로 받는다.
      let allowHeader = false;
      if (bestI >= 0) {
        const { w: hw, h: hh } = bounds();
        const bx = pos.current.x;
        const by = pos.current.y;
        const nearBox = (bx < hw * 0.22 || bx > hw * 0.78) && Math.abs(by - hh * 0.5) < hh * 0.34;
        const bt = players.current[bestI].team;
        let contested = false;
        players.current.forEach((q, j) => {
          if (j === bestI || q.red || q.team === bt) return;
          if (Math.hypot(q.x - bx, q.y - by) < HEADER_R * 2.4) contested = true;
        });
        allowHeader = nearBox || contested;
      }
      if (bestI >= 0 && allowHeader && now - kickAt.current > 200) {
        if (headerCount.current >= 2) {
          // 헤딩 연쇄 끊기 — 같은 공중볼을 서로 계속 받아넘기면(헤딩 남발) 한 번은 죽여 지면 컨트롤로
          // 내린다. 안 그러면 clear 헤더가 또 띄워 땅에 떨어질 때까지 무한 헤딩이 됐음.
          const p = players.current[bestI];
          lastTouch.current = p.team;
          ballZ.current = 0;
          ballVZ.current = 0;
          vel.current.x *= 0.25;
          vel.current.y *= 0.25;
          kickAt.current = now;
          headerCount.current = 0;
        } else {
          headerCount.current += 1;
          headerBall(players.current[bestI]);
        }
      }
    }

    // 스톨 복구 — 갇히거나 멈추면 볼 드롭(자동경기 끄기 전엔 안 멈춤). 프리즈 중엔 스킵.
    if (run && !dragging.current && !frozen) {
      const fx = fieldX();
      const reachable = pos.current.x > fx.min - 24 && pos.current.x < fx.max + 24;
      // 활성 판정 — 공이 빠르거나(speed>40), '최근에 선수가 터치(드리블/패스/트래핑)'했으면 활성으로 본다.
      // 드리블 중엔 공이 느리게 굴러 speed<40이라 예전엔 스톨로 오판해 볼드롭이 떴음 → kickAt도 본다.
      const recentlyTouched = now - kickAt.current < 2000;
      // 접전 — 양 팀 선수가 공 주변서 다투는 중이면 '갇힌' 게 아니라 활성. 안 그러면 경합이 스톨로
      // 오판돼 거짓 드롭볼(심판이 떨어뜨린 것처럼 보이는 랜덤 킥)이 떴음. standoff+태클(위)로 경합은
      // 곧 풀리므로 무한 wedge 위험 없음.
      const cr = bounds().w * 0.06;
      let nearAtk = 0;
      let nearDef = 0;
      if (lastTouch.current != null) {
        players.current.forEach((q) => {
          if (q.red) return;
          if (Math.hypot(q.x - pos.current.x, q.y - pos.current.y) > cr) return;
          if (q.team === lastTouch.current) nearAtk += 1;
          else nearDef += 1;
        });
      }
      const contested = nearAtk > 0 && nearDef > 0;
      if ((speed > 40 || recentlyTouched || contested) && reachable) lastActiveAt.current = now;
      if (now - lastActiveAt.current > 3200) {
        // 공이 어딘가에 갇혀 한참 안 움직일 때의 '기술적 복구'일 뿐, 진짜 드롭볼(심판이 떨어뜨림)이
        // 아니다 → 라벨·단서 없이 조용히 살짝 툭 친다(예전엔 '볼 드롭'을 띄워 남발처럼 보였음).
        // 닿을 수 있는 곳이면 그 자리에서, 진짜 갇힌(필드 밖) 경우만 중앙으로.
        if (!reachable) centerBall();
        vel.current.x = (Math.random() * 2 - 1) * 200;
        vel.current.y = (Math.random() * 2 - 1) * 150;
        lastTouch.current = null;
        lastActiveAt.current = now;
        logEvent("ballDrop"); // 내부 로그만(시각 표시 없음)
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
    // 기본값: 웹은 켬(데스크톱은 화면 넓어 방해 안 됨), 모바일은 끔. 작은 화면에서 미니게임(+중력공)이
    // 갑툭튀로 떠 시청을 가리던 문제 방지. 모바일은 'on' 저장돼 있어도 '자동 시작'은 안 한다 — 매번
    // 탭(켜기)으로만 연다. (모바일은 화면 껐다 켜면 브라우저가 탭을 리로드해 컴포넌트가 새로 마운트되며
    // 'on'이면 새 경기가 떠 공이 툭 떨어지던 게 원인. 자동 시작을 웹으로 한정해 그 갑툭튀를 막는다.)
    let en = !rotated.current;
    let au = true;
    let savedAuto: string | null = null;
    try {
      const savedGame = window.localStorage.getItem("vic.worldcupGame");
      if (savedGame === "off") en = false;
      else if (savedGame === "on" && !rotated.current) en = true; // 자동 시작은 웹에서만
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

  // 미니게임 on/off를 알린다 → 시청자 중력 축구공(WorldCupStudioBall)이 미니게임 켜지면 숨는다.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("wc-minigame-enabled", { detail: { enabled } }));
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
    carrySteer.current = null; // 사용자가 공 잡음 — AI 드리블 스티어 무효
    ballSpin.current = 0;
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
              setPickKeeper(null);
              setTacticsOpen(false);
              setStatsOpen(false);
              setTacticDesc(null);
              setNamesOpen(null);
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
                className={`wc-keeper wc-keeper-${side} ${pickKeeper === side ? "wc-keeper-pick" : ""}`}
                style={keeperStyle(side)}
                onPointerEnter={
                  isMobile
                    ? undefined
                    : (e) => {
                        if (e.shiftKey) {
                          setPickPlayer(null);
                          setPickKeeper(side);
                        }
                      }
                }
                onClick={(e) => {
                  e.stopPropagation();
                  setPickPlayer(null);
                  setPickKeeper((c) => (c === side ? null : side));
                  hapticTick();
                }}
                ref={(el) => {
                  keeperRef.current[side] = el;
                }}
              >
                <i
                  className="wc-glove wc-glove-b"
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
                    // 웹: 그냥 스치면 방해되므로 'Shift 누른 채' 스칠 때만 카드. 뜨면 유지(딤 클릭 시 닫힘).
                    // Shift 없이 그냥 클릭해도 토글로 뜬다(아래 onClick). 키퍼 카드는 닫는다(상호배타).
                    isMobile
                      ? undefined
                      : (e) => {
                          if (e.shiftKey) {
                            setPickKeeper(null);
                            setPickPlayer(i);
                          }
                        }
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    setPickKeeper(null);
                    setPickPlayer((c) => (c === i ? null : i)); // 모바일 탭/웹 클릭 토글
                    hapticTick();
                  }}
                  ref={(el) => {
                    playerEls.current[i] = el;
                  }}
                >
                  {/* 부상 십자가 — 심한 부상(.wc-player-hurt/down)일 때만 보이고, 선수와 함께 이동(회복 시 사라짐). */}
                  <span className="wc-player-cross" aria-hidden="true">
                    ✚
                  </span>
                  {/* 옐로카드 — 경고 받은 선수 머리 위 🟨(부상 십자가처럼 따라다님). */}
                  <span className="wc-player-card" aria-hidden="true">
                    🟨
                  </span>
                </div>
              );
            })}
            {fieldCue ? (
              <Fragment key={fieldCue.id}>
                {fieldCue.lineX != null ? (
                  <div className="wc-offside-line" style={{ left: `${fieldCue.lineX}px` }} />
                ) : null}
                <div
                  className={`wc-cue wc-cue-${fieldCue.kind}`}
                  style={{ left: `${fieldCue.x}px`, top: `${fieldCue.y}px` }}
                >
                  <span>{fieldCue.label}</span>
                </div>
              </Fragment>
            ) : null}
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
                <span
                  className={`wc-score-name ${isMobile ? "wc-score-name-tap" : ""}`}
                  onClick={
                    isMobile
                      ? (e) => {
                          e.stopPropagation();
                          setNamesOpen((o) => (o === 0 ? null : 0));
                          hapticTick();
                        }
                      : undefined
                  }
                >
                  {teamNames[0] || "RED"}
                </span>
                {renderTeamCards(cardCounts.yellow[0], cardCounts.red[0])}
              </span>
              <strong className="wc-score-num">
                {score[0]} <span>:</span> {score[1]}
              </strong>
              <span className="wc-score-team wc-score-b">
                {renderTeamCards(cardCounts.yellow[1], cardCounts.red[1])}
                <span
                  className={`wc-score-name ${isMobile ? "wc-score-name-tap" : ""}`}
                  onClick={
                    isMobile
                      ? (e) => {
                          e.stopPropagation();
                          setNamesOpen((o) => (o === 1 ? null : 1));
                          hapticTick();
                        }
                      : undefined
                  }
                >
                  {teamNames[1] || "BLUE"}
                </span>
              </span>
            </div>
            {isMobile && namesOpen != null ? (
              <div className={`wc-names-pop wc-names-pop-${namesOpen}`} role="status">
                {namesOpen === 0 ? "🔴 " : ""}
                {teamNames[namesOpen] || (namesOpen === 0 ? "RED" : "BLUE")}
                {namesOpen === 1 ? " 🔵" : ""}
              </div>
            ) : null}
            {clockText ? <div className="wc-clock">{clockText}</div> : null}
            <button
              type="button"
              className={`wc-tac-btn ${tacticsOpen ? "on" : ""}`}
              onClick={() => {
                setTacticsOpen((o) => !o);
                setTacticDesc(null);
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
            {saveFlash ? (
              <div className={`wc-save-text wc-save-${saveFlash}`}>
                {/* 골 뜬 동안 글러브에 닿았어도 결국 들어갔으니 '막았다..?'(아쉬움) */}
                {goalFlash ? "막았다..?" : "막았다!"}
              </div>
            ) : null}
            {setPiece ? <div className="wc-setpiece">{setPiece}</div> : null}
            {phaseBanner ? <div className="wc-phase-banner">{phaseBanner}</div> : null}
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
                  const footKo =
                    p.preferredFoot === "right" ? "오른발" : p.preferredFoot === "left" ? "왼발" : "양발";
                  const cards = p.red ? "🟥" : p.yellow >= 2 ? "🟨🟨" : p.yellow === 1 ? "🟨" : "";
                  const condition = Math.max(0, 1 - p.knock); // 1=멀쩡 .. 0=심한 부상
                  const hurt = p.knock > 0.1;
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
                        <span className="pc-foot">{footKo}</span>
                        {cards ? <span className="pc-card">{cards}</span> : null}
                        {hurt ? <span className="pc-card">🤕</span> : null}
                      </div>
                      <div className="wc-pcard-stam-row">
                        <span>체력</span>
                        <div className="wc-pcard-bar">
                          <i style={{ width: `${Math.round(p.stamina * 100)}%` }} />
                        </div>
                      </div>
                      <div className="wc-pcard-stam-row">
                        <span>{hurt ? "부상" : "컨디션"}</span>
                        <div className={`wc-pcard-bar ${hurt ? "wc-pcard-bar-hurt" : ""}`}>
                          <i style={{ width: `${Math.round(condition * 100)}%` }} />
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
            {pickKeeper
              ? (() => {
                  const team: 0 | 1 = pickKeeper === "left" ? 0 : 1;
                  const ks = keeperStats.current[pickKeeper];
                  const form = teams.current?.[team]?.formation ?? "";
                  const rows: [string, number][] = [
                    ["반응", ks.reflex],
                    ["핸들링", ks.handling],
                    ["킥", ks.kick],
                    ["스위핑", ks.sweep],
                    ["침착", ks.composure]
                  ];
                  return (
                    <div className={`wc-pcard wc-pcard-${team}`}>
                      <div className="wc-pcard-head">
                        <b className="num">1</b>
                        <span>골키퍼 · {form}</span>
                        <span className="pc-foot">
                          {ks.hand < 0 ? "왼손" : "오른손"}·{ks.foot < 0 ? "왼발" : "오른발"}
                        </span>
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
                      onClick={() => {
                        applyTeamStyle(team, s);
                        setTacticDesc(s); // 탭/클릭 → 풀네임+설명 박스(모바일은 이렇게 본다)
                      }}
                      onMouseEnter={() => setTacticDesc(s)} // 웹 호버 → 설명 미리보기
                      onMouseLeave={() => setTacticDesc((d) => (d === s ? null : d))}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {tacticDesc ? (
              <div className="wc-tac-desc" role="status">
                <b className="wc-tac-desc-name">{tacticDesc.name}</b>
                <span className="wc-tac-desc-text">{tacticDesc.desc}</span>
              </div>
            ) : null}
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
