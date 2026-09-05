// 타입 선언(tests/unit에서 scenarios.mjs를 import하기 위해). 값의 정본은 scenarios.mjs.
export type QaSeason = "spring" | "summer" | "autumn" | "winter";
export type QaScenario = {
  id: number;
  biome: string;
  season: QaSeason;
  band: string;
  weather: string;
  why: string;
  agents: string;
};
export const SEASON_MONTH: Record<QaSeason, number>;
export const DEFAULT_SEED: number;
export const ALT_SEED: number;
export const SCENARIOS: readonly QaScenario[];
export const SMOKE_IDS: readonly number[];
export function byId(id: number | string): QaScenario | undefined;
