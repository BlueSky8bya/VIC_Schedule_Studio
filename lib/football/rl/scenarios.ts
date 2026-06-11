// Football Academy식 시나리오(보고서 6장 커리큘럼). MVP는 3v2/4v2/5v5부터(14.1).
// teamSizes = 필드 인원(키퍼 포함 여부는 withKeepers). 좌표는 미터(pitch.ts), team0 왼쪽 수비.

import { HALF_L } from "@/lib/football/core/pitch";
import type { Vec2 } from "@/lib/football/core/types";

export type ScenarioId =
  | "1v0"
  | "1v1_keeper"
  | "2v1"
  | "3v2"
  | "4v2_rondo"
  | "5v5"
  | "11v11";

export type ScenarioSpec = {
  id: ScenarioId;
  teamSizes: [number, number]; // [team0 필드인원, team1 필드인원]
  withKeepers: boolean;
  durationSec: number;
  ballStart: Vec2;
  /** 시나리오 성공 판정 종류(헤드리스 평가용). */
  successKind: "score" | "retainPossession" | "regain" | "reachFinalThird";
  description: string;
};

// prettier-ignore
export const SCENARIOS: Record<ScenarioId, ScenarioSpec> = {
  "1v0":        { id: "1v0",        teamSizes: [1, 0],  withKeepers: false, durationSec: 15, ballStart: { x: 0, y: 0 },             successKind: "score",            description: "빈 골 마무리 — 드리블 후 슛" },
  "1v1_keeper": { id: "1v1_keeper", teamSizes: [1, 0],  withKeepers: true,  durationSec: 15, ballStart: { x: HALF_L * 0.3, y: 0 },  successKind: "score",            description: "키퍼와 1대1" },
  "2v1":        { id: "2v1",        teamSizes: [2, 1],  withKeepers: false, durationSec: 20, ballStart: { x: 0, y: 0 },             successKind: "score",            description: "2대1 — 패스 또는 슛 결정" },
  "3v2":        { id: "3v2",        teamSizes: [3, 2],  withKeepers: false, durationSec: 25, ballStart: { x: -HALF_L * 0.2, y: 0 }, successKind: "reachFinalThird",  description: "3대2 속공" },
  "4v2_rondo":  { id: "4v2_rondo",  teamSizes: [4, 2],  withKeepers: false, durationSec: 30, ballStart: { x: 0, y: 0 },             successKind: "retainPossession", description: "4대2 론도 — 점유 유지" },
  "5v5":        { id: "5v5",        teamSizes: [5, 5],  withKeepers: true,  durationSec: 60, ballStart: { x: 0, y: 0 },             successKind: "score",            description: "5대5 — 압박/역습 부분 전술" },
  "11v11":      { id: "11v11",      teamSizes: [11, 11], withKeepers: true, durationSec: 300, ballStart: { x: 0, y: 0 },            successKind: "score",            description: "풀 11대11(압축 경기)" }
};

export const MVP_SCENARIOS: ScenarioId[] = ["2v1", "3v2", "4v2_rondo", "5v5"];
