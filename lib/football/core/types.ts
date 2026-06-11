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
  | "4-5-1"
  | "3-2-4-1"
  | "4-3-1-2"
  | "4-4-1-1"
  | "4-6-0";

/** 주발/약발/워크레이트/특수특성 — 이질적(heterogeneous) 에이전트 모델링. */
export type PreferredFoot = "left" | "right" | "both";
export type WorkRate = "low" | "medium" | "high";
/** 특수 기술/역할 특성(badges) — Action Space에 옵션을 열거나 보상 편향을 준다. */
export type PlayerTrait =
  | "outsideFootShot" // 아웃사이드 스워브(약발 회피·휨궤적)
  | "earlyCrosser" // 얼리 크로서(수비 정돈 전 일찍 크로스)
  | "sweeperKeeper" // 스위퍼 키퍼(박스 밖 적극 커버)
  | "poacher" // 포처(최후방 라인 브레이킹 침투)
  | "targetMan" // 타겟맨(등지고 버티며 연계)
  | "playmaker" // 플레이메이커(이타적 키패스)
  | "invertedFullback" // 인버티드 풀백(공격 시 중앙 이동)
  | "mezzala"; // 메짤라(반 윙어, 하프스페이스 침투)

/** 선수 성향 — 같은 seed면 결정적. 런타임 상태(좌표·체력 등)는 렌더러/시뮬이 더한다.
 * (기본 5종 pace/press/pass/shoot/discipline은 렌더러 하위호환 유지. 나머지는 RL용 이질적 파라미터.) */
export type PlayerPersona = {
  team: TeamSide;
  slot: Slot;
  // ── 기본(렌더러 호환) ──
  pace: number; // 최고 속도 0..1
  press: number; // 압박 적극성 0..1
  pass: number; // 패스 정확/시야(간이) 0..1
  shoot: number; // 슛 0..1
  discipline: number; // 규율(높을수록 파울↓) 0..1
  // ── 신체·역학(물리·궤적) ──
  preferredFoot: PreferredFoot;
  weakFoot: number; // 0..1 — 낮으면 약발 패스/슛 정확도·파워 페널티↑
  heightCm: number; // 공중볼·헤더 Z 도달
  weightKg: number; // 관성(방향전환)·쉴딩 경합
  agility: number; // 0..1 — 회전반경·감속률(pace와 별개)
  balance: number; // 0..1 — 태클 후 회복 딜레이↓
  // ── 인지·심리 ──
  vision: number; // 0..1 — 넓은 FOV·먼 거리 정확 인지(낮으면 짧은패스만)
  composure: number; // 0..1 — 압박 시 결정지연·에러 억제
  aggression: number; // 0..1 — 슬라이딩 태클 임계값↓(파울/카드 위험 감수)
  // ── 행동 편향(플레이스타일) ──
  workRateAtk: WorkRate; // 공격 가담(포지션 이탈 전진)
  workRateDef: WorkRate; // 수비 가담(복귀)
  cutInside: number; // 0(클래식 윙어, hug-line 크로스) .. 1(인사이드 포워드, 중앙 침투 슛)
  poaching: number; // 0(타겟맨, 드롭딥 연계) .. 1(포처, 라인 브레이킹 침투)
  altruism: number; // 0(이기적 슈터) .. 1(플레이메이커, xA 우선 패스)
  // ── 특수 특성 ──
  traits: PlayerTrait[];
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
