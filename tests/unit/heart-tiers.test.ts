import { describe, expect, it } from "vitest";
import { HEART_MIN, heartRankMap } from "@/lib/schedules/heart-tiers";

// 2026-11-17 토리님: 인기도는 이 달 하트 순위 1·2·3위에 금·은·동 왕관만.
const rank = (counts: Record<string, number>) =>
  Object.fromEntries([...heartRankMap(Object.entries(counts))].map(([id, t]) => [id, t.key]));

describe("heartRankMap — 이 달 하트 순위 금·은·동", () => {
  it("하트 수 순서대로 1·2·3위, 그 아래는 왕관 없음", () => {
    expect(rank({ a: 30, b: 20, c: 12, d: 9 })).toEqual({ a: "gold", b: "silver", c: "bronze" });
  });

  it("동점은 같은 등수 — 다음 등수는 바로 다음 하트 수(공동 1위면 다음은 은)", () => {
    expect(rank({ a: 20, b: 20, c: 15, d: 10, e: 8 })).toEqual({ a: "gold", b: "gold", c: "silver", d: "bronze" });
  });

  it(`하트 ${HEART_MIN}개 미만은 순위에서 빠진다`, () => {
    expect(rank({ a: HEART_MIN, b: HEART_MIN - 1, c: 1 })).toEqual({ a: "gold" });
    expect(rank({})).toEqual({});
  });
});
