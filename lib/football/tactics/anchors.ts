// Dynamic anchoring(보고서 4.4) — 동네축구 방지 핵심. 포메이션은 고정 좌표가 아니라 공 위치·페이즈·
// 전술(라인높이/폭)에 따라 팀 전체가 그물망처럼 이동하는 target field. 각 선수의 '있어야 할 자리'를
// 계산한다. 순수 함수(미터 좌표). scripted policy와 (선택)렌더러가 이 타깃으로 선수를 끌어당긴다.

import { HALF_L, HALF_W } from "@/lib/football/core/pitch";
import type { Role, Slot, TeamSide, Vec2 } from "@/lib/football/core/types";

/** anchoring에 필요한 전술 성향(TeamPlan/TacticStyle의 부분집합). */
export type AnchorTactic = {
  lineHeight: number; // 0(깊음)..0.22(하이라인)
  width: number; // 0.85(좁게)..1.15(넓게)
};

export type Phase = "attack" | "defend" | "transition";

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** 슬롯(bx 0=자기골..1=상대골, by 0=위..1=아래)을 미터 좌표로. 골라인엔 안 앉게 약간 인셋. */
export function slotToMeters(slot: Slot, team: TeamSide): Vec2 {
  const own = -HALF_L * 0.9; // 자기 골 쪽
  const opp = HALF_L * 0.82; // 상대 골 쪽
  const x0 = own + slot.bx * (opp - own); // team0 기준(왼쪽 자기골 → +x 공격)
  const x = team === 0 ? x0 : -x0; // team1은 미러
  const y = -HALF_W * 0.9 + slot.by * (HALF_W * 1.8);
  return { x, y };
}

/** 공격 방향 부호(team0 = +x). */
export function attackDir(team: TeamSide): 1 | -1 {
  return team === 0 ? 1 : -1;
}

// 역할별 ball-shift 자유도 — 수비/피벗은 형태 고수(낮게), 공격/윙은 공/공간 반응(높게).
const SHIFT_BY_ROLE: Record<Role, number> = {
  DF: 0.85,
  DM: 0.9,
  MF: 1.0,
  WG: 1.15,
  FW: 1.2
};

/**
 * 한 선수의 dynamic anchor — 슬롯 기본 + 라인높이 푸시 + 폭 스케일 + 공쪽 제한 쏠림.
 * phase: attack(전진/벌림), defend(드롭/공쪽 컴팩트), transition(중간).
 */
export function computePlayerAnchor(
  slot: Slot,
  team: TeamSide,
  ball: Vec2,
  tactic: AnchorTactic,
  phase: Phase
): Vec2 {
  return anchorFromBase(slotToMeters(slot, team), slot.role, team, ball, tactic, phase);
}

/**
 * 임의의 base 좌표(예: 리셋 포지션) 기준 dynamic anchor — 라인높이 푸시 + 폭 + 공쪽 제한 쏠림.
 * 슬롯 없이 헤드리스 scripted policy가 쓸 수 있게 분리.
 */
export function anchorFromBase(
  base: Vec2,
  role: Role,
  team: TeamSide,
  ball: Vec2,
  tactic: AnchorTactic,
  phase: Phase
): Vec2 {
  const dir = attackDir(team);
  const pushScale = phase === "attack" ? 1 : phase === "transition" ? 0.55 : 0.15;
  let x = base.x + dir * tactic.lineHeight * HALF_L * pushScale;
  let y = base.y * tactic.width;

  const roleShift = SHIFT_BY_ROLE[role];
  const infl = (phase === "defend" ? 0.2 : phase === "transition" ? 0.15 : 0.1) * roleShift;
  const maxX = (phase === "defend" ? 16 : 12) * roleShift;
  const maxY = 18 * roleShift;
  x += clamp((ball.x - x) * infl, -maxX, maxX);
  y += clamp((ball.y - y) * infl, -maxY, maxY);

  return { x: clamp(x, -HALF_L, HALF_L), y: clamp(y, -HALF_W, HALF_W) };
}

/** 팀 전체 anchor(필드 슬롯 순서). */
export function computeTeamAnchors(
  slots: Slot[],
  team: TeamSide,
  ball: Vec2,
  tactic: AnchorTactic,
  phase: Phase
): Vec2[] {
  return slots.map((s) => computePlayerAnchor(s, team, ball, tactic, phase));
}

/** 팀 형태 target — shape reward용 X_target(라인높이)·W_target(폭). 보고서 5.5.1. */
export function shapeTargets(
  team: TeamSide,
  tactic: AnchorTactic,
  phase: Phase
): { xTarget: number; widthTarget: number } {
  const dir = attackDir(team);
  const pushScale = phase === "attack" ? 1 : phase === "transition" ? 0.55 : 0.15;
  return {
    xTarget: dir * tactic.lineHeight * HALF_L * pushScale,
    widthTarget: HALF_W * tactic.width
  };
}
