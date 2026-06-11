// Law 9 인/아웃 — 공 '전체'가 터치라인/골라인을 넘어야 아웃(라인 위에 조금이라도 걸치면 인플레이).
// 골라인 아웃은 마지막 터치 팀에 따라 코너킥(수비팀 터치) 또는 골킥(공격팀 터치)으로 갈린다.
//
// 참고: IFAB Law 9 The Ball in and out of Play, Law 16 골킥, Law 17 코너킥.

import type { BallState, RestartKind, Side, TeamSide, Vec2 } from "@/lib/football/core/types";
import { HALF_L, HALF_W, PITCH, goalLineX } from "@/lib/football/core/pitch";
import { goalScoredSide } from "@/lib/football/rules/goals";

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export type OutResult =
  | { out: false }
  | {
      out: true;
      restart: Extract<RestartKind, "throwIn" | "goalKick" | "cornerKick">;
      awardTeam: TeamSide; // 재개를 가져가는 팀
      location: Vec2;
      side?: Side; // 골라인 아웃일 때 그 골
      where?: "top" | "bottom"; // 터치라인 아웃일 때
    };

/** 골킥 공 위치 — 그 골의 골 에어리어 안(중앙). */
export function goalKickSpot(side: Side): Vec2 {
  const gx = goalLineX(side);
  const d = PITCH.goalAreaDepth * 0.6;
  return { x: side === "left" ? gx + d : gx - d, y: 0 };
}

/**
 * 공이 아웃인지 + 어떤 재개인지. 골이면 아웃 아님(goals.ts가 별도 처리).
 * lastTouch: 공을 마지막으로 건드린 팀(null = 중립/불명).
 */
export function ballOut(ball: BallState, lastTouch: TeamSide | null): OutResult {
  const r = PITCH.ballRadius;
  if (goalScoredSide(ball)) return { out: false }; // 골은 아웃 아님

  // 터치라인(위/아래) — 스로인. 마지막 터치 반대팀.
  if (Math.abs(ball.pos.y) - r > HALF_W) {
    const where: "top" | "bottom" = ball.pos.y < 0 ? "top" : "bottom";
    const award: TeamSide = lastTouch === 0 ? 1 : 0;
    return {
      out: true,
      restart: "throwIn",
      awardTeam: award,
      where,
      location: { x: clamp(ball.pos.x, -HALF_L, HALF_L), y: where === "top" ? -HALF_W : HALF_W }
    };
  }

  // 골라인(좌/우)
  if (Math.abs(ball.pos.x) - r > HALF_L) {
    const side: Side = ball.pos.x < 0 ? "left" : "right";
    const defendTeam: TeamSide = side === "left" ? 0 : 1;
    const attackTeam: TeamSide = defendTeam === 0 ? 1 : 0;
    if (lastTouch === defendTeam) {
      // 수비팀이 마지막 터치 → 코너킥(공격팀), 공 나간 쪽 코너.
      return {
        out: true,
        restart: "cornerKick",
        awardTeam: attackTeam,
        side,
        location: { x: goalLineX(side), y: ball.pos.y < 0 ? -HALF_W : HALF_W }
      };
    }
    // 공격팀(또는 불명) 마지막 터치 → 골킥(수비팀).
    return { out: true, restart: "goalKick", awardTeam: defendTeam, side, location: goalKickSpot(side) };
  }

  return { out: false };
}
