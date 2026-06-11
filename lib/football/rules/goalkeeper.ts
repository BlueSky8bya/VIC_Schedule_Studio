// 골키퍼 특수 규칙(Law 12) — 손 보유 시간 제한, 백패스 핸들, 스로인 직접 수령.
// 위반 시 재개 종류를 돌려준다(상위 룰엔진이 RestartState로 변환).
//
// 참고: IFAB Law 12 Fouls and Misconduct(골키퍼), Law 16 골킥.

import type { TeamSide } from "@/lib/football/core/types";
import type { LawProfile } from "@/lib/football/core/laws";

export type GoalkeeperPossession =
  | { kind: "none" }
  | { kind: "feet"; since: number } // 발밑 보유 시작 시각(sim s)
  | { kind: "hands"; since: number }; // 손 보유 시작 시각

/** 손으로 잡은 지 제한(법규별 6 or 8초)을 넘겼는가 → 넘기면 상대 코너킥. */
export function handHoldExceeded(poss: GoalkeeperPossession, now: number, law: LawProfile): boolean {
  if (poss.kind !== "hands") return false;
  return now - poss.since >= law.goalkeeperHandControlLimitSec;
}

/** 마지막 동료 터치 종류 — 백패스 판정에 필요. */
export type LastTeammateTouch =
  | { kind: "none" }
  | { kind: "deliberateFoot" } // 동료가 고의로 발로 보냄 → GK 손 잡으면 위반
  | { kind: "throwIn" } // 동료 스로인 직접 → GK 손 잡으면 위반
  | { kind: "deliberateHeadOrChest" } // 머리/가슴 등 → 위반 아님
  | { kind: "deflection" }; // 굴절/실수 → 위반 아님

/**
 * GK가 손을 쓰는 순간의 위반 판정.
 * - 동료의 '고의 발 패스' 또는 '스로인'을 손으로 잡으면 간접 프리킥.
 * - 그 외(머리/가슴/굴절)는 위반 아님.
 */
export function backPassViolation(lastTeammate: LastTeammateTouch, gkUsedHands: boolean): boolean {
  if (!gkUsedHands) return false;
  return lastTeammate.kind === "deliberateFoot" || lastTeammate.kind === "throwIn";
}

export type GoalkeeperViolation =
  | { kind: "none" }
  | { kind: "handHoldTooLong"; restart: "cornerKick" } // 상대 코너킥
  | { kind: "illegalHandle"; restart: "indirectFreeKick" }; // 백패스/스로인 핸들 → 간접 FK

/** GK 위반 종합 판정. 위반 팀(=GK 팀)의 상대에게 재개가 주어진다(상위에서 처리). */
export function goalkeeperViolation(
  poss: GoalkeeperPossession,
  lastTeammate: LastTeammateTouch,
  gkUsedHands: boolean,
  now: number,
  law: LawProfile
): GoalkeeperViolation {
  if (backPassViolation(lastTeammate, gkUsedHands)) {
    return { kind: "illegalHandle", restart: "indirectFreeKick" };
  }
  if (handHoldExceeded(poss, now, law)) {
    return { kind: "handHoldTooLong", restart: "cornerKick" };
  }
  return { kind: "none" };
}

/** GK 위반으로 재개를 가져가는 팀(= GK 팀의 상대). */
export function violationAwardTeam(gkTeam: TeamSide): TeamSide {
  return gkTeam === 0 ? 1 : 0;
}
