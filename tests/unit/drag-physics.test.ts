import { describe, expect, it } from "vitest";
import { MAX_TILT, softTilt } from "@/lib/studio/drag-physics";

// 2026-08-06 사용자 지적: 일정 카드를 끌 때 진자 물리가 너무 과해 "완전 90도로 꺾인다".
// 기울기를 부드럽게 포화시켜, 작은 손짓은 예전 그대로 두고 큰 휘두름만 완만하게 눕힌다.

describe("softTilt", () => {
  it("작은 각은 거의 그대로 — 평소 감각을 안 뺏는다", () => {
    expect(softTilt(2)).toBeCloseTo(2, 1);
    expect(softTilt(-3)).toBeCloseTo(-3, 1);
  });

  it("아무리 휘둘러도 한계를 안 넘는다", () => {
    for (const deg of [45, 90, 180, 720, -90, -400]) {
      expect(Math.abs(softTilt(deg))).toBeLessThanOrEqual(MAX_TILT);
    }
  });

  it("한계에 점근한다 — 뚝 잘리지 않는다(뻣뻣함 방지)", () => {
    const a = softTilt(30);
    const b = softTilt(60);
    expect(b).toBeGreaterThan(a); // 계속 커지긴 한다
    expect(b - a).toBeLessThan(1); // 그러나 아주 조금씩
  });

  it("단조 증가 + 부호 대칭", () => {
    let prev = -Infinity;
    for (let d = -90; d <= 90; d += 5) {
      const v = softTilt(d);
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
    expect(softTilt(37)).toBeCloseTo(-softTilt(-37), 6);
  });

  it("0은 0, max=0이면 회전 없음", () => {
    expect(softTilt(0)).toBe(0);
    expect(softTilt(90, 0)).toBe(0);
  });
});
