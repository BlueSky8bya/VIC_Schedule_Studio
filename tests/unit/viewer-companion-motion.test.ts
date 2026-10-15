import { describe, expect, it } from "vitest";
import { createCompanionMotion, nextCompanionPaint, type CompanionMotionInput } from "@/lib/ui/viewer-companion/motion";

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
});
