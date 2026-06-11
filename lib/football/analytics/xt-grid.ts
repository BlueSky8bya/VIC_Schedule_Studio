// Expected Threat lite — 공이 그 위치에 있을 때의 가치(0..1). 상대 골에 가깝고 중앙일수록 높다.
// 정밀 xT(데이터 학습 grid)의 근사. reward의 progression/frameValue에 쓴다(보고서 5.3).

import { HALF_L, HALF_W, attackingGoalSide, goalLineX } from "@/lib/football/core/pitch";
import type { TeamSide, Vec2 } from "@/lib/football/core/types";

/** team이 공격할 때 pos의 위협 가치 0..1. */
export function xtValue(pos: Vec2, team: TeamSide): number {
  const goalX = goalLineX(attackingGoalSide(team));
  // 길이축 진행도 — 상대 골라인에 가까울수록 1.
  const progress = 1 - Math.min(1, Math.abs(goalX - pos.x) / (2 * HALF_L));
  // 중앙일수록 가치↑(폭축 멀어지면 감점).
  const central = 1 - Math.min(1, Math.abs(pos.y) / HALF_W) * 0.45;
  return Math.max(0, Math.min(1, progress * progress * central));
}

/** 패스/운반으로 from→to 옮길 때 위협 증가량(음수면 후퇴). */
export function xtDelta(from: Vec2, to: Vec2, team: TeamSide): number {
  return xtValue(to, team) - xtValue(from, team);
}

/** cols×rows 격자 xT(디버그/시각화용). team0 기준. */
export function xtGrid(cols = 12, rows = 8, team: TeamSide = 0): number[][] {
  const grid: number[][] = [];
  for (let r = 0; r < rows; r += 1) {
    const row: number[] = [];
    for (let c = 0; c < cols; c += 1) {
      const x = -HALF_L + ((c + 0.5) / cols) * 2 * HALF_L;
      const y = -HALF_W + ((r + 0.5) / rows) * 2 * HALF_W;
      row.push(xtValue({ x, y }, team));
    }
    grid.push(row);
  }
  return grid;
}
