import { describe, expect, it } from "vitest";
import { projectCompanionSofaBody, type CompanionSofaPoseInput } from "@/lib/ui/viewer-companion/sofa-pose";

const neutral = (): CompanionSofaPoseInput => ({
  size: 80, display: { x: 40, y: 80, scale: 1 }, cell: { x: 0, y: 0, clip: [0, 0, 0, 0] },
  shape: { bob: 0, tilt: 0, scaleX: 1, scaleY: 1 }, pressure: { x: 0, y: 0, tilt: 0, squash: 0 },
  response: { lift: 0, squash: 0 }, facing: 1, sway: { tilt: 0, stretch: 0 },
});
const closePoints = (actual: readonly { x: number; y: number }[], expected: readonly { x: number; y: number }[]) => {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++) { expect(actual[i].x).toBeCloseTo(expected[i].x, 8); expect(actual[i].y).toBeCloseTo(expected[i].y, 8); }
};

describe("complete CSS sofa body projection", () => {
  it("starts at the real clipped registered frame, not its transparent cell or actor hitbox", () => {
    const input = neutral(); input.cell = { x: 5, y: -3, clip: [10, 20, 30, 15] };
    closePoints(projectCompanionSofaBody(input), [{ x: 20, y: 7 }, { x: 65, y: 7 }, { x: 65, y: 47 }, { x: 20, y: 47 }]);
  });
  it("composes every nested stage in CSS order around its own origin", () => {
    const input = neutral();
    input.display = { x: 100, y: 200, scale: 1 }; input.cell = { x: 5, y: -3, clip: [10, 20, 30, 15] };
    input.shape = { bob: 2, tilt: 90, scaleX: 2, scaleY: .5 }; input.poseOrigin = { x: 0, y: 0 };
    input.pressure = { x: 3, y: 4, tilt: 0, squash: 0 }; input.response = { lift: -2, squash: 0 };
    input.facing = -1; input.sway = { tilt: 90, stretch: 0 }; input.inertiaOrigin = { x: 0, y: 0 };
    // Hand-derived90° composition: TL registration20,7 → pose-3.5,42 →
    // contact-6.5,46 → reaction-6.5,44 → facing86.5,44 → inertia-44,86.5.
    closePoints(projectCompanionSofaBody(input), [{ x: 16, y: 206.5 }, { x: -74, y: 206.5 }, { x: -74, y: 226.5 }, { x: 16, y: 226.5 }]);
  });
  it("uses bottom-centred pressure/support scales followed by the physical inertia plane", () => {
    const input = neutral(); input.pressure = { ...input.pressure, squash: .2 };
    input.response = { lift: -4, squash: .1 }; input.sway = { ...input.sway, stretch: .1 };
    const first = projectCompanionSofaBody(input)[0];
    // TL: contact(-5.2,16), reaction(-6.782,18.4), inertia(-5.14463,12.24).
    expect(first.x).toBeCloseTo(-5.14463, 8); expect(first.y).toBeCloseTo(12.24, 8);
  });
  it("keeps the actual ear grip fixed through left-facing held stretch and outer inertia", () => {
    const input = neutral(); input.size = 100; input.display = { x: 300, y: 400, scale: 1 };
    // This clipped corner is exactly the facing-conjugated grip80,25.
    input.cell = { ...input.cell, clip: [20, 0, 0, 64] }; input.facing = -1;
    input.poseOrigin = { x: 80, y: 25 }; input.inertiaOrigin = { x: 20, y: 25 };
    input.shape = { bob: 0, tilt: 16, scaleX: .93, scaleY: 1.36 }; input.sway = { tilt: -12, stretch: .07 };
    const first = projectCompanionSofaBody(input)[0];
    expect(first.x).toBeCloseTo(270, 8); expect(first.y).toBeCloseTo(325, 8);
    expect(Math.max(...projectCompanionSofaBody(input).map(point => point.y))).toBeGreaterThan(400);
  });
  it("preserves CSS centre-centre scaling on the outer body rather than inventing a foot origin", () => {
    const input = neutral(); input.size = 100; input.display = { x: 300, y: 400, scale: .5 };
    closePoints(projectCompanionSofaBody(input), [{ x: 275, y: 325 }, { x: 325, y: 325 }, { x: 325, y: 375 }, { x: 275, y: 375 }]);
  });
  it("matches the renderer's literal CSS precision and eating deformation", () => {
    const input = neutral(); input.shape = { bob: .0006, tilt: .0004, scaleX: 1.00006, scaleY: 1.00006 };
    let first = projectCompanionSofaBody(input)[0]; expect(first.x).toBeCloseTo(-.004, 8); expect(first.y).toBeCloseTo(-.007, 8);
    input.shape = neutral().shape; input.chew = .01;
    first = projectCompanionSofaBody(input)[0]; expect(first.x).toBeCloseTo(-.4, 8); expect(first.y).toBeCloseTo(.64, 8);
  });
  it("scales logical registration exactly once and never mutates a retained painted cell", () => {
    const input = neutral(); input.size = 92; input.cell = Object.freeze({ x: -2, y: 15, clip: Object.freeze([14, 13, 13, 18]) });
    input.display = { x: 500, y: 700, scale: 1 };
    const before = JSON.stringify(input), points = projectCompanionSofaBody(input);
    expect(points[0].x).toBeCloseTo(454 + 16 / 80 * 92, 8); expect(points[0].y).toBeCloseTo(608 + 29 / 80 * 92, 8);
    expect(JSON.stringify(input)).toBe(before); expect(projectCompanionSofaBody(input)).toEqual(points);
  });
  it("rejects malformed geometry instead of publishing partial or nonfinite corners", () => {
    expect(projectCompanionSofaBody({ ...neutral(), size: 0 })).toEqual([]);
    expect(projectCompanionSofaBody({ ...neutral(), display: { x: 0, y: 0, scale: NaN } })).toEqual([]);
    expect(projectCompanionSofaBody({ ...neutral(), cell: { x: 0, y: 0, clip: [0, 0, 0] } })).toEqual([]);
    expect(projectCompanionSofaBody({ ...neutral(), cell: { x: 0, y: 0, clip: [0, 40, 0, 40] } })).toEqual([]);
    expect(projectCompanionSofaBody({ ...neutral(), shape: { bob: 0, tilt: 0, scaleX: Infinity, scaleY: 1 } })).toEqual([]);
    expect(projectCompanionSofaBody({ ...neutral(), shape: { bob: 0, tilt: 0, scaleX: -1, scaleY: 1 } })).toEqual([]);
  });
});
