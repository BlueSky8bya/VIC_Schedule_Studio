import { describe, expect, it } from "vitest";
import { stepBandPath } from "@/lib/calendar/use-equal-chain-heights";

// 꺾인 띠(2026-11-16 소유자 C안) — 굵기는 칸 사이 틈을 10~14px로 묶고, 앞·다음 카드 세로 범위를 모두 덮는다.
const nums = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe("stepBandPath", () => {
  const S = { left: 8, right: 252, top: 108, bottom: 206 }; // 앞날 아래쪽 카드
  const T = { left: 263, right: 507, top: 40, bottom: 66 }; // 다음날 첫 카드(위)

  it("틈이 11px이면 그대로 11px 굵기, 위로는 다음 카드 꼭대기·아래로는 앞 카드 바닥까지", () => {
    const { d, width } = stepBandPath(S, T);
    expect(width).toBe(11);
    const v = nums(d);
    const ys = v.filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeCloseTo(40, 0);
    expect(Math.max(...ys)).toBeCloseTo(206, 0);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("틈이 좁아도 10px 아래로, 넓어도 14px 위로 가지 않는다", () => {
    expect(stepBandPath(S, { ...T, left: 256 }).width).toBe(10);
    expect(stepBandPath(S, { ...T, left: 290 }).width).toBe(14);
  });

  it("다음 카드가 더 아래에 있어도 두 범위를 모두 덮는다", () => {
    const { d } = stepBandPath({ ...S, top: 40, bottom: 66 }, { ...T, top: 90, bottom: 150 });
    const ys = nums(d).filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeCloseTo(40, 0);
    expect(Math.max(...ys)).toBeCloseTo(150, 0);
  });
});
