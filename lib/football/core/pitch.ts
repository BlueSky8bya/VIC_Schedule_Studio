// 경기장 지오메트리 — IFAB Law 1 기준 미터 좌표. 룰·전술·물리·렌더의 단일 출처.
// 좌표계: 중앙 원점. x = 길이축 [-L/2, +L/2], y = 폭축 [-W/2, +W/2]. (위가 -y, 아래가 +y)
// 팀 0 = 왼쪽 골(x=-L/2) 수비, 오른쪽(+) 공격. 팀 1 = 반대. 렌더러는 meter→px 변환만 한다.
//
// 참고: IFAB Laws of the Game, Law 1 The Field of Play.
//   https://www.theifab.com/laws/latest/the-field-of-play/

import type { Side, Vec2 } from "@/lib/football/core/types";

// 국제 경기 표준 치수(m).
export const PITCH = {
  length: 105,
  width: 68,
  centerCircleR: 9.15,
  penaltyAreaDepth: 16.5, // 골라인에서 안쪽 깊이
  penaltyAreaHalfWidth: 7.32 / 2 + 16.5, // 골포스트 안쪽에서 좌우 16.5 → 중앙 기준 반폭
  goalAreaDepth: 5.5,
  goalAreaHalfWidth: 7.32 / 2 + 5.5,
  penaltyMark: 11, // 골라인에서 거리
  penaltyArcR: 9.15,
  cornerArcR: 1,
  goalWidth: 7.32,
  goalHeight: 2.44,
  lineMaxWidth: 0.12,
  ballRadius: 0.11 // 공식구 둘레 ~70cm → 반지름 ~0.11m
} as const;

export const HALF_L = PITCH.length / 2; // 52.5
export const HALF_W = PITCH.width / 2; // 34
export const HALF_GOAL = PITCH.goalWidth / 2; // 3.66

/** 그 사이드의 골라인 x좌표. 왼쪽 = -52.5, 오른쪽 = +52.5. */
export function goalLineX(side: Side): number {
  return side === "left" ? -HALF_L : HALF_L;
}

/** 팀이 공격하는 골(상대 골)의 사이드. 팀0은 오른쪽, 팀1은 왼쪽. */
export function attackingGoalSide(team: 0 | 1): Side {
  return team === 0 ? "right" : "left";
}

/** 팀이 수비하는 골(자기 골)의 사이드. */
export function defendingGoalSide(team: 0 | 1): Side {
  return team === 0 ? "left" : "right";
}

/** y가 골문(포스트 사이) 폭 안인가. */
export function withinGoalMouth(y: number): boolean {
  return y >= -HALF_GOAL && y <= HALF_GOAL;
}

/** 점이 페널티 에어리어 안인가(해당 사이드). */
export function inPenaltyArea(p: Vec2, side: Side): boolean {
  const gx = goalLineX(side);
  const depth = PITCH.penaltyAreaDepth;
  const xIn = side === "left" ? p.x >= gx && p.x <= gx + depth : p.x <= gx && p.x >= gx - depth;
  return xIn && Math.abs(p.y) <= PITCH.penaltyAreaHalfWidth;
}

/** 점이 골 에어리어(골박스) 안인가(해당 사이드). */
export function inGoalArea(p: Vec2, side: Side): boolean {
  const gx = goalLineX(side);
  const depth = PITCH.goalAreaDepth;
  const xIn = side === "left" ? p.x >= gx && p.x <= gx + depth : p.x <= gx && p.x >= gx - depth;
  return xIn && Math.abs(p.y) <= PITCH.goalAreaHalfWidth;
}

/** 페널티 마크 좌표. */
export function penaltyMarkPos(side: Side): Vec2 {
  const gx = goalLineX(side);
  return { x: side === "left" ? gx + PITCH.penaltyMark : gx - PITCH.penaltyMark, y: 0 };
}

/** 점이 경기장(인플레이 영역) 안인가 — 라인 위/안 포함. */
export function inBounds(p: Vec2): boolean {
  return Math.abs(p.x) <= HALF_L && Math.abs(p.y) <= HALF_W;
}
