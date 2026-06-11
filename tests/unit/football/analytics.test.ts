import { describe, expect, it } from "vitest";
import { xtValue, xtDelta, xtGrid } from "@/lib/football/analytics/xt-grid";
import { xgFromShot } from "@/lib/football/analytics/xg-lite";
import { teamShape, lineHeight, widthUse, fieldTilt } from "@/lib/football/analytics/shape";
import { ppda, packing, pressIntensity } from "@/lib/football/analytics/pressing";
import { controlAt, passProbability } from "@/lib/football/analytics/pitch-control-lite";
import { HALF_L } from "@/lib/football/core/pitch";

describe("xT lite", () => {
  it("상대 골 근처가 자기 진영보다 위협 높음(team0)", () => {
    const near = xtValue({ x: HALF_L * 0.9, y: 0 }, 0);
    const far = xtValue({ x: -HALF_L * 0.9, y: 0 }, 0);
    expect(near).toBeGreaterThan(far);
    expect(near).toBeLessThanOrEqual(1);
    expect(far).toBeGreaterThanOrEqual(0);
  });
  it("전진 패스는 양의 xtDelta", () => {
    expect(xtDelta({ x: 0, y: 0 }, { x: HALF_L * 0.7, y: 0 }, 0)).toBeGreaterThan(0);
  });
  it("중앙이 측면보다 위협 높음", () => {
    expect(xtValue({ x: 30, y: 0 }, 0)).toBeGreaterThan(xtValue({ x: 30, y: 30 }, 0));
  });
  it("grid 차원", () => {
    const g = xtGrid(12, 8, 0);
    expect(g.length).toBe(8);
    expect(g[0].length).toBe(12);
  });
});

describe("xG lite", () => {
  it("가까운 정면이 먼 곳보다 xG 높음", () => {
    const close = xgFromShot({ x: HALF_L - 6, y: 0 }, 0);
    const far = xgFromShot({ x: 0, y: 0 }, 0);
    expect(close).toBeGreaterThan(far);
    expect(close).toBeLessThanOrEqual(1);
  });
  it("좁은 각(측면 깊숙)이 정면보다 낮음", () => {
    const central = xgFromShot({ x: HALF_L - 8, y: 0 }, 0);
    const wide = xgFromShot({ x: HALF_L - 1, y: 30 }, 0);
    expect(central).toBeGreaterThan(wide);
  });
});

describe("팀 형태", () => {
  it("밀집 배치는 분산이 작다", () => {
    const tight = teamShape([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: -1, y: -1 }
    ]);
    const spread = teamShape([
      { x: -40, y: -30 },
      { x: 0, y: 0 },
      { x: 40, y: 30 }
    ]);
    expect(tight.bboxArea).toBeLessThan(spread.bboxArea);
    expect(tight.lengthSpread).toBeLessThan(spread.lengthSpread);
  });
  it("lineHeight: team0 전진 배치가 높다", () => {
    const high = lineHeight([{ x: 40, y: 0 }], 0);
    const low = lineHeight([{ x: -40, y: 0 }], 0);
    expect(high).toBeGreaterThan(low);
  });
  it("widthUse: 넓게 벌리면 크다", () => {
    expect(widthUse([{ x: 0, y: -30 }, { x: 0, y: 30 }])).toBeGreaterThan(
      widthUse([{ x: 0, y: -2 }, { x: 0, y: 2 }])
    );
  });
  it("fieldTilt: team0이 상대 서드 더 점유하면 >0.5", () => {
    const t0 = [{ x: 45, y: 0 }, { x: 44, y: 5 }];
    const t1 = [{ x: 10, y: 0 }];
    expect(fieldTilt(t0, t1)).toBeGreaterThan(0.5);
  });
});

describe("압박/돌파", () => {
  it("ppda: 수비액션 많을수록 낮다(강한 압박)", () => {
    expect(ppda(20, 10)).toBe(2);
    expect(ppda(20, 0)).toBe(Infinity);
  });
  it("packing: 전진 패스가 사이 수비수를 제친다", () => {
    const opp = [{ x: 10, y: 0 }, { x: 20, y: 5 }, { x: 40, y: 0 }];
    expect(packing({ x: 0, y: 0 }, { x: 30, y: 0 }, opp, 0)).toBe(2);
    expect(packing({ x: 30, y: 0 }, { x: 0, y: 0 }, opp, 0)).toBe(0); // 후진
  });
  it("pressIntensity: 반경 안 상대 수", () => {
    const r = pressIntensity({ x: 0, y: 0 }, [
      { pos: { x: 2, y: 0 }, vel: { x: -3, y: 0 } },
      { pos: { x: 50, y: 0 }, vel: { x: 0, y: 0 } }
    ]);
    expect(r.count).toBe(1);
    expect(r.approachSpeed).toBeGreaterThan(0);
  });
});

describe("pitch control lite", () => {
  it("가장 가까운 선수의 팀이 장악", () => {
    const c = controlAt({ x: 0, y: 0 }, [
      { team: 0, pos: { x: 1, y: 0 } },
      { team: 1, pos: { x: 10, y: 0 } }
    ]);
    expect(c.team).toBe(0);
    expect(c.margin).toBeGreaterThan(0);
  });
  it("패스 경로에 상대 있으면 성공률 낮다", () => {
    const blocked = passProbability({ x: 0, y: 0 }, { x: 20, y: 0 }, [{ x: 10, y: 0 }]);
    const clear = passProbability({ x: 0, y: 0 }, { x: 20, y: 0 }, [{ x: 10, y: 20 }]);
    expect(clear).toBeGreaterThan(blocked);
  });
});
