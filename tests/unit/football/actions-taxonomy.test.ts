import { describe, expect, it } from "vitest";
import {
  BEAT_MAN_SKILLS,
  GK_HAND_ACTIONS,
  LOFTED_PASSES,
  PROGRESSIVE_PASSES,
  inZone14,
  isHalfSpace,
  widthChannel
} from "@/lib/football/core/actions";
import { HALF_L, HALF_W } from "@/lib/football/core/pitch";

describe("공간 채널 / 하프스페이스", () => {
  it("폭 5등분 채널", () => {
    expect(widthChannel(-HALF_W, HALF_W)).toBe(0); // 맨 위
    expect(widthChannel(0, HALF_W)).toBe(2); // 중앙
    expect(widthChannel(HALF_W - 0.01, HALF_W)).toBe(4); // 맨 아래
  });
  it("하프스페이스 = 채널 1·3", () => {
    expect(isHalfSpace(0, HALF_W)).toBe(false); // 중앙
    expect(isHalfSpace(-HALF_W * 0.5, HALF_W)).toBe(true); // 위 하프스페이스
    expect(isHalfSpace(HALF_W * 0.5, HALF_W)).toBe(true);
  });
});

describe("존14 — 상대 박스 앞 중앙", () => {
  it("팀0(+x): 오른쪽 골 앞 중앙 구역", () => {
    expect(inZone14({ x: HALF_L - 24, y: 0 }, 0, HALF_L, HALF_W)).toBe(true);
    expect(inZone14({ x: HALF_L - 24, y: 20 }, 0, HALF_L, HALF_W)).toBe(false); // 측면
    expect(inZone14({ x: 0, y: 0 }, 0, HALF_L, HALF_W)).toBe(false); // 너무 멀음
  });
  it("팀1(-x): 대칭", () => {
    expect(inZone14({ x: -(HALF_L - 24), y: 0 }, 1, HALF_L, HALF_W)).toBe(true);
  });
});

describe("taxonomy 메타 집합", () => {
  it("롱볼·크로스는 lofted, 짧은 패스는 아님", () => {
    expect(LOFTED_PASSES.has("longBall")).toBe(true);
    expect(LOFTED_PASSES.has("crossHigh")).toBe(true);
    expect(LOFTED_PASSES.has("groundShort")).toBe(false);
  });
  it("스루·라인브레이킹은 progressive", () => {
    expect(PROGRESSIVE_PASSES.has("throughPass")).toBe(true);
    expect(PROGRESSIVE_PASSES.has("backPass")).toBe(false);
  });
  it("개인기 일부는 1대1 제침", () => {
    expect(BEAT_MAN_SKILLS.has("marseilleTurn")).toBe(true);
    expect(BEAT_MAN_SKILLS.has("bodyFeint")).toBe(false); // 페인트는 제침 아님(유인)
  });
  it("GK 손 액션 — 스위핑(발)은 손 아님", () => {
    expect(GK_HAND_ACTIONS.has("catch")).toBe(true);
    expect(GK_HAND_ACTIONS.has("punt")).toBe(true);
    expect(GK_HAND_ACTIONS.has("sweep")).toBe(false);
    expect(GK_HAND_ACTIONS.has("shortPass")).toBe(false);
  });
});
