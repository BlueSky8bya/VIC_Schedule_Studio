// xG lite — 슛 위치의 득점 기대값(0..1). 골과의 거리 + 슈팅 각도(두 포스트가 벌어진 각)로.
// 정밀 xG 모델의 기하 근사. chanceQuality reward에 쓴다.

import { HALF_GOAL, attackingGoalSide, goalLineX } from "@/lib/football/core/pitch";
import type { TeamSide, Vec2 } from "@/lib/football/core/types";

/** team이 pos에서 슛할 때 xG 0..1. */
export function xgFromShot(pos: Vec2, team: TeamSide): number {
  const goalX = goalLineX(attackingGoalSide(team));
  const dx = goalX - pos.x;
  const dy = pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.1) return 0.95;

  // 슈팅 각도 — 두 포스트(y = ±HALF_GOAL)를 보는 사잇각. 넓을수록 좋음.
  const a1 = Math.atan2(HALF_GOAL - dy, Math.abs(dx));
  const a2 = Math.atan2(-HALF_GOAL - dy, Math.abs(dx));
  const angle = Math.abs(a1 - a2); // rad

  // 거리 감쇠 + 각도 보정. 11m(페널티) 정면 ≈ 0.75 근방.
  const distFactor = Math.exp(-dist / 11);
  const angleFactor = Math.min(1, angle / 0.7);
  return Math.max(0, Math.min(1, distFactor * angleFactor));
}
