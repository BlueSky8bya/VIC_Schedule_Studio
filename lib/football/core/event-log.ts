// 경기 이벤트 로그 — Phase 0 토대. 지금은 가벼운 기록만(골/세트피스/오프사이드 등).
// Phase 2+에서 패스 taxonomy·xG·possession value 태깅으로 확장한다. 평가·해설·디버그·리플레이의 기반.

export type MatchEventKind =
  | "kickoff"
  | "goal"
  | "save"
  | "throwIn"
  | "cornerKick"
  | "goalKick"
  | "offside"
  | "ballDrop";

export type MatchEvent = {
  t: number; // 경기 시각(ms, 렌더러 sim 시간)
  kind: MatchEventKind;
  team?: 0 | 1;
  x?: number;
  y?: number;
  detail?: string;
};

export type EventLog = {
  readonly events: MatchEvent[];
  push(e: MatchEvent): void;
  clear(): void;
};

// 메모리 무한 증가 방지(라이브 토이) — 최근 N개만 유지. RL 리플레이는 별도로 전체 저장.
const MAX = 400;

export function createEventLog(): EventLog {
  const events: MatchEvent[] = [];
  return {
    events,
    push(e) {
      events.push(e);
      if (events.length > MAX) events.splice(0, events.length - MAX);
    },
    clear() {
      events.length = 0;
    }
  };
}
