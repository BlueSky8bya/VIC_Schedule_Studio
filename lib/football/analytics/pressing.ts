// 압박/돌파 지표 — PPDA(압박 강도)·packing(패스로 제친 수비수). press reward와
// gegenpressing/high_press tacticFidelity에 쓴다(보고서 5.5.2, 5.2.1).

import { attackingGoalSide, goalLineX } from "@/lib/football/core/pitch";
import type { TeamSide, Vec2 } from "@/lib/football/core/types";

/**
 * PPDA lite — Passes Per Defensive Action. 낮을수록 강한 압박.
 * oppPasses: 상대가 자기 진영 2/3에서 한 패스 수. defActions: 그 구역서 우리 수비 액션 수.
 */
export function ppda(oppPasses: number, defActions: number): number {
  if (defActions <= 0) return oppPasses > 0 ? Infinity : 0;
  return oppPasses / defActions;
}

/**
 * Packing — from→to 패스로 제쳐진(공보다 골 쪽에 있던 → 패스 뒤 공보다 뒤가 된) 상대 수비수 수.
 * 공격 방향으로 from.x보다 앞이고 to.x보다 뒤인 상대를 '제침'으로 센다(라인 돌파 근사).
 */
export function packing(from: Vec2, to: Vec2, opponents: Vec2[], team: TeamSide): number {
  const dir = team === 0 ? 1 : -1; // 공격 방향
  const f = from.x * dir;
  const t = to.x * dir;
  if (t <= f) return 0; // 후진 패스는 0
  return opponents.filter((o) => {
    const ox = o.x * dir;
    return ox > f && ox <= t;
  }).length;
}

/**
 * 압박 강도 lite — ball carrier 주변 N미터 안 상대 수 + 접근 속도 합(보고서 5.5.2).
 * defenders: {pos, vel} 목록. carrier: 공 보유자 위치.
 */
export function pressIntensity(
  carrier: Vec2,
  defenders: { pos: Vec2; vel: Vec2 }[],
  radius = 9.15
): { count: number; approachSpeed: number } {
  let count = 0;
  let approach = 0;
  defenders.forEach((d) => {
    const dx = carrier.x - d.pos.x;
    const dy = carrier.y - d.pos.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist <= radius) {
      count += 1;
      // 공 쪽으로 향하는 속도 성분(양수만).
      approach += Math.max(0, (d.vel.x * dx + d.vel.y * dy) / dist);
    }
  });
  return { count, approachSpeed: approach };
}

/** carrier가 상대 골을 향하는지 등은 별도지만, 압박 trap 판정용 골 거리 헬퍼. */
export function distToAttackingGoal(pos: Vec2, team: TeamSide): number {
  const gx = goalLineX(attackingGoalSide(team));
  return Math.hypot(gx - pos.x, pos.y);
}
