import { describe, expect, it } from "vitest";
import { FIFA_WORLD_CUP_2026, IFAB_2025_26 } from "@/lib/football/core/laws";
import {
  backPassViolation,
  goalkeeperViolation,
  handHoldExceeded,
  violationAwardTeam,
  type GoalkeeperPossession
} from "@/lib/football/rules/goalkeeper";

const hands = (since: number): GoalkeeperPossession => ({ kind: "hands", since });

describe("GK 손 보유 시간 제한", () => {
  it("월드컵2026 = 8초 초과 시 위반", () => {
    expect(handHoldExceeded(hands(0), 7.9, FIFA_WORLD_CUP_2026)).toBe(false);
    expect(handHoldExceeded(hands(0), 8, FIFA_WORLD_CUP_2026)).toBe(true);
  });
  it("2025/26 = 6초", () => {
    expect(handHoldExceeded(hands(0), 6, IFAB_2025_26)).toBe(true);
    expect(handHoldExceeded(hands(0), 5.9, IFAB_2025_26)).toBe(false);
  });
  it("손 보유 아니면 위반 아님", () => {
    expect(handHoldExceeded({ kind: "none" }, 100, FIFA_WORLD_CUP_2026)).toBe(false);
    expect(handHoldExceeded({ kind: "feet", since: 0 }, 100, FIFA_WORLD_CUP_2026)).toBe(false);
  });
});

describe("백패스/스로인 핸들", () => {
  it("동료 고의 발 패스를 손으로 → 위반", () => {
    expect(backPassViolation({ kind: "deliberateFoot" }, true)).toBe(true);
  });
  it("동료 스로인을 손으로 → 위반", () => {
    expect(backPassViolation({ kind: "throwIn" }, true)).toBe(true);
  });
  it("머리/가슴·굴절은 위반 아님", () => {
    expect(backPassViolation({ kind: "deliberateHeadOrChest" }, true)).toBe(false);
    expect(backPassViolation({ kind: "deflection" }, true)).toBe(false);
  });
  it("손 안 쓰면 위반 아님", () => {
    expect(backPassViolation({ kind: "deliberateFoot" }, false)).toBe(false);
  });
});

describe("GK 위반 종합", () => {
  it("백패스 핸들 → 간접 FK(우선)", () => {
    const v = goalkeeperViolation(hands(0), { kind: "deliberateFoot" }, true, 1, FIFA_WORLD_CUP_2026);
    expect(v).toEqual({ kind: "illegalHandle", restart: "indirectFreeKick" });
  });
  it("8초 초과 → 상대 코너킥", () => {
    const v = goalkeeperViolation(hands(0), { kind: "none" }, true, 9, FIFA_WORLD_CUP_2026);
    expect(v).toEqual({ kind: "handHoldTooLong", restart: "cornerKick" });
  });
  it("정상이면 위반 없음", () => {
    const v = goalkeeperViolation(hands(0), { kind: "deflection" }, true, 3, FIFA_WORLD_CUP_2026);
    expect(v.kind).toBe("none");
  });
  it("재개는 GK 상대팀이 가져감", () => {
    expect(violationAwardTeam(0)).toBe(1);
    expect(violationAwardTeam(1)).toBe(0);
  });
});
