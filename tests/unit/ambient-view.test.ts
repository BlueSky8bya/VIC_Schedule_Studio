import { describe, expect, it } from "vitest";
import { DEPTH_FAR, HORIZON_V, depthFade, depthScale, horizonY, moveScale, toGroundV, toScreen } from "@/components/shared/ambient/world/view";

const H = 860;

describe("world/view — 3/4 시점 카메라", () => {
  it("거리 축소: 지평선에서 DEPTH_FAR, 화면 아래에서 1", () => {
    expect(depthScale(horizonY(H), H)).toBeCloseTo(DEPTH_FAR, 2);
    expect(depthScale(H, H)).toBeCloseTo(1, 2);
  });

  it("원근 이동 배율: 지평선 쪽이 훨씬 느리고, 아래로 갈수록 단조 증가한다", () => {
    // 소유자 2026-09-04: "지평선 쪽으로 갈수록 한 픽셀 움직이는 데 걸리는 시간이 길어져야 한다".
    const far = moveScale(horizonY(H) + 4, H);
    const near = moveScale(H - 4, H);
    expect(near).toBeCloseTo(1, 2);
    expect(far).toBeLessThan(0.3);
    expect(near / far).toBeGreaterThan(3.5); // 같은 걸음이 화면에서 3.5배 이상 차이

    let prev = -1;
    for (let y = horizonY(H); y <= H; y += 20) {
      const v = moveScale(y, H);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("거리 흐림: 먼 것이 더 옅고, 가까운 것은 1", () => {
    expect(depthFade(horizonY(H), H)).toBeLessThan(0.6);
    expect(depthFade(H, H)).toBeCloseTo(1, 2);
  });

  it("세계 좌표는 지평선 아래에만 놓인다", () => {
    const [, yTop] = toScreen(0.5, 0, 1400, H);
    expect(yTop).toBeCloseTo(H * HORIZON_V, 2);
    expect(toGroundV(yTop, H)).toBeCloseTo(0, 2);
    expect(toGroundV(H, H)).toBeCloseTo(1, 2);
  });
});
