import { describe, expect, it } from "vitest";
import { createCompanionMotion, nextCompanionPaint, sampleCompanionTravel, type CompanionMotionInput } from "@/lib/ui/viewer-companion/motion";

const input = (patch: Partial<CompanionMotionInput> = {}): CompanionMotionInput => ({ row: 0, phase: 0, status: "idle", x: 100, y: 500, now: 0, ...patch });

describe("companion clip and facing continuity", () => {
  it("keeps the lite30 cadence at60/120Hz, including fractional rAF origins", () => {
    for (const hz of [60, 120]) for (const offset of [0, .04, 7.7]) {
      let deadline = offset;
      const paints: number[] = [];
      for (let step = 1; step <= hz * 10; step++) {
        const now = offset + step * 1000 / hz;
        const next = nextCompanionPaint(now, deadline, 30);
        if (next !== null) { deadline = next; paints.push(now); }
      }
      expect(paints).toHaveLength(300);
      expect(Math.min(...paints.slice(1).map((now, i) => now - paints[i]))).toBeGreaterThan(33.2);
    }
    expect(nextCompanionPaint(1000, 0, 0)).toBe(1000);
    expect(nextCompanionPaint(32, 0, 30)).toBeNull();
    expect(nextCompanionPaint(1000, 0, 30)).toBeCloseTo(1000);
  });
  it("enters at a clip's first cell and does not reset its clock for a status label", () => {
    const motion = createCompanionMotion({ clips: { 0: [3, 4, 5], 9: [7, 8, 9] } });
    expect(motion.sample(input({ now: 900 })).column).toBe(3);
    expect(motion.sample(input({ now: 900 + 1000 / 6 })).column).toBe(4);
    expect(motion.sample(input({ now: 900 + 2000 / 6, status: "waiting" })).column).toBe(5);
    expect(motion.sample(input({ now: 1800, row: 9, phase: .8, status: "petted" })).column).toBe(7);
    expect(motion.sample(input({ now: 1925, row: 9, status: "happy" })).column).toBe(8);
  });

  it("ping-pongs unproven loops without a last-to-first hard cut", () => {
    const motion = createCompanionMotion({ clips: { 0: [3, 4, 5] } });
    const columns = Array.from({ length: 7 }, (_, step) => motion.sample(input({ now: step * 1000 / 6 })).column);
    expect(columns).toEqual([3, 4, 5, 4, 3, 4, 5]);
  });

  it("keeps a walking stride independent of sample splits, action labels or a stationary pause", () => {
    const whole = createCompanionMotion({ clips: { 2: [0, 1, 2, 3] } });
    const split = createCompanionMotion({ clips: { 2: [0, 1, 2, 3] } });
    whole.sample(input({ row: 2, status: "walk", x: 0 }));
    split.sample(input({ row: 2, status: "walk", x: 0 }));
    const expected = whole.sample(input({ row: 2, status: "walk", x: 24, now: 320 }));
    for (const x of [6, 12, 18]) split.sample(input({ row: 2, status: "approach", x, now: x / 24 * 320 }));
    expect(split.sample(input({ row: 2, status: "approach", x: 24, now: 320 }))).toEqual(expected);
    expect(split.sample(input({ row: 2, status: "paused", x: 24, now: 50000, phase: .95 }))).toEqual(expected);
  });

  it("faces horizontal travel and retains direction during vertical or negligible movement", () => {
    const motion = createCompanionMotion();
    expect(motion.sample(input()).facing).toBe(1);
    expect(motion.sample(input({ row: 2, x: 99, now: 16 })).facing).toBe(-1);
    expect(motion.sample(input({ row: 4, x: 99, y: 450, now: 32 })).facing).toBe(-1);
    expect(motion.sample(input({ row: 4, x: 99.01, y: 430, now: 48 })).facing).toBe(-1);
    expect(motion.sample(input({ row: 4, x: 100, y: 420, now: 64 })).facing).toBe(1);
    expect(motion.sample(input({ row: 5, x: 100, y: 440, now: 80 })).facing).toBe(1);
  });

  it("clamps a one-shot phase and holds its terminal cell", () => {
    const motion = createCompanionMotion({ clips: { 3: [2, 8, 12] } });
    expect(motion.sample(input({ row: 3, phase: .8 })).column).toBe(2);
    expect(motion.sample(input({ row: 3, phase: -4, now: 1 })).column).toBe(2);
    expect(motion.sample(input({ row: 3, phase: .5, now: 2 })).column).toBe(8);
    expect(motion.sample(input({ row: 3, phase: .99, now: 2.5 })).column).toBe(12);
    expect(motion.sample(input({ row: 3, phase: 4, now: 3 })).column).toBe(12);
    expect(motion.sample(input({ row: 3, phase: 1, now: 1000 })).column).toBe(12);
    expect(motion.sample(input({ row: 6, phase: 1, now: 1100 })).column).toBe(0);
  });

  it("shows every selected preparation and landing cell before the next stage", () => {
    const clips = { 3: [6, 4, 2, 1], 6: [1, 2, 4, 5] };
    for (const row of [3, 6] as const) {
      const motion = createCompanionMotion({ clips });
      const seen = [0, .25, .5, .75, .99].map((phase, index) => motion.sample(input({ row, phase, now: index * 40 })).column);
      expect([...new Set(seen)]).toEqual(clips[row]);
    }
  });

  it("samples equal elapsed time and distance identically at60Hz and120Hz", () => {
    const sampleAtRate = (hz: number, row: number) => {
      const motion = createCompanionMotion();
      let pose = motion.sample(input({ row }));
      for (let step = 1; step <= hz * 2; step++) {
        const now = step * 1000 / hz;
        pose = motion.sample(input({ row, now, x: row === 2 ? 100 + now * .07 : 100 }));
      }
      return pose;
    };
    expect(sampleAtRate(60, 0)).toEqual(sampleAtRate(120, 0));
    expect(sampleAtRate(60, 2)).toEqual(sampleAtRate(120, 2));
  });

  it("removes procedural movement and loop advancement under reduced motion", () => {
    const motion = createCompanionMotion({ clips: { 2: [4, 5, 6] } });
    motion.sample(input({ row: 2, x: 0 }));
    const pose = motion.sample(input({ row: 2, x: 10, now: 1000, reduced: true }));
    expect(pose).toMatchObject({ column: 4, bob: 0, tilt: 0, scaleX: 1, scaleY: 1 });
  });

  it("keeps a single curated frame valid and rejects invalid atlas indices", () => {
    const motion = createCompanionMotion({ clips: { 0: [-1, 20, NaN, 4], 9: [] } });
    expect(motion.sample(input()).column).toBe(4);
    expect(motion.sample(input({ now: 100000 })).column).toBe(4);
    const invalid = motion.sample(input({ row: NaN, phase: NaN, x: NaN, y: NaN, now: NaN }));
    expect(Object.values(invalid).every(Number.isFinite)).toBe(true);
  });

  it("eases travel monotonically with quiet velocity and acceleration at both ends", () => {
    expect(sampleCompanionTravel(-1)).toBe(0); expect(sampleCompanionTravel(2)).toBe(1);
    expect(sampleCompanionTravel(NaN)).toBe(0); expect(sampleCompanionTravel(.5)).toBe(.5);
    const samples = Array.from({ length: 101 }, (_, i) => sampleCompanionTravel(i / 100));
    expect(samples.every((value, index) => index === 0 || value >= samples[index - 1])).toBe(true);
    const e = 1e-5;
    expect(sampleCompanionTravel(e) / e).toBeLessThan(.00001);
    expect((1 - sampleCompanionTravel(1 - e)) / e).toBeLessThan(.00001);
    expect(Math.abs((sampleCompanionTravel(2 * e) - 2 * sampleCompanionTravel(e)) / e ** 2)).toBeLessThan(.001);
  });

  it("allows the two new logical clips only when the renderer supplies rowCount18", () => {
    const clips = { 16: [0, 1, 2, 3, 4, 5, 6, 7], 17: [0, 1, 2, 3, 4, 5, 6, 7] };
    const legacy = createCompanionMotion({ clips });
    expect(legacy.sample(input({ row: 16 })).row).toBe(15);
    const native = createCompanionMotion({ clips, rowCount: 18 });
    expect(native.sample(input({ row: 16 })).column).toBe(0);
    expect(native.sample(input({ row: 16, phase: .5, now: 200 }))).toMatchObject({ row: 16, column: 4, scaleX: .986, scaleY: 1.026 });
    expect(native.sample(input({ row: 17, phase: 0, now: 400 })).row).toBe(17);
    const shaking = native.sample(input({ row: 17, phase: .25, now: 600 }));
    expect(shaking.column).toBe(2); expect(Math.abs(shaking.tilt)).toBeGreaterThan(1);
    expect(Object.values(native.sample(input({ row: 999, phase: 1, now: 800 }))).every(Number.isFinite)).toBe(true);
  });

  it("cycles explicitly authored walking frames forward while legacy clips keep ping-pong", () => {
    const frames = Array.from({ length: 8 }, (_, index) => index);
    const motion = createCompanionMotion({ clips: { 2: frames }, loopRows: [2] });
    const seen = Array.from({ length: 9 }, (_, step) => motion.sample(input({ row: 2, x: step * 10, now: step * 100 })).column);
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0]);
  });

  it("caps a16-frame native walk at14 authored changes per second without a catch-up dance", () => {
    const motion = createCompanionMotion({ clips: { 2: Array.from({ length: 16 }, (_, i) => i) }, loopRows: [2], maxFrameRate: 14 });
    let pose = motion.sample(input({ row: 2, x: 0 })), changes = 0;
    for (let frame = 1; frame <= 120; frame++) {
      const next = motion.sample(input({ row: 2, x: frame / 120 * 200, now: frame / 120 * 1000 }));
      if (next.column !== pose.column) changes++;
      pose = next;
    }
    expect(changes).toBe(14);
    expect(motion.sample(input({ row: 2, x: 200, now: 50000 }))).toEqual(pose);
  });

  it("carries a moving body's scalar pose across a clip change and settles within100ms", () => {
    const motion = createCompanionMotion();
    motion.sample(input({ row: 2, x: 0 }));
    motion.sample(input({ row: 2, x: 4, now: 40 }));
    const walking = motion.sample(input({ row: 2, x: 8, now: 80 }));
    expect(Math.abs(walking.bob)).toBeGreaterThan(.5);
    const resting = motion.sample(input({ row: 0, x: 8, now: 96 }));
    for (const key of ["bob", "scaleX", "scaleY", "tilt"] as const) expect(resting[key]).toBe(walking[key]);
    const next = motion.sample(input({ row: 0, x: 8, now: 97 }));
    expect(Math.abs(next.bob - resting.bob)).toBeLessThan(.05);
    expect(motion.sample(input({ row: 0, x: 8, now: 196 }))).toMatchObject({ bob: 0, scaleX: 1, scaleY: 1, tilt: 0 });
  });

  it("keeps a native capped walk identical at60Hz and120Hz", () => {
    const atRate = (hz: number) => {
      const motion = createCompanionMotion({ rowCount: 18, clips: { 2: Array.from({ length: 16 }, (_, i) => i) }, loopRows: [2] });
      let pose = motion.sample(input({ row: 2, x: 0 }));
      for (let frame = 1; frame <= hz * 2; frame++) pose = motion.sample(input({ row: 2, x: frame / hz * 70, now: frame / hz * 1000 }));
      return pose;
    };
    expect(atRate(60)).toEqual(atRate(120));
  });

  it("reduced motion cancels even an interrupted stretch or shake mixer immediately", () => {
    const motion = createCompanionMotion({ rowCount: 18 });
    motion.sample(input({ row: 17, phase: .25 }));
    motion.sample(input({ row: 17, phase: .25, now: 200 }));
    for (const row of [16, 17, 2, 0]) expect(motion.sample(input({ row, phase: .5, x: 200, now: 220 + row, reduced: true }))).toMatchObject({ column: 0, bob: 0, scaleX: 1, scaleY: 1, tilt: 0 });
  });
});
