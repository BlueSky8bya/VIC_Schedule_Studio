// 관측 좌표 정규화 + 선수 관측 빌드(보고서 3.3.1). 절대 좌표를 그대로 넣으면 "왼쪽 공격"과
// "오른쪽 공격"이 다른 문제처럼 보인다 → attack-centric(공격은 늘 +x) + egocentric(자기 기준)으로.

import type { TeamSide, Vec2 } from "@/lib/football/core/types";
import type { EntityState, PlayerObservation } from "@/lib/football/rl/types";

/** 팀이 공격하는 방향이 항상 +x가 되도록 변환. team0은 +x 공격이라 그대로, team1은 180° 회전. */
export function toAttackCentric(p: Vec2, team: TeamSide): Vec2 {
  return team === 0 ? { x: p.x, y: p.y } : { x: -p.x, y: -p.y };
}

/** 속도도 동일 규칙(방향 벡터). */
export function velToAttackCentric(v: Vec2, team: TeamSide): Vec2 {
  return team === 0 ? { x: v.x, y: v.y } : { x: -v.x, y: -v.y };
}

/** egocentric — 관측 주체 위치를 원점으로. (입력은 이미 attack-centric이어야 함) */
export function toEgo(p: Vec2, self: Vec2): Vec2 {
  return { x: p.x - self.x, y: p.y - self.y };
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 한 엔티티를 관측 주체(self, attack-centric 좌표) 기준 상대 상태로.
 * pos/vel은 월드 좌표, team은 관측 주체 팀(공격 방향 정규화에 사용).
 */
export function relativeEntity(
  relation: EntityState["relation"],
  worldPos: Vec2,
  worldVel: Vec2,
  selfTeam: TeamSide,
  selfPosAttackCentric: Vec2,
  role?: EntityState["role"]
): EntityState {
  const ac = toAttackCentric(worldPos, selfTeam);
  const relPos = toEgo(ac, selfPosAttackCentric);
  return {
    relation,
    role,
    relPos,
    relVel: velToAttackCentric(worldVel, selfTeam),
    distance: Math.hypot(relPos.x, relPos.y)
  };
}

/** 거리순 정렬(가까운 것부터) — set encoder 전 안정적 순서가 필요하면 사용. */
export function sortByDistance(entities: EntityState[]): EntityState[] {
  return [...entities].sort((a, b) => a.distance - b.distance);
}

/** PlayerObservation의 teammates/opponents를 거리순 정렬한 사본. */
export function normalizeObservationOrder(obs: PlayerObservation): PlayerObservation {
  return {
    ...obs,
    teammates: sortByDistance(obs.teammates),
    opponents: sortByDistance(obs.opponents)
  };
}
