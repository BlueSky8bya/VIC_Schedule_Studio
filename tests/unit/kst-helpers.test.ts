import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCurrentKstYearMonth,
  getTodayKst,
  kstDayKey,
  nowKstHm
} from "@/lib/calendar/month";

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

// ── 자정(KST) 경계에서 기록이 어느 날에 적재되는가 ──
// 방문·행동 기록의 `day` 컬럼이 조회·보존 청소의 기준이다. 적재 쪽과 조회 쪽이 다른 계산을 쓰면
// 자정 전후 기록이 서로 다른 날에 흩어지고, 그건 조용히 일어나 나중에 "집계가 안 맞네"로만 보인다.
// 그래서 계산을 kstDayKey 하나로 모으고 경계를 여기서 못박는다.
describe("kstDayKey — 적재 기준일", () => {
  it("UTC 14:59:59 = 아직 그날 KST 23:59:59", () => {
    expect(kstDayKey(Date.parse("2026-08-05T14:59:59.999Z"))).toBe("2026-08-05");
  });
  it("UTC 15:00:00 = KST 다음날 00:00:00", () => {
    expect(kstDayKey(Date.parse("2026-08-05T15:00:00.000Z"))).toBe("2026-08-06");
  });
  it("월·연 경계도 같은 규칙", () => {
    expect(kstDayKey(Date.parse("2026-01-31T15:00:00Z"))).toBe("2026-02-01");
    expect(kstDayKey(Date.parse("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
    expect(kstDayKey(Date.parse("2026-12-31T14:59:59Z"))).toBe("2026-12-31");
  });
  it("Date 객체·숫자 둘 다 받고, 인자가 없으면 지금", () => {
    const t = Date.parse("2026-03-01T00:00:00Z");
    expect(kstDayKey(new Date(t))).toBe(kstDayKey(t));
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T15:30:00Z"));
    expect(kstDayKey()).toBe("2026-03-02");
  });
  it("getTodayKst(Intl 기반)와 항상 같은 값을 낸다 — 두 경로가 갈리면 적재/조회가 어긋난다", () => {
    vi.useFakeTimers();
    for (const iso of [
      "2026-08-05T14:59:59Z",
      "2026-08-05T15:00:00Z",
      "2026-02-28T15:00:00Z",
      "2028-02-29T00:00:00Z",
      "2026-12-31T15:00:01Z"
    ]) {
      vi.setSystemTime(new Date(iso));
      expect(kstDayKey()).toBe(getTodayKst());
    }
  });
});

describe("KST 날짜 계산은 한 곳에만 있다", () => {
  it("적재·조회 코드가 +9h를 각자 다시 구현하지 않는다", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    for (const f of ["lib/activity/record.ts", "lib/insights/actions.ts"]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf8");
      expect(src).toContain("kstDayKey");
      // 이 형태의 자체 구현이 다시 생기면 잡는다(day 문자열을 직접 만드는 코드).
      expect(src).not.toMatch(/9 \* 3600 \* 1000\)\.toISOString\(\)\.slice\(0, 10\)/);
    }
  });
});
