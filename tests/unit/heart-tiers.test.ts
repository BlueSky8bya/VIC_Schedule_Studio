import { describe, expect, it } from "vitest";
import {
  HEART_BLAZE_MIN,
  HEART_CROWN,
  HEART_HOT_MIN,
  HEART_MIN,
  heartTier
} from "@/lib/schedules/heart-tiers";

// 관심 단계 = 이 달 최다 대비 비율 + 절대 하한(2026-08-27). 8월 실측 분포(최다 12, 나머지 5~11)에서
// 네 단계가 모두 살아나는지 + 하한·단조성·👑 규칙을 못박는다.
describe("heartTier — 이 달 최다 대비 비율 + 절대 하한", () => {
  const key = (count: number, max: number, isTop = false) => heartTier(count, isTop, max)?.key ?? null;

  it("최소 하트 미만은 단계 없음", () => {
    expect(key(HEART_MIN - 1, 12)).toBeNull();
    expect(key(0, 0)).toBeNull();
  });

  it("8월 실측 분포: 12(최다)=👑, 11=폭발, 6~7=높은, 5=관심", () => {
    expect(key(12, 12, true)).toBe("top");
    expect(key(11, 12)).toBe("blaze"); // 11 ≥ 12×0.8=9.6, ≥8
    expect(key(7, 12)).toBe("hot"); // 7 ≥ 6, ≥6
    expect(key(6, 12)).toBe("hot");
    expect(key(5, 12)).toBe("warm"); // 5 < 6
  });

  it("절대 하한: 최다가 작아도 6/8개 미만이면 못 올라간다", () => {
    expect(key(5, 5)).toBe("warm"); // 비율 100%지만 하한 6 미만
    expect(key(HEART_HOT_MIN, HEART_HOT_MIN)).toBe("hot");
    expect(key(7, 7)).toBe("hot"); // 폭발 하한 8 미만
    expect(key(HEART_BLAZE_MIN, HEART_BLAZE_MIN)).toBe("blaze");
  });

  it("규모가 커져도 비율로 따라간다(최다 40)", () => {
    expect(key(40, 40, true)).toBe("top");
    expect(key(33, 40)).toBe("blaze"); // ≥ 32
    expect(key(31, 40)).toBe("hot"); // ≥ 20, < 32
    expect(key(19, 40)).toBe("warm");
  });

  it("👑은 이 달 최다(isTop)이면서 하한 이상일 때만 — 아니면 비율 단계로", () => {
    expect(key(HEART_CROWN, HEART_CROWN, true)).toBe("top");
    expect(key(HEART_CROWN - 1, HEART_CROWN - 1, true)).toBe("blaze"); // 9 ≥ 8, 100%
    expect(key(12, 12, false)).toBe("blaze"); // 최다와 같아도 isTop=false면 왕관 없음
  });

  it("maxHeart보다 count가 크면(낙관적 +1 직후) count를 최다로 본다", () => {
    expect(key(13, 12)).toBe("blaze");
  });

  it("단조: 같은 최다에서 하트가 늘면 단계는 내려가지 않는다", () => {
    const order = ["warm", "hot", "blaze"];
    let prev = -1;
    for (let c = HEART_MIN; c <= 12; c++) {
      const k = key(c, 12);
      const idx = order.indexOf(k ?? "");
      expect(idx).toBeGreaterThanOrEqual(prev);
      prev = idx;
    }
  });
});
