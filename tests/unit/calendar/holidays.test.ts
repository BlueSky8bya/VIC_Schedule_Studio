import { describe, expect, it } from "vitest";
import { getDayMark, withoutWorldCupMark } from "@/lib/calendar/holidays";

describe("withoutWorldCupMark", () => {
  it("월드컵 단계와 단독 경기 표기를 제거한다", () => {
    expect(withoutWorldCupMark(getDayMark("2026-07-10"))).toBeNull();
    expect(withoutWorldCupMark(getDayMark("2026-06-12"))).toBeNull();
  });

  it("같은 날의 일반 기념 표기는 남기고 경기만 제거한다", () => {
    const mark = withoutWorldCupMark(getDayMark("2026-07-15"));

    expect(mark?.name).toBe("🍗 초복");
    expect(mark?.match).toBeUndefined();
  });

  it("월드컵과 무관한 공휴일은 그대로 둔다", () => {
    expect(withoutWorldCupMark(getDayMark("2026-07-17"))?.name).toBe("제헌절");
  });
});
