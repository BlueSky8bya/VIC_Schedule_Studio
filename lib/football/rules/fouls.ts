// Law 12 파울·부정행위 + 어드밴티지(Law 5). 순수 룰 — DOM/물리 무관, RL 보상·이벤트의 토대.
//
// 핵심:
//  - 충돌은 '거리'가 아니라 히트박스: 태클한 발이 공보다 상대 '몸'에 먼저 닿으면 파울.
//  - 카드: 강도(careless<reckless<seriousFoulPlay) + 위치(DOGSO=결정적 기회 저지) + 누적 옐로(2장=레드).
//  - 어드밴티지: 반칙났어도 공격팀이 유리하면 끊지 않는다.
//
// 참고: IFAB Law 12(Fouls and Misconduct), Law 5(Advantage).

import type { RestartKind, TeamSide, Vec2 } from "@/lib/football/core/types";

/** 파울 강도. none=정당, careless=무카드 파울, reckless=경고(옐로), seriousFoulPlay=퇴장(레드). */
export type FoulSeverity = "none" | "careless" | "reckless" | "seriousFoulPlay";
export type CardKind = "none" | "yellow" | "red";

/** 태클 충돌 판정 — 태클한 '발 히트박스'가 공보다 상대 '몸 히트박스'에 먼저 닿으면 파울. */
export function isFoulContact(args: {
  tacklerFoot: Vec2; // 태클하는 발 위치
  ballPos: Vec2;
  victimBody: Vec2; // 상대(공 보유자) 몸 중심
  footReach: number; // 발 히트박스 반경
  bodyRadius: number; // 몸 히트박스 반경
}): boolean {
  const { tacklerFoot, ballPos, victimBody, footReach, bodyRadius } = args;
  const toBall = Math.hypot(tacklerFoot.x - ballPos.x, tacklerFoot.y - ballPos.y);
  const toBody = Math.hypot(tacklerFoot.x - victimBody.x, tacklerFoot.y - victimBody.y);
  const hitsBody = toBody <= footReach + bodyRadius;
  const hitsBall = toBall <= footReach; // 공을 먼저 건드렸나
  // 몸엔 닿는데 공엔 안 닿거나, 공보다 몸이 더 가까우면 파울.
  return hitsBody && (!hitsBall || toBody < toBall);
}

/**
 * 파울 강도 결정 — 태클러 공격성(aggression)·규율(discipline)·속도(접근 가속)로.
 * 빠르게 무리한 슬라이딩일수록(고속+고공격성+저규율) reckless/seriousFoulPlay.
 */
export function foulSeverity(args: {
  aggression: number; // 0..1
  discipline: number; // 0..1
  approachSpeed: number; // 정규화 0..1(빠를수록 위험)
  fromBehind?: boolean; // 백태클(뒤에서)
  rng: number; // 0..1
}): FoulSeverity {
  const { aggression, discipline, approachSpeed, fromBehind, rng } = args;
  // 위험도 = 공격성·속도↑, 규율↓, 백태클 가중.
  const danger =
    aggression * 0.4 + approachSpeed * 0.4 + (1 - discipline) * 0.3 + (fromBehind ? 0.2 : 0);
  if (danger > 0.95 && rng < 0.5) return "seriousFoulPlay";
  if (danger > 0.6) return "reckless";
  if (danger > 0.3) return "careless";
  return "none";
}

/** 카드 결정 — 강도 + DOGSO(결정적 득점기회 저지) + 누적 옐로(2장→레드). */
export function cardFor(args: {
  severity: FoulSeverity;
  deniedGoalChance?: boolean; // DOGSO
  existingYellows: number; // 이 선수가 이미 받은 옐로 수
}): { card: CardKind; sentOff: boolean } {
  const { severity, deniedGoalChance, existingYellows } = args;
  if (severity === "seriousFoulPlay") return { card: "red", sentOff: true };
  let card: CardKind = "none";
  if (severity === "reckless") card = "yellow";
  // 결정적 기회 저지(전문적 파울)는 위치에 따라 옐로↑, 마지막 수비수면 레드.
  if (deniedGoalChance && card === "none") card = "yellow";
  if (deniedGoalChance && severity === "reckless") return { card: "red", sentOff: true }; // 명백 DOGSO
  if (card === "yellow" && existingYellows >= 1) return { card: "red", sentOff: true }; // 2nd yellow
  return { card, sentOff: false };
}

/**
 * 어드밴티지(Law 5) — 반칙이 있었지만 공격팀이 '여전히 유리'하면 끊지 않고 진행.
 * 공 소유 유지 + 공격 진영/속공이면 true(플레이 속행), 아니면 false(휘슬→프리킥).
 */
export function playAdvantage(args: {
  fouledTeamRetainsBall: boolean;
  inAttackingThird: boolean;
  clearChanceAhead: boolean;
}): boolean {
  const { fouledTeamRetainsBall, inAttackingThird, clearChanceAhead } = args;
  if (!fouledTeamRetainsBall) return false;
  return inAttackingThird || clearChanceAhead;
}

/** 파울 위치에서의 재개 종류 — 보통 직접 프리킥, 페널티 박스 안 수비 반칙이면 페널티킥. */
export function freeKickKind(args: {
  foulInOwnPenaltyArea: boolean; // 반칙한 팀(수비)의 페널티 박스 안인가
  indirectOnly?: boolean; // 간접만 해당(예: 백패스 핸들링)
}): RestartKind {
  if (args.foulInOwnPenaltyArea && !args.indirectOnly) return "penaltyKick";
  return args.indirectOnly ? "indirectFreeKick" : "directFreeKick";
}

/** 퇴장 후 수적 우위(보상/관측용). 양수 = 우리 팀이 더 많음(우위), 음수 = 열세. */
export function numericalAdvantage(sentOffByTeam: [number, number], team: TeamSide): number {
  const own = sentOffByTeam[team];
  const opp = sentOffByTeam[team === 0 ? 1 : 0];
  return opp - own; // 상대가 더 많이 퇴장당함 = 우리 우위(+)
}
