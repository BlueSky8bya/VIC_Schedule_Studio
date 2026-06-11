// 경기 상태 — 룰 상태머신(restarts.ts)이 읽고 갱신하는 최소 상태. DOM 무관 순수 데이터.
// 시간은 sim 초(초). 좌표는 미터(pitch.ts 좌표계).

import type { BallState, MatchPhase, RestartKind, Side, TeamSide, Vec2 } from "@/lib/football/core/types";
import type { LawProfile } from "@/lib/football/core/laws";
import { DEFAULT_LAW_PROFILE } from "@/lib/football/core/laws";

export type RestartState = {
  kind: RestartKind;
  team: TeamSide; // 재개를 실행하는 팀
  location: Vec2;
  side?: Side; // 골/골라인 관련 재개일 때
  causedByOffside?: boolean;
  /** 지연 카운트다운 마감 시각(sim s). null/undefined = 미적용. 만료 시 상대에게 넘어감. */
  countdownDeadline?: number | null;
  /** 키커·동료·상대가 법정 위치를 잡아 재개 준비가 됐는가. */
  ready: boolean;
};

export type GameState = {
  time: number; // sim 초
  phase: MatchPhase;
  ball: BallState;
  lastTouch: TeamSide | null;
  score: [number, number]; // [팀0, 팀1]
  restart: RestartState | null;
  law: LawProfile;
};

export function createInitialState(law: LawProfile = DEFAULT_LAW_PROFILE): GameState {
  return {
    time: 0,
    phase: "preKickoff",
    ball: { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, height: 0, vz: 0 },
    lastTouch: null,
    score: [0, 0],
    restart: null,
    law
  };
}
