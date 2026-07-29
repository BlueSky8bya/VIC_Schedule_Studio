import { describe, expect, it } from "vitest";
import { parseMonthParams } from "@/lib/calendar/month";

// P1-ROUTE-1: /studio/…/[year]/[month] 콜드 엔트리 파라미터 검증.
describe("parseMonthParams", () => {
  it("정상 범위를 통과시킨다", () => {
    expect(parseMonthParams("2026", "7")).toEqual({ year: 2026, month: 7 });
    expect(parseMonthParams("2026", "07")).toEqual({ year: 2026, month: 7 });
    expect(parseMonthParams("2020", "1")).toEqual({ year: 2020, month: 1 });
    expect(parseMonthParams("2099", "12")).toEqual({ year: 2099, month: 12 });
  });

  it("범위 밖은 null", () => {
    expect(parseMonthParams("2019", "7")).toBeNull();
    expect(parseMonthParams("2100", "7")).toBeNull();
    expect(parseMonthParams("2026", "0")).toBeNull();
    expect(parseMonthParams("2026", "13")).toBeNull();
  });

  it("비정수·쓰레기 입력은 null", () => {
    expect(parseMonthParams("abcd", "7")).toBeNull();
    expect(parseMonthParams("2026", "x")).toBeNull();
    expect(parseMonthParams("2026.5", "7")).toBeNull();
    expect(parseMonthParams("2026", "7.5")).toBeNull();
    expect(parseMonthParams("", "")).toBeNull();
    expect(parseMonthParams("-2026", "7")).toBeNull();
    expect(parseMonthParams("2026", "007")).toBeNull(); // 자리수 초과
    expect(parseMonthParams("02026", "7")).toBeNull();
  });
});
