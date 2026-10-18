import { describe, expect, it } from "vitest";
import { companionMaterialScale } from "@/lib/ui/viewer-companion/material-scale";
import { createCompanionMotion, type CompanionMotionInput } from "@/lib/ui/viewer-companion/motion";
import { companionMotionClips, companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { projectCompanionSpritePoint, type CompanionSofaPoseInput } from "@/lib/ui/viewer-companion/sofa-pose";

const neutral = (): CompanionSofaPoseInput => ({
  size: 92, display: { x: 240, y: 350, scale: 1 }, cell: { x: 1.25, y: 5, clip: [8, 10, 5, 9] },
  shape: { bob: 0, tilt: 0, scaleX: 1, scaleY: 1 }, pressure: { x: 0, y: 0, tilt: 0, squash: 0 },
  response: { lift: 0, squash: 0 }, facing: 1, sway: { tilt: 0, stretch: 0 },
});
const area = (input: CompanionSofaPoseInput) => {
  const [a, b, c] = [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 0, y: 80 }].map(point => projectCompanionSpritePoint(input, point));
  if (!a || !b || !c) throw Error("Valid material basis was rejected");
  return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / input.size ** 2;
};
const roundedPairArea = (y: number) => Number((1 / y).toFixed(4)) * Number(y.toFixed(4));

describe("companion apparent material area", () => {
  it("widens compression and narrows extension with the requested vertical load and unit determinant", () => {
    for (const vertical of [.5, .8, .965, 1, 1.085, 1.185, 1.315, 1.45, 2]) {
      const pair = companionMaterialScale(vertical);
      expect(pair.scaleY).toBe(vertical); expect(pair.scaleX).toBe(1 / vertical);
      expect(pair.scaleX * pair.scaleY).toBeCloseTo(1, 12);
      if (vertical < 1) expect(pair.scaleX).toBeGreaterThan(1);
      if (vertical > 1) expect(pair.scaleX).toBeLessThan(1);
    }
    expect(companionMaterialScale(.5)).toEqual({ scaleX: 2, scaleY: .5 });
    expect(companionMaterialScale(2)).toEqual({ scaleX: .5, scaleY: 2 });
  });

  it("returns neutral material for nonfinite or nonpositive vertical input", () => {
    for (const vertical of [NaN, Infinity, -Infinity, 0, -0, -.01, -10]) expect(companionMaterialScale(vertical)).toEqual({ scaleX: 1, scaleY: 1 });
  });

  it.each([60, 120])("keeps every active row's sampled determinant at one at%sHz, including held release and reduced motion", hz => {
    for (let row = 0; row < companionSpriteMetadata.rows.length; row++) {
      if (row === 7) continue; // Intentionally unused legacy row.
      const motion = createCompanionMotion({ clips: companionMotionClips, rowCount: companionSpriteMetadata.rows.length, loopRows: [0, 2, 8, 9, 11, 20] });
      const sample = (now: number): CompanionMotionInput => ({ row, status: row === 8 ? "held" : row === 2 ? "walk" : row === 20 ? "sprint" : row === 32 ? "jump" : "play", x: 100 + ([2, 20].includes(row) ? now * .07 : 0), y: 300, phase: now / 1000, now });
      let pose = motion.sample(sample(0)), maximumExtension = 1;
      for (let tick = 1; tick <= hz; tick++) {
        pose = motion.sample(sample(tick * 1000 / hz));
        expect(pose.scaleX).toBeGreaterThan(0); expect(pose.scaleY).toBeGreaterThan(0);
        // The sampler exposes six-decimal CSS scalars.
        expect(pose.scaleX * pose.scaleY).toBeCloseTo(1, 5);
        maximumExtension = Math.max(maximumExtension, pose.scaleY);
      }
      if (row === 8) {
        expect(maximumExtension).toBeGreaterThan(1.18);
        const released = motion.sample({ ...sample(1000), row: 0, status: "idle" });
        for (const key of ["scaleX", "scaleY", "bob", "tilt"] as const) expect(released[key]).toBe(pose[key]);
        expect(motion.sample({ ...sample(1000), row: 0, status: "idle" })).toEqual(released);
        for (let tick = 1; tick <= hz / 10; tick++) {
          pose = motion.sample({ ...sample(1000 + tick * 1000 / hz), row: 0, status: "idle" });
          expect(pose.scaleX * pose.scaleY).toBeCloseTo(1, 5);
        }
        expect(pose).toMatchObject({ scaleX: 1, scaleY: 1, bob: 0, tilt: 0 });
      }
      expect(motion.sample({ ...sample(1200), reduced: true })).toMatchObject({ scaleX: 1, scaleY: 1, bob: 0, tilt: 0 });
    }
  });

  it("preserves projected basis area through each decorative layer and its actual CSS precision", () => {
    const cases: CompanionSofaPoseInput[] = [
      { ...neutral(), shape: { bob: 2, tilt: 12, scaleX: 1 / 1.3, scaleY: 1.3 } },
      { ...neutral(), chew: .012 },
      { ...neutral(), pressure: { x: 3, y: -2, tilt: -6, squash: .13 } },
      { ...neutral(), response: { lift: -8, squash: .09 } },
      { ...neutral(), sway: { tilt: 17, stretch: .075 } },
    ];
    for (const input of cases) {
      const verticals = [input.shape.scaleY - (input.chew ?? 0) * .8, 1 - input.pressure.squash, 1 - input.response.squash, 1 + input.sway.stretch];
      const expected = verticals.reduce((product, y) => product * roundedPairArea(y), 1);
      expect(area(input)).toBeCloseTo(expected, 10);
      // Four-decimal presentation pairs bound the small raster/CSS rounding.
      expect(area(input)).toBeCloseTo(1, 3);
    }
  });

  it("keeps nested pivoted rotations, mirrored facing and material layers independent of uniform world zoom", () => {
    const nested: CompanionSofaPoseInput = {
      ...neutral(), shape: { bob: -2, tilt: 14, scaleX: 1 / 1.28, scaleY: 1.28 }, chew: .011,
      pressure: { x: 3, y: 2, tilt: -7, squash: .12 }, response: { lift: -5, squash: .08 },
      sway: { tilt: 17, stretch: .075 }, poseOrigin: { x: 24, y: 28 }, inertiaOrigin: { x: 22, y: 20 },
    };
    for (const facing of [-1, 1] as const) {
      const base = area({ ...nested, facing });
      expect(Math.sign(base)).toBe(facing); expect(Math.abs(base)).toBeCloseTo(1, 3);
      const relocated = { ...nested, facing, poseOrigin: { x: 74, y: 18 }, inertiaOrigin: { x: 67, y: 30 }, shape: { ...nested.shape, tilt: -31 }, pressure: { ...nested.pressure, tilt: 19 } };
      expect(area(relocated)).toBeCloseTo(base, 10);
      expect(projectCompanionSpritePoint(relocated, { x: 40, y: 60 })).not.toEqual(projectCompanionSpritePoint({ ...nested, facing }, { x: 40, y: 60 }));
      for (const worldScale of [.3, .65, 1, 1.8]) {
        const actual = area({ ...nested, facing, display: { x: 410, y: 520, scale: worldScale } });
        expect(actual / base).toBeCloseTo(worldScale ** 2, 10);
        expect(Math.abs(actual) / worldScale ** 2).toBeCloseTo(1, 3);
      }
    }
  });
});
