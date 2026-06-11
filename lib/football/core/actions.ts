// 축구 액션·전술 taxonomy — RL 행동공간/전술 어휘의 단일 출처(기초 적립). DOM 무관 순수 타입.
// 패스·슛·드리블·개인기·수비·오프더볼·팀전술·공간개념·지표를 enum과 메타데이터로 구조화한다.
// Phase 2(scripted AI)·Phase 3(RL action/observation/reward)가 이 어휘를 그대로 쓴다.
//
// 근거: 현대 축구 분석 + GRF/멀티에이전트 RL action space 설계. 메트릭은 xG/xA/PPDA 등 표준.

import type { Vec2 } from "@/lib/football/core/types";

// ── 1. 온더볼: 패스 ─────────────────────────────────────────────────────────
export type PassKind =
  | "groundShort" // 인사이드 짧은 땅볼
  | "groundMedium"
  | "backPass"
  | "lateralPass"
  | "progressivePass" // 전진 패스
  | "lineBreakingPass" // 라인 사이를 깨는 패스
  | "throughPass" // 수비 뒷공간 땅볼 스루
  | "loftedThroughPass" // 띄운 스루
  | "longBall" // 롱볼/전환
  | "switchOfPlay" // 사이드 전환
  | "crossHigh"
  | "crossLow"
  | "earlyCross"
  | "cutback" // 컷백(역방향 마이너스)
  | "wallPass" // 원투/벽패스
  | "thirdManPass"
  | "oneTouchPass"
  | "clearance"
  | "keeperThrow"
  | "keeperRoll"
  | "keeperDropKick"
  | "keeperPunt"
  | "keeperShortPass";

/** 공중으로 뜨는 패스(선수/키퍼 통과 + 시각 흐림 등 처리에 쓰임). */
export const LOFTED_PASSES: ReadonlySet<PassKind> = new Set<PassKind>([
  "loftedThroughPass",
  "longBall",
  "switchOfPlay",
  "crossHigh",
  "earlyCross",
  "keeperDropKick",
  "keeperPunt"
]);

/** 전진 가치가 큰(라인을 깨는) 패스 — 보상 설계용. */
export const PROGRESSIVE_PASSES: ReadonlySet<PassKind> = new Set<PassKind>([
  "progressivePass",
  "lineBreakingPass",
  "throughPass",
  "loftedThroughPass",
  "longBall",
  "cutback",
  "earlyCross"
]);

// ── 1.2 슛 ──────────────────────────────────────────────────────────────────
export type ShotKind =
  | "instep" // 인스텝 강슛
  | "finesse" // 감아차기/피네스
  | "chip" // 칩(키퍼 넘기기)
  | "volley"
  | "header"
  | "tap"; // 근접 밀어넣기

// ── 1.3 볼 운반·개인기 ──────────────────────────────────────────────────────
export type CarryKind =
  | "firstTouch" // 퍼스트터치(유리한 공간으로)
  | "knockOn" // 길게 치고 스피드 돌파
  | "closeControl" // 발밑 바짝(좁은 공간)
  | "shielding"; // 등지고 버티기(포스트플레이)

export type SkillMove =
  | "bodyFeint" // 바디 페인팅
  | "stepover" // 스텝오버/헛다리
  | "flipFlap" // 플립플랩(아웃-인)
  | "marseilleTurn" // 마르세유 턴(360)
  | "cruyffTurn" // 크루이프 턴
  | "laCroqueta" // 라 크로케타/팬텀
  | "rainbowFlick" // 레인보우 플릭(사파타)
  | "heelChop" // 힐 촙
  | "elastico"; // 엘라스티코

/** 1대1에서 수비를 제치는 개인기(타이밍 뺏기). */
export const BEAT_MAN_SKILLS: ReadonlySet<SkillMove> = new Set<SkillMove>([
  "stepover",
  "flipFlap",
  "marseilleTurn",
  "cruyffTurn",
  "laCroqueta",
  "elastico",
  "heelChop"
]);

