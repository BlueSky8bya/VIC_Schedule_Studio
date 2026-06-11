// 전술 프로필 + 매치업 생성(결정적). worldcup-ball-goal.tsx의 STYLES/genTeam/genPlayer를 이전.
// 실제 축구·FM 프리셋 기반 명명 전술 12종. 각 스타일이 압박/점유/템포/라인높이/폭 성향 +
// 선호 포메이션을 갖고, makeTeam이 seed 기반 지터를 더해 매 경기 색이 다르게 한다.
// 압박 인원은 press로 갈린다(렌더러 pressersOf: ≥.82=3, ≥.68=2, 그 외 1).

import type {
  FormationId,
  Matchup,
  PlayerPersona,
  PlayerTrait,
  PreferredFoot,
  Role,
  Slot,
  TeamPlan,
  TeamSide,
  WorkRate
} from "@/lib/football/core/types";
import type { Rng } from "@/lib/football/core/rng";
import { FORMATIONS } from "@/lib/football/tactics/formations";

export type TacticStyle = {
  name: string;
  desc: string; // 한 줄 설명(전술 메뉴 호버/탭 박스에 표시)
  forms: FormationId[];
  press: number;
  possession: number;
  tempo: number;
  lineHeight: number;
  width: number;
};

// prettier-ignore
export const STYLES: TacticStyle[] = [
  { name: "티키타카",   desc: "짧은 패스로 점유율 극대화, 좁게 서서 삼각형 연결.",          forms: ["4-3-3", "4-1-4-1"],            press: 0.80, possession: 0.86, tempo: 0.97, lineHeight: 0.16, width: 0.88 },
  { name: "점유 축구",  desc: "안정적 볼 점유로 상대를 끌어내 공간을 만든다.",              forms: ["4-3-3", "4-2-3-1"],            press: 0.62, possession: 0.78, tempo: 1.00, lineHeight: 0.12, width: 1.00 },
  { name: "게겐프레싱", desc: "빼앗기는 즉시 강하게 압박해 높은 곳에서 재탈취.",            forms: ["4-3-3", "4-2-3-1", "3-4-3"],   press: 0.96, possession: 0.56, tempo: 1.18, lineHeight: 0.17, width: 1.02 },
  { name: "하이프레스", desc: "상대 진영부터 강하게 압박해 실수를 유도.",                  forms: ["4-4-2", "4-3-3"],              press: 0.84, possession: 0.54, tempo: 1.10, lineHeight: 0.15, width: 1.00 },
  { name: "토탈 풋볼",  desc: "전 포지션이 자리를 바꿔가며 유동적으로 공격.",              forms: ["4-3-3", "3-4-3"],              press: 0.80, possession: 0.74, tempo: 1.14, lineHeight: 0.18, width: 1.05 },
  { name: "윙 플레이",  desc: "측면을 넓게 써 크로스로 마무리.",                          forms: ["4-4-2", "4-2-3-1", "3-4-3"],   press: 0.60, possession: 0.50, tempo: 1.06, lineHeight: 0.10, width: 1.15 },
  { name: "미드블록",   desc: "중원에 수비 블록을 세워 공간을 막고 차단.",                forms: ["4-5-1", "4-2-3-1", "4-1-4-1"], press: 0.55, possession: 0.50, tempo: 1.00, lineHeight: 0.07, width: 0.95 },
  { name: "역습 축구",  desc: "내려서 막다 빼앗으면 빠르게 역습.",                        forms: ["4-4-2", "4-5-1", "4-2-3-1"],   press: 0.50, possession: 0.34, tempo: 1.16, lineHeight: 0.05, width: 0.96 },
  { name: "롱볼 직접",  desc: "최전방으로 길게 띄워 단번에 전진.",                        forms: ["4-4-2", "5-4-1"],              press: 0.56, possession: 0.20, tempo: 1.15, lineHeight: 0.08, width: 1.10 },
  { name: "빗장 수비",  desc: "스위퍼 기반 두터운 수비로 실점 차단.",                      forms: ["5-3-2", "3-5-2"],              press: 0.44, possession: 0.40, tempo: 0.95, lineHeight: 0.02, width: 0.86 },
  { name: "텐백 수비",  desc: "전원 내려서 골문 앞을 걸어 잠근다.",                        forms: ["5-4-1", "4-5-1"],              press: 0.43, possession: 0.30, tempo: 0.93, lineHeight: 0.01, width: 0.85 },
  { name: "밸런스",     desc: "공수 균형, 무난하고 안정적인 운영.",                        forms: ["4-4-2", "4-3-3", "4-2-3-1"],   press: 0.60, possession: 0.55, tempo: 1.00, lineHeight: 0.10, width: 1.00 },
  // 감독 철학 반영 디테일 변형 8종(유저 제공). 같은 점유라도 템포/폭/라인이 갈린다.
  { name: "포지셔널 플레이",    desc: "구역을 점유하며 수적·위치 우위로 전진(과르디올라).",      forms: ["4-3-3", "3-2-4-1"],            press: 0.90, possession: 0.88, tempo: 1.05, lineHeight: 0.18, width: 1.10 },
  { name: "수직적 티키타카",    desc: "짧은 패스에 빠른 전진성을 더한다(사리볼).",              forms: ["4-3-3", "4-3-1-2"],            press: 0.85, possession: 0.82, tempo: 1.12, lineHeight: 0.15, width: 0.90 },
  { name: "플루이드 역습",      desc: "점유보다 전환 속도, 유연한 속공(레알).",                forms: ["4-2-3-1", "3-4-3", "4-3-3"],   press: 0.65, possession: 0.45, tempo: 1.20, lineHeight: 0.08, width: 1.05 },
  { name: "두 줄 수비",        desc: "4-4 두 줄을 촘촘히 세워 공간 봉쇄(시메오네).",          forms: ["4-4-2", "4-4-1-1"],            press: 0.68, possession: 0.35, tempo: 1.05, lineHeight: 0.06, width: 0.82 },
  { name: "루트 원",          desc: "극단적 다이렉트, 최단 경로로 전방 투입.",                forms: ["4-4-2", "3-5-2", "5-3-2"],     press: 0.50, possession: 0.20, tempo: 1.25, lineHeight: 0.05, width: 0.90 },
  { name: "비대칭 아이솔레이션", desc: "한쪽에 과부하 걸고 반대쪽 1대1로 고립.",                forms: ["4-2-3-1", "4-3-3"],            press: 0.70, possession: 0.60, tempo: 1.08, lineHeight: 0.12, width: 1.20 },
  { name: "가짜 9번 시스템",    desc: "9번이 내려와 수비를 끌어내고 공간 창출(제로톱).",        forms: ["4-3-3", "4-6-0"],              press: 0.82, possession: 0.75, tempo: 1.05, lineHeight: 0.14, width: 0.95 },
  { name: "실리 축구",        desc: "결과 중심, 단단히 막고 효율적으로 득점(무리뉴).",        forms: ["5-3-2", "4-2-3-1", "4-1-4-1"], press: 0.75, possession: 0.25, tempo: 0.90, lineHeight: 0.03, width: 0.80 }
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

const wrFrom = (p: number): WorkRate => (p < 0.33 ? "low" : p < 0.7 ? "medium" : "high");

// 결정적 이질 선수 생성 — 같은 seed/순서면 동일. 신체·인지·행동·특성을 역할 가중으로 뽑는다.
export function makePlayer(rng: Rng, team: TeamSide, slot: Slot): PlayerPersona {
  const role = slot.role;
  const [pa, pr, ps, sh, di] = BASE_BY_ROLE[role];
  const j = (v: number) => clampN(v + rng.range(-0.15, 0.15), 0.05, 1);
  // 신체·역학
  const footRoll = rng.next();
  const preferredFoot: PreferredFoot =
    footRoll < 0.74 ? "right" : footRoll < 0.97 ? "left" : "both";
  const weakFoot =
    preferredFoot === "both" ? rng.range(0.7, 0.95) : clampN(rng.range(0.2, 0.78), 0, 1);
  const hi = role === "DF" ? [182, 196] : role === "FW" ? [178, 192] : [172, 188];
  const heightCm = Math.round(rng.range(hi[0], hi[1]));
  const weightKg = Math.round(heightCm - 100 + rng.range(-4, 7));
  const agility = j(role === "WG" || role === "FW" ? 0.76 : role === "DF" ? 0.55 : 0.64);
  const balance = j(role === "DF" || role === "DM" ? 0.72 : 0.6);
  // 인지·심리
  const vision = j(role === "MF" || role === "DM" ? 0.8 : role === "FW" ? 0.55 : 0.5);
  const composure = j(role === "MF" || role === "FW" ? 0.7 : 0.6);
  const aggression = j(role === "DF" || role === "DM" ? 0.72 : 0.46);
  // 행동 편향
  const workRateAtk = wrFrom(
    role === "FW" || role === "WG"
      ? rng.range(0.5, 1)
      : role === "DF"
        ? rng.range(0, 0.62)
        : rng.range(0.3, 0.92)
  );
  const workRateDef = wrFrom(
    role === "DF" || role === "DM"
      ? rng.range(0.5, 1)
      : role === "FW"
        ? rng.range(0, 0.62)
        : rng.range(0.3, 0.92)
  );
  const cutInside = role === "WG" ? rng.next() : clampN(0.5 + rng.range(-0.2, 0.2), 0, 1);
  const poaching = role === "FW" ? rng.next() : clampN(0.5 + rng.range(-0.2, 0.2), 0, 1);
  const altruism = clampN((role === "MF" || role === "DM" ? 0.6 : 0.4) + rng.range(-0.3, 0.3), 0, 1);
  // 특수 특성(역할 가중·희소)
  const traits: PlayerTrait[] = [];
  if (rng.chance(0.12)) traits.push("outsideFootShot");
  if (role === "WG" && rng.chance(0.28)) traits.push("earlyCrosser");
  if ((role === "WG" || role === "MF") && cutInside > 0.6 && rng.chance(0.3)) traits.push("mezzala");
  if (role === "DF" && rng.chance(0.16)) traits.push("invertedFullback");
  if (role === "FW") traits.push(poaching > 0.55 ? "poacher" : "targetMan");
  if ((role === "MF" || role === "DM") && altruism > 0.65 && rng.chance(0.4))
    traits.push("playmaker");
  return {
    team,
    slot,
    pace: j(pa),
    press: j(pr),
    pass: j(ps),
    shoot: j(sh),
    discipline: j(di),
    preferredFoot,
    weakFoot,
    heightCm,
    weightKg,
    agility,
    balance,
    vision,
    composure,
    aggression,
    workRateAtk,
    workRateDef,
    cutInside,
    poaching,
    altruism,
    traits
  };
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
