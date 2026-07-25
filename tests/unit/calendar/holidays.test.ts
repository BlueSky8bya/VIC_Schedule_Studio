import { describe, expect, it } from "vitest";
import { withoutWorldCupMark } from "@/lib/calendar/holidays";
import {
  getWorldCupMark,
  isWorldCupMonth,
  WORLD_CUP_UI_ENABLED
} from "@/lib/calendar/worldcup";

describe("월드컵 시즌 UI", () => {
  it("시즌 종료 후 프론트 노출을 전역 차단한다", () => {
    expect(WORLD_CUP_UI_ENABLED).toBe(false);
    expect(getWorldCupMark("2026-07-20")).toBeNull();
    expect(isWorldCupMonth(2026, 7)).toBe(false);
  });
});

describe("withoutWorldCupMark", () => {
  it("월드컵 단계와 단독 경기 표기를 제거한다", () => {
    expect(
      withoutWorldCupMark({ name: "⚽ 8강", isHoliday: false, kind: "wc" })
    ).toBeNull();
    expect(
      withoutWorldCupMark({
        name: "",
        isHoliday: false,
        match: { text: "⚽ 한국 2-1 체코", kind: "wc-korea-win", celebrate: "win" }
      })
    ).toBeNull();
  });

  it("같은 날의 일반 기념 표기는 남기고 경기만 제거한다", () => {
    const mark = withoutWorldCupMark({
      name: "🍗 초복",
      isHoliday: false,
      match: { text: "⚽ 4강 프랑스 0-2 스페인", kind: "wc", celebrate: "cheer" }
    });

    expect(mark?.name).toBe("🍗 초복");
    expect(mark?.match).toBeUndefined();
  });

  it("월드컵과 무관한 공휴일은 그대로 둔다", () => {
    expect(
      withoutWorldCupMark({ name: "제헌절", isHoliday: true })?.name
    ).toBe("제헌절");
  });
});
