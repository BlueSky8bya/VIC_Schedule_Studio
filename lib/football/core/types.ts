// 축구 엔진 순수 타입 — DOM/React/CSS 무관. 룰·전술·물리·RL이 공유하는 단일 출처.
// (Phase 0: 생성/전술 타입만. Phase 1+에서 룰 상태머신·이벤트·관측 타입이 더해진다.)

export type Vec2 = { x: number; y: number };

/** 공 상태(미터). height=지면 위 높이(공중볼), vz=수직속도. */
export type BallState = {
  pos: Vec2;
  vel: Vec2;
  height: number;
  vz: number;
};

/** 좌/우 골(골대·골라인 식별) */
export type Side = "left" | "right";

/** 팀 인덱스. 0 = 레드(좌측 골 수비), 1 = 블루(우측 골 수비). */
export type TeamSide = 0 | 1;

/** 역할: 수비/수비형MF/중앙MF/윙/공격 */
export type Role = "DF" | "DM" | "MF" | "WG" | "FW";

/** 포메이션 슬롯 — bx(자기 골 0 .. 상대 골 1), by(위 0 .. 아래 1) 정규화 좌표 + 역할 */
export type Slot = { bx: number; by: number; role: Role };

export type FormationId =
  | "4-3-3"
  | "4-4-2"
  | "3-5-2"
  | "4-2-3-1"
  | "4-1-4-1"
  | "3-4-3"
  | "5-3-2"
  | "5-4-1"
  | "4-5-1";

/** 선수 성향(0..1) — 같은 seed면 결정적으로 생성된다. 런타임 상태(좌표·체력 등)는 렌더러가 더한다. */
export type PlayerPersona = {
  team: TeamSide;
  slot: Slot;
  pace: number;
  press: number;
  pass: number;
  shoot: number;
  discipline: number;
};

/** 팀 전술 계획 — 명명 전술 + 포메이션 + 수치 성향. */
export type TeamPlan = {
  name: string;
  formation: FormationId;
  slots: Slot[];
  lineHeight: number; // 0(깊음) .. 0.22(하이라인)
  press: number; // 0.4 .. 1
  tempo: number; // 0.9 .. 1.22
  possession: number; // 1=짧은 점유 .. 0=직접(롱볼)
  width: number; // 0.85(좁게) .. 1.15(넓게)
};

/** 한 경기 매치업 — 두 팀 계획 + 20명 성향(팀0 10명 → 팀1 10명 순서). */
export type Matchup = {
  seed: number;
  teams: [TeamPlan, TeamPlan];
  personas: PlayerPersona[];
};

/** 경기 페이즈 — 룰 상태머신(Phase 1c)이 쓴다. */
export type MatchPhase =
  | "preKickoff"
  | "openPlay"
  | "stoppage"
  | "restartSetup"
  | "restartReady"
  | "goalScored"
  | "halfTime"
  | "fullTime";

/** 재개 종류(Law 8·13~17). */
export type RestartKind =
  | "kickoff"
  | "throwIn"
  | "goalKick"
  | "cornerKick"
  | "directFreeKick"
  | "indirectFreeKick"
  | "penaltyKick"
  | "droppedBall"
  | "offsideIndirectFreeKick";
