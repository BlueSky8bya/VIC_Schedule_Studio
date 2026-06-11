// Law 8·13~17 재개 상태머신 — 오픈플레이 결과(골/아웃/오프사이드)를 다음 페이즈/재개로 옮긴다.
// 흐름: openPlay → (판정) → stoppage → restartSetup → restartReady → openPlay.
// 공이 '명확히 움직이면' 인플레이(restartTaken). 지연 카운트다운(월드컵2026) 만료 시 상대로 전환.
//
// 참고: IFAB Law 8 시작/재개, Law 16 골킥, Law 17 코너킥, Law 11 오프사이드 간접 FK.

import type { Side, TeamSide, Vec2 } from "@/lib/football/core/types";
import type { GameState, RestartState } from "@/lib/football/core/game-state";
import { goalScoredSide, scoringTeamForGoal } from "@/lib/football/rules/goals";
import { ballOut, type OutResult } from "@/lib/football/rules/in-out";

export type OpenPlayOutcome =
  | { type: "inPlay" }
  | { type: "goal"; side: Side; scoringTeam: TeamSide }
  | { type: "out"; out: Extract<OutResult, { out: true }> };

/** 오픈플레이에서 공 위치로 다음 결과 판정(골 우선 → 아웃 → 인플레이). */
export function resolveOpenPlay(state: GameState): OpenPlayOutcome {
  const side = goalScoredSide(state.ball);
  if (side) return { type: "goal", side, scoringTeam: scoringTeamForGoal(side) };
  const out = ballOut(state.ball, state.lastTouch);
  if (out.out) return { type: "out", out };
  return { type: "inPlay" };
}

const other = (t: TeamSide): TeamSide => (t === 0 ? 1 : 0);

/** 아웃 결과 → 재개 상태. */
export function restartFromOut(out: Extract<OutResult, { out: true }>): RestartState {
  return {
    kind: out.restart,
    team: out.awardTeam,
    location: out.location,
    side: out.side,
    ready: false
  };
}

/** 오프사이드 관여 반칙 → 수비팀 간접 프리킥. location = 반칙(받은) 지점. */
export function restartFromOffside(attackingTeam: TeamSide, location: Vec2): RestartState {
  return {
    kind: "offsideIndirectFreeKick",
    team: other(attackingTeam), // 수비팀
    location,
    causedByOffside: true,
    ready: false
  };
}

/** 득점 후 킥오프 — 실점한 팀이 센터에서 재개. */
export function kickoffRestart(concedingTeam: TeamSide): RestartState {
  return { kind: "kickoff", team: concedingTeam, location: { x: 0, y: 0 }, ready: false };
}

/** 재개 시작(stoppage→restartSetup) + 지연 카운트다운(스로인/골킥, 월드컵2026) 설정. */
export function beginRestart(state: GameState, restart: RestartState, now: number): GameState {
  const law = state.law;
  let deadline: number | null = null;
  if (restart.kind === "throwIn" && law.delayedThrowInCountdownSec != null) {
    deadline = now + law.delayedThrowInCountdownSec;
  } else if (restart.kind === "goalKick" && law.delayedGoalKickCountdownSec != null) {
    deadline = now + law.delayedGoalKickCountdownSec;
  }
  return {
    ...state,
    phase: "restartSetup",
    restart: { ...restart, countdownDeadline: deadline, ready: false },
    ball: { ...state.ball, vel: { x: 0, y: 0 }, height: 0, vz: 0, pos: restart.location }
  };
}

/** 준비 완료(선수·상대가 법정 위치) → restartReady. */
export function markRestartReady(state: GameState): GameState {
  if (!state.restart) return state;
  return { ...state, phase: "restartReady", restart: { ...state.restart, ready: true } };
}

/** 재개 실행(킥/스로) → 오픈플레이. 재개 주체가 마지막 터치가 된다. */
export function restartTaken(state: GameState): GameState {
  if (!state.restart) return state;
  return { ...state, phase: "openPlay", lastTouch: state.restart.team, restart: null };
}

/**
 * 지연 카운트다운 만료 처리(월드컵2026). 마감까지 인플레이가 안 되면 스로인→상대 스로인,
 * 골킥→상대 코너킥으로 넘어간다. 만료 안 됐으면 그대로.
 */
export function checkDelayedCountdown(state: GameState, now: number): GameState {
  const r = state.restart;
  if (!r || r.ready || r.countdownDeadline == null || now < r.countdownDeadline) return state;
  if (r.kind === "throwIn") {
    return beginRestart(state, { kind: "throwIn", team: other(r.team), location: r.location, ready: false }, now);
  }
  if (r.kind === "goalKick" && r.side) {
    const corner: RestartState = {
      kind: "cornerKick",
      team: other(r.team),
      location: r.location,
      side: r.side,
      ready: false
    };
    return beginRestart(state, corner, now);
  }
  return state;
}
