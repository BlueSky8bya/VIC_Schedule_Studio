import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrentKstYearMonth, getTodayKst, nowKstHm } from "@/lib/calendar/month";

// P2-KST-1: KST 변환 단일 출처 특성화 — UTC 자정/월 경계에서 KST(+9)로 올바르게 넘어가는지.
describe("KST helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("UTC 저녁 = KST 다음날(자정 경계)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-31T15:30:00Z")); // KST 2026-02-01 00:30
    expect(getTodayKst()).toBe("2026-02-01");
    expect(getCurrentKstYearMonth()).toEqual({ year: 2026, month: 2 });
    expect(nowKstHm()).toBe("00:30");
  });

  it("연말 경계 — UTC 12/31 낮은 아직 KST 12/31, 15시부터 새해", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T14:59:00Z")); // KST 23:59
    expect(getTodayKst()).toBe("2026-12-31");
    vi.setSystemTime(new Date("2026-12-31T15:00:00Z")); // KST 2027-01-01 00:00
    expect(getTodayKst()).toBe("2027-01-01");
    expect(getCurrentKstYearMonth()).toEqual({ year: 2027, month: 1 });
  });
});
