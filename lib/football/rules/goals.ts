// Law 10 득점 판정 — 공 '전체'가 골라인을 넘고, 두 골포스트 사이, 크로스바 아래여야 골.
// (현 라이브 렌더러의 'goal rect 중심' 근사를 대체하는 정확한 plane-crossing 판정.)
//
// 참고: IFAB Law 10 Determining the Outcome of a Match.
//   https://www.theifab.com/laws/latest/determining-the-outcome-of-a-match/

import type { BallState, Side } from "@/lib/football/core/types";
import { HALF_L, PITCH, withinGoalMouth } from "@/lib/football/core/pitch";

/**
 * 득점이 일어난 골 사이드. 없으면 null.
 * - 공 전체가 골라인을 넘음: |x| - R > HALF_L (R=공 반지름).
 * - 포스트 사이: |y| ≤ 골폭/2.
 * - 크로스바 아래: height < 2.44m.
 */
export function goalScoredSide(ball: BallState): Side | null {
  const r = PITCH.ballRadius;
  const overBar = ball.height >= PITCH.goalHeight;
  if (overBar || !withinGoalMouth(ball.pos.y)) return null;
  if (ball.pos.x - r > HALF_L) return "right"; // 오른쪽 골라인 전체 통과
  if (-ball.pos.x - r > HALF_L) return "left"; // 왼쪽 골라인 전체 통과
  return null;
}

/** 그 골에 득점한 팀 = 그 골을 공격한 팀. 오른쪽 골 = 팀0, 왼쪽 골 = 팀1. */
export function scoringTeamForGoal(side: Side): 0 | 1 {
  return side === "right" ? 0 : 1;
}
