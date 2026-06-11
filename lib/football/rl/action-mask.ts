// 행동 마스크(보고서 3.5) — 룰상 불가능한 행동을 reward 페널티가 아니라 mask로 끈다.
// 단, "위험한 선택"(오프사이드 위치로 패스 등)은 막지 않는다. 실제 축구처럼 위험을 고를 수 있어야.

import { ACTION_TYPES, type ActionMask, type ActionType } from "@/lib/football/rl/types";

export type ActionMaskInput = {
  hasBall: boolean;
  isGoalkeeper: boolean;
  inOwnPenaltyArea: boolean;
  isRestartTaker: boolean; // 세트피스 차는 본인
  inRestartSetup: boolean; // 세트피스 준비 중(공 아직 인플레이 전)
  sentOff: boolean; // 퇴장 — 행동 없음
};

const ALL_OFF = (): ActionMask =>
  ACTION_TYPES.reduce((m, a) => {
    m[a] = false;
    return m;
  }, {} as ActionMask);

/** 상황별 가능한 행동만 true. */
export function computeActionMask(input: ActionMaskInput): ActionMask {
  const mask = ALL_OFF();
  mask.idle = true;

  // 퇴장 — idle만.
  if (input.sentOff) return mask;

  // 세트피스 준비 중: 차는 본인은 배급(pass/shoot/carry), 나머지는 자리잡기(move/support)만.
  if (input.inRestartSetup) {
    if (input.isRestartTaker) {
      mask.pass = true;
      mask.shoot = true;
      mask.carry = true;
      mask.clear = true;
    } else {
      mask.move = true;
      mask.support = true;
    }
    return mask;
  }

  // 오픈플레이 — 이동/수비 행동은 항상 가능.
  mask.move = true;
  mask.support = true;
  mask.press = true;
  mask.cover = true;
  mask.mark = true;
  mask.tackle = true;

  // 공 보유 시에만 온볼 행동.
  if (input.hasBall) {
    mask.carry = true;
    mask.pass = true;
    mask.shoot = true;
    mask.clear = true;
  }

  // 골키퍼 손 사용은 자기 페널티 박스 안에서만(Law 12).
  if (input.isGoalkeeper && input.inOwnPenaltyArea) {
    mask.gkClaim = true;
    mask.gkRelease = input.hasBall;
  }

  return mask;
}

/** 마스크에서 허용된 행동 목록. */
export function allowedActions(mask: ActionMask): ActionType[] {
  return ACTION_TYPES.filter((a) => mask[a]);
}
