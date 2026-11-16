import { describe, expect, it } from "vitest";
import { stepBandPath, stepRingPath } from "@/lib/calendar/use-equal-chain-heights";

// 꺾인 띠(2026-11-16 소유자 C안) — 굵기는 칸 사이 틈에서 양옆 2px 여백을 뺀 값을 7~12px로 묶고,
// 앞·다음 카드 세로 범위를 모두 덮는다(테두리 두께 절반만큼 안으로 들여 카드 테두리와 같은 줄).
const nums = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe("stepBandPath", () => {
  const S = { left: 8, right: 252, top: 108, bottom: 206 }; // 앞날 아래쪽 카드
  const T = { left: 263, right: 507, top: 40, bottom: 66 }; // 다음날 첫 카드(위)

  it("틈 11px → 여백 2px씩 빼 7px 굵기, 위로는 다음 카드 꼭대기·아래로는 앞 카드 바닥까지(테두리 절반 안쪽)", () => {
    const { d, width } = stepBandPath(S, T);
    expect(width).toBe(7);
    const v = nums(d);
    const ys = v.filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeCloseTo(40.5, 1);
    expect(Math.max(...ys)).toBeCloseTo(205.5, 1);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("틈이 좁아도 7px 아래로, 넓어도 12px 위로 가지 않는다", () => {
    expect(stepBandPath(S, { ...T, left: 256 }).width).toBe(7);
    expect(stepBandPath(S, { ...T, left: 290 }).width).toBe(12);
  });

  it("고른 묶음 테두리는 앞 카드 왼쪽 끝부터 다음 카드 오른쪽 끝까지 한 줄로 두른다", () => {
    const { xa, xb } = stepBandPath(S, T);
    const xs = nums(stepRingPath(S, T, xa, xb, 3)).filter((_, i) => i % 2 === 0);
    expect(Math.min(...xs)).toBeCloseTo(5, 1);
    expect(Math.max(...xs)).toBeCloseTo(510, 1);
  });

  it("다음 카드가 더 아래에 있어도 두 범위를 모두 덮는다", () => {
    const { d } = stepBandPath({ ...S, top: 40, bottom: 66 }, { ...T, top: 90, bottom: 150 });
    const ys = nums(d).filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeCloseTo(40.5, 1);
    expect(Math.max(...ys)).toBeCloseTo(149.5, 1);
  });
});
