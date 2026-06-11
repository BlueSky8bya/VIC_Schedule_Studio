// 경기 법규 프로필 — 시즌/대회별 룰 변형을 한곳에서 켠다. 룰 엔진은 하드코딩 대신 이걸 본다.
// 기준일 2026-06-11 KST. IFAB 2026/27 일반 효력은 2026-07-01이나, 2026 월드컵·일부 대회는 조기
// 적용 가능 → competitionProfile + feature flag로 분기.
//
// 참고: IFAB 2026/27 law changes, "measures to improve match flow and player behaviour".
//   https://www.theifab.com/law-changes/latest/

export type LawProfile = {
  season: "IFAB_2025_26" | "IFAB_2026_27";
  worldCup2026EarlyAdoption: boolean;
  /** 골키퍼 손/팔 보유 제한(초). 초과 시 상대 코너킥. */
  goalkeeperHandControlLimitSec: number;
  /** 지연 스로인 visual 카운트다운(초). null이면 미적용. 만료 시 상대 스로인. */
  delayedThrowInCountdownSec: number | null;
  /** 지연 골킥 카운트다운(초). 만료 시 상대 코너킥. */
  delayedGoalKickCountdownSec: number | null;
};

export const IFAB_2025_26: LawProfile = {
  season: "IFAB_2025_26",
  worldCup2026EarlyAdoption: false,
  goalkeeperHandControlLimitSec: 6, // 2025/26: 전통적 6초
  delayedThrowInCountdownSec: null,
  delayedGoalKickCountdownSec: null
};

// 2026 월드컵 프로필 — 매치플로우 변경 조기 적용.
export const FIFA_WORLD_CUP_2026: LawProfile = {
  season: "IFAB_2026_27",
  worldCup2026EarlyAdoption: true,
  goalkeeperHandControlLimitSec: 8, // GK 8초 초과 → 상대 코너킥
  delayedThrowInCountdownSec: 5,
  delayedGoalKickCountdownSec: 5
};

export const DEFAULT_LAW_PROFILE = FIFA_WORLD_CUP_2026;
