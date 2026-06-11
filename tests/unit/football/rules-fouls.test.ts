import { describe, expect, it } from "vitest";
import {
  cardFor,
  foulSeverity,
  freeKickKind,
  isFoulContact,
  numericalAdvantage,
  playAdvantage
} from "@/lib/football/rules/fouls";

describe("히트박스 파울 판정", () => {
  it("발이 공보다 몸에 먼저 닿으면 파울", () => {
    expect(
      isFoulContact({
        tacklerFoot: { x: 0, y: 0 },
        ballPos: { x: 5, y: 0 }, // 공은 멀고
        victimBody: { x: 0.4, y: 0 }, // 몸은 바로 앞
        footReach: 0.5,
        bodyRadius: 0.4
      })
    ).toBe(true);
  });
  it("공을 먼저 깨끗이 따면 파울 아님", () => {
    expect(
      isFoulContact({
        tacklerFoot: { x: 0, y: 0 },
        ballPos: { x: 0.2, y: 0 }, // 공이 발 바로 앞(먼저 닿음)
        victimBody: { x: 1.2, y: 0 }, // 몸은 멀리
        footReach: 0.3,
        bodyRadius: 0.4
      })
    ).toBe(false);
  });
});

describe("파울 강도 + 카드", () => {
  it("고속·고공격성·저규율·백태클 = seriousFoulPlay(레드)", () => {
    const sev = foulSeverity({
      aggression: 1,
      discipline: 0.1,
      approachSpeed: 1,
      fromBehind: true,
      rng: 0.1
    });
    expect(sev).toBe("seriousFoulPlay");
    expect(cardFor({ severity: sev, existingYellows: 0 })).toEqual({ card: "red", sentOff: true });
  });
  it("reckless = 옐로, 2번째 옐로면 레드", () => {
    expect(cardFor({ severity: "reckless", existingYellows: 0 })).toEqual({
      card: "yellow",
      sentOff: false
    });
    expect(cardFor({ severity: "reckless", existingYellows: 1 })).toEqual({
      card: "red",
      sentOff: true
    });
  });
  it("careless는 무카드", () => {
    expect(cardFor({ severity: "careless", existingYellows: 0 })).toEqual({
      card: "none",
      sentOff: false
    });
  });
  it("DOGSO(결정적 기회 저지) + reckless면 명백 레드", () => {
    expect(
      cardFor({ severity: "reckless", deniedGoalChance: true, existingYellows: 0 })
    ).toEqual({ card: "red", sentOff: true });
  });
});

describe("어드밴티지 / 재개 / 수적우위", () => {
  it("공 유지 + 공격 진영이면 어드밴티지(속행)", () => {
    expect(
      playAdvantage({ fouledTeamRetainsBall: true, inAttackingThird: true, clearChanceAhead: false })
    ).toBe(true);
    expect(
      playAdvantage({ fouledTeamRetainsBall: false, inAttackingThird: true, clearChanceAhead: true })
    ).toBe(false);
  });
  it("박스 안 수비 반칙 = 페널티킥, 밖 = 직접 프리킥, 백패스류 = 간접", () => {
    expect(freeKickKind({ foulInOwnPenaltyArea: true })).toBe("penaltyKick");
    expect(freeKickKind({ foulInOwnPenaltyArea: false })).toBe("directFreeKick");
    expect(freeKickKind({ foulInOwnPenaltyArea: true, indirectOnly: true })).toBe(
      "indirectFreeKick"
    );
  });
  it("수적 우위 부호: 상대가 더 퇴장당하면 +", () => {
    expect(numericalAdvantage([0, 1], 0)).toBe(1); // 팀1이 1명 퇴장 → 팀0 우위
    expect(numericalAdvantage([1, 0], 0)).toBe(-1);
  });
});
