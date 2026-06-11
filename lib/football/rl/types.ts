// RL 환경 공유 타입 — 헤드리스 env / observation / action-mask / reward가 함께 쓴다.
// DOM/물리 디테일 무관. 보고서 3장(아키텍처)·3.4(action)·3.3(observation) 기반 skeleton.

import type { Role, TeamSide, Vec2 } from "@/lib/football/core/types";

/** 에이전트 식별 — 0..N-1 인덱스. team/role은 EnvState.players[i]에서 얻는다. */
export type AgentIndex = number;

/** 고수준 행동 종류(보고서 3.4). parameterized 필드는 AgentAction에. */
export type ActionType =
  | "idle"
  | "move"
  | "support"
  | "press"
  | "cover"
  | "mark"
  | "carry"
  | "pass"
  | "shoot"
  | "clear"
  | "tackle"
  | "gkClaim"
  | "gkRelease";

export const ACTION_TYPES: ActionType[] = [
  "idle",
  "move",
  "support",
  "press",
  "cover",
  "mark",
  "carry",
  "pass",
  "shoot",
  "clear",
  "tackle",
  "gkClaim",
  "gkRelease"
];

/** 한 에이전트의 행동 — 종류 + (선택)타깃/파워/높이/스프린트. */
export type AgentAction = {
  type: ActionType;
  target?: Vec2; // move/pass/shoot 목표(미터 좌표)
  power?: number; // 0..1 킥 세기
  height?: number; // 0..1 띄움(로빙)
  sprint?: boolean;
};

/** 동시 행동 — players와 인덱스 정렬(PettingZoo Parallel). */
export type JointAction = AgentAction[];

/** 행동 마스크 — 룰상 불가능한 행동을 끈다(보고서 3.5). */
export type ActionMask = Record<ActionType, boolean>;

/** 관측용 상대 엔티티 상태(egocentric 정규화 후). */
export type EntityRelation = "self" | "teammate" | "opponent" | "ball";

export type EntityState = {
  relation: EntityRelation;
  role?: Role | "GK";
  relPos: Vec2; // 관측 주체 기준 상대 위치(공격 방향 +x)
  relVel: Vec2;
  distance: number;
};

/** 선수 1명 관측 — actor가 보는 local 정보만(보고서 3.3). */
export type PlayerObservation = {
  self: {
    index: AgentIndex;
    team: TeamSide;
    role: Role | "GK";
    pos: Vec2; // attack-centric 절대(디버그/critic용)
    vel: Vec2;
    stamina: number;
    hasBall: boolean;
  };
  ball: EntityState;
  teammates: EntityState[];
  opponents: EntityState[];
  mask: ActionMask;
};

export type StepEventKind = "goal" | "out" | "kickoff" | "turnover" | "shot" | "tackle";

export type StepEvent = {
  kind: StepEventKind;
  team?: TeamSide;
  pos: Vec2;
};
