import { describe, expect, it } from "vitest";
import { kstDay, kstYm, monthProgress, trendDelta } from "@/lib/insights/month-progress";

// '진행 중인 달'을 완료된 달과 구별하는 계산(KST). 이게 없던 때는 6개월 추이의 마지막 칸
// (이번 달 며칠치)을 지난달 '전체'와 그대로 비교해, 매달 초마다 ▼70% 같은 배지가 떴다.

// 2026-08-07 22:10 KST = 2026-08-07 13:10 UTC
const AUG7_2210_KST = Date.parse("2026-08-07T13:10:00.000Z");

describe("KST 경계", () => {
  it("UTC 15시를 넘으면 KST는 다음 날이다", () => {
    expect(kstDay(Date.parse("2026-08-07T14:59:00.000Z"))).toBe("2026-08-07");
    expect(kstDay(Date.parse("2026-08-07T15:00:00.000Z"))).toBe("2026-08-08");
  });
  it("월 경계도 KST 기준", () => {
    expect(kstYm(Date.parse("2026-07-31T15:00:00.000Z"))).toBe("2026-08");
  });
});

describe("monthProgress", () => {
  it("이번 달이 아니면 null(= 완료된 구간)", () => {
    expect(monthProgress("2026-07", AUG7_2210_KST)).toBeNull();
    expect(monthProgress("2026-09", AUG7_2210_KST)).toBeNull();
  });
  it("이번 달이면 며칠째인지와 페이스 비율을 준다", () => {
    const p = monthProgress("2026-08", AUG7_2210_KST);
    expect(p).not.toBeNull();
    expect(p?.elapsedDays).toBe(7);
    expect(p?.totalDays).toBe(31);
    // 6일 + 22시간 지남 → 6.9166…/31
    expect(p?.frac).toBeCloseTo((6 + 22 / 24) / 31, 5);
  });
  it("말일이어도 frac은 1을 넘지 않는다", () => {
    const p = monthProgress("2026-08", Date.parse("2026-08-31T14:00:00.000Z"));
    expect(p?.elapsedDays).toBe(31);
    expect(p?.frac).toBeLessThanOrEqual(1);
  });
});

describe("trendDelta", () => {
  it("완료된 달은 지난달 전체와 그대로 비교한다", () => {
    const d = trendDelta(120, 100, null);
    expect(d.pace).toBe(false);
    expect(d.base).toBe(100);
    expect(d.pct).toBe(20);
  });
  it("진행 중인 달은 지난달의 '같은 페이스' 환산치와 비교한다", () => {
    const prog = monthProgress("2026-08", AUG7_2210_KST);
    // 지난달 310, 이번 달 7일차에 70 → 페이스 환산 기준은 310*(6.9166/31) ≈ 69.2
    const d = trendDelta(70, 310, prog);
    expect(d.pace).toBe(true);
    expect(d.base).toBeCloseTo(310 * ((6 + 22 / 24) / 31), 3);
    // 예전 계산(70 vs 310)이면 ▼77%였다. 페이스 기준이면 거의 그대로다.
    expect(Math.abs(d.pct ?? 999)).toBeLessThan(5);
  });
  it("기준이 0이면 '신규'(null)", () => {
    expect(trendDelta(10, 0, null).pct).toBeNull();
  });
});