// ── 1.4 수비 기술 ───────────────────────────────────────────────────────────
export type DefensiveAction =
  | "standingTackle"
  | "slidingTackle"
  | "interception"
  | "clearance"
  | "block";

// ── 2. 오프더볼 움직임 ──────────────────────────────────────────────────────
export type OffBallRun =
  // 공격 시
  | "overlap"
  | "underlap"
  | "lineBreakingRun" // 오프사이드 트랩 깨고 뒷공간 침투
  | "droppingDeep" // 펄스나인(내려와 유인)
  | "dummyRun" // 더미런(미끼)
  | "occupyHalfSpace"
  | "pinDefender"
  | "supportAngle"
  // 수비 시
  | "press"
  | "jockey" // 지연
  | "cover" // 커버 플레이
  | "offsideTrap"
  | "restDefense"
  | "counterpressSurround"
  | "holdLine"
  | "stepOut"
  | "drop";

// ── 3. 팀 전술(거시) ────────────────────────────────────────────────────────
export type TeamTactic =
  | "positionalPlay" // 포지셔널 플레이(펩)
  | "directPlay" // 다이렉트/롱볼
  | "counterAttack"
  | "tikiTaka"
  | "gegenpressing"
  | "highBlock"
  | "midBlock"
  | "lowBlock"
  | "zonalMarking"
  | "manMarking";

// ── 4. 현대 축구 공간·역할(보상 설계용) ─────────────────────────────────────
export type SpaceConcept = "halfSpace" | "zone14" | "invertedFullback" | "isolation" | "mezzala";

/** 피치 세로 5등분 채널(0=위 터치라인 .. 4=아래). 1·3이 하프스페이스. y는 [-W/2,+W/2]. */
export function widthChannel(y: number, halfWidth: number): 0 | 1 | 2 | 3 | 4 {
  const f = (y + halfWidth) / (2 * halfWidth); // 0..1
  return Math.min(4, Math.max(0, Math.floor(f * 5))) as 0 | 1 | 2 | 3 | 4;
}
export function isHalfSpace(y: number, halfWidth: number): boolean {
  const c = widthChannel(y, halfWidth);
  return c === 1 || c === 3;
}
/** 존14 — 상대 페널티 박스 바로 앞 중앙(킬패스·중거리슛의 요람). attackingTeam 기준 공격 방향. */
export function inZone14(pos: Vec2, attackingTeam: 0 | 1, halfLength: number, halfWidth: number): boolean {
  const dir = attackingTeam === 0 ? 1 : -1;
  const dx = dir * pos.x; // 상대 골 쪽이 +
  // 상대 골라인에서 16.5~33m 앞(박스 바로 앞 한 구역), 중앙 채널.
  const inBand = dx > halfLength - 33 && dx < halfLength - 16.5;
  return inBand && widthChannel(pos.y, halfWidth) === 2;
}

// ── 5. 평가 지표 ────────────────────────────────────────────────────────────
export type Metric = "xG" | "xA" | "ppda" | "fieldTilt" | "possessionValue" | "packing";

// ── 골키퍼 액션(손/발 구분) ─────────────────────────────────────────────────
export type GoalkeeperAction =
  | "catch" // 잡기(보유)
  | "parry" // 쳐내기
  | "punch" // 펀칭
  | "smother" // 1대1 덮치기
  | "sweep" // 스위퍼(발 처리, 라인 밖)
  | "throwOut"
  | "rollOut"
  | "dropKick"
  | "punt"
  | "shortPass";

/** 손을 쓰는 GK 액션(라인 밖 스위핑은 발만 가능 — backPass/8초 규칙과 연동). */
export const GK_HAND_ACTIONS: ReadonlySet<GoalkeeperAction> = new Set<GoalkeeperAction>([
  "catch",
  "parry",
  "punch",
  "smother",
  "throwOut",
  "rollOut",
  "dropKick",
  "punt"
]);
