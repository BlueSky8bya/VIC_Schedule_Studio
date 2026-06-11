// 전술 프로필 + 매치업 생성(결정적). worldcup-ball-goal.tsx의 STYLES/genTeam/genPlayer를 이전.
// 실제 축구·FM 프리셋 기반 명명 전술 12종. 각 스타일이 압박/점유/템포/라인높이/폭 성향 +
// 선호 포메이션을 갖고, makeTeam이 seed 기반 지터를 더해 매 경기 색이 다르게 한다.
// 압박 인원은 press로 갈린다(렌더러 pressersOf: ≥.82=3, ≥.68=2, 그 외 1).

import type { FormationId, Matchup, PlayerPersona, Role, Slot, TeamPlan, TeamSide } from "@/lib/football/core/types";
import type { Rng } from "@/lib/football/core/rng";
import { FORMATIONS } from "@/lib/football/tactics/formations";

export type TacticStyle = {
  name: string;
  forms: FormationId[];
  press: number;
  possession: number;
  tempo: number;
  lineHeight: number;
  width: number;
};

// prettier-ignore
export const STYLES: TacticStyle[] = [
  { name: "티키타카",   forms: ["4-3-3", "4-1-4-1"],            press: 0.80, possession: 0.86, tempo: 0.97, lineHeight: 0.16, width: 0.88 },
  { name: "점유 축구",  forms: ["4-3-3", "4-2-3-1"],            press: 0.62, possession: 0.78, tempo: 1.00, lineHeight: 0.12, width: 1.00 },
  { name: "게겐프레싱", forms: ["4-3-3", "4-2-3-1", "3-4-3"],   press: 0.96, possession: 0.56, tempo: 1.18, lineHeight: 0.17, width: 1.02 },
  { name: "하이프레스", forms: ["4-4-2", "4-3-3"],              press: 0.84, possession: 0.54, tempo: 1.10, lineHeight: 0.15, width: 1.00 },
  { name: "토탈 풋볼",  forms: ["4-3-3", "3-4-3"],              press: 0.80, possession: 0.74, tempo: 1.14, lineHeight: 0.18, width: 1.05 },
  { name: "윙 플레이",  forms: ["4-4-2", "4-2-3-1", "3-4-3"],   press: 0.60, possession: 0.50, tempo: 1.06, lineHeight: 0.10, width: 1.15 },
  { name: "미드블록",   forms: ["4-5-1", "4-2-3-1", "4-1-4-1"], press: 0.55, possession: 0.50, tempo: 1.00, lineHeight: 0.07, width: 0.95 },
  { name: "역습 축구",  forms: ["4-4-2", "4-5-1", "4-2-3-1"],   press: 0.50, possession: 0.34, tempo: 1.16, lineHeight: 0.05, width: 0.96 },
  { name: "롱볼 직접",  forms: ["4-4-2", "5-4-1"],              press: 0.56, possession: 0.20, tempo: 1.15, lineHeight: 0.08, width: 1.10 },
  { name: "빗장 수비",  forms: ["5-3-2", "3-5-2"],              press: 0.44, possession: 0.40, tempo: 0.95, lineHeight: 0.02, width: 0.86 },
  { name: "텐백 수비",  forms: ["5-4-1", "4-5-1"],              press: 0.43, possession: 0.30, tempo: 0.93, lineHeight: 0.01, width: 0.85 },
  { name: "밸런스",     forms: ["4-4-2", "4-3-3", "4-2-3-1"],   press: 0.60, possession: 0.55, tempo: 1.00, lineHeight: 0.10, width: 1.00 }
];

const clampN = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function makeTeam(rng: Rng): TeamPlan {
  const s = rng.pick(STYLES);
  const formation = rng.pick(s.forms);
  return {
    name: s.name,
    formation,
    slots: FORMATIONS[formation],
    lineHeight: clampN(s.lineHeight + rng.range(-0.03, 0.03), 0, 0.22),
    press: clampN(s.press + rng.range(-0.06, 0.06), 0.4, 1),
    tempo: clampN(s.tempo + rng.range(-0.05, 0.05), 0.9, 1.22),
    possession: clampN(s.possession + rng.range(-0.06, 0.06), 0.15, 0.9),
    width: clampN(s.width + rng.range(-0.05, 0.05), 0.82, 1.18)
  };
}

// 역할별 성격 기준치 [pace, press, pass, shoot, discipline] ±지터.
const BASE_BY_ROLE: Record<Role, [number, number, number, number, number]> = {
  DF: [0.55, 0.45, 0.55, 0.15, 0.85],
  DM: [0.6, 0.65, 0.78, 0.3, 0.8],
  MF: [0.68, 0.6, 0.82, 0.45, 0.6],
  WG: [0.9, 0.6, 0.6, 0.62, 0.4],
  FW: [0.85, 0.55, 0.55, 0.85, 0.4]
};

export function makePlayer(rng: Rng, team: TeamSide, slot: Slot): PlayerPersona {
  const [pa, pr, ps, sh, di] = BASE_BY_ROLE[slot.role];
  const j = (v: number) => Math.max(0.05, Math.min(1, v + rng.range(-0.15, 0.15)));
  return { team, slot, pace: j(pa), press: j(pr), pass: j(ps), shoot: j(sh), discipline: j(di) };
}

// 한 경기 매치업 — 두 팀은 서로 다른 전술 스타일로(같으면 재추첨). 선수는 팀0 10명 → 팀1 10명 순.
export function makeMatchup(rng: Rng): Matchup {
  const ta = makeTeam(rng);
  let tb = makeTeam(rng);
  let guard = 0;
  while (tb.name === ta.name && guard < 8) {
    tb = makeTeam(rng);
    guard += 1;
  }
  const personas: PlayerPersona[] = [];
  ([0, 1] as const).forEach((team) => {
    const t = team === 0 ? ta : tb;
    t.slots.forEach((slot) => personas.push(makePlayer(rng, team, slot)));
  });
  return { seed: rng.seed, teams: [ta, tb], personas };
}
