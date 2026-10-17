import { describe, expect, it } from "vitest";
import { sampleCompanionSofaTravel } from "@/lib/ui/viewer-companion/sofa-travel";

const bed = { left: 100, right: 280, bodyHalfWidth: 36, ceiling: 100 };
const from = { x: 350, y: 460 }, to = { x: 190, y: 420 }, crest = 350;
const rims = [[bed.left - bed.bodyHalfWidth, bed.left + 31 + bed.bodyHalfWidth], [bed.right - 31 - bed.bodyHalfWidth, bed.right + bed.bodyHalfWidth]];

describe("measured sofa rim passage", () => {
  it("moves both axes along one parabola instead of three rectangular stages", () => {
    const frames = Array.from({ length: 121 }, (_, i) => sampleCompanionSofaTravel(from, to, i / 120, crest, bed));
    expect(frames.every(point => point.safe)).toBe(true);
    expect(frames[0]).toMatchObject(from); expect(frames.at(-1)).toMatchObject(to);
    // Horizontal motion starts and continues during ascent and descent. The
    // midpoint is a single instant, never a constant-height passage plateau.
    for (let i = 1; i < frames.length; i++) expect(frames[i].x).toBeLessThan(frames[i - 1].x);
    for (let i = 1; i < frames.length - 1; i++) {
      const acceleration = frames[i - 1].y - 2 * frames[i].y + frames[i + 1].y;
      expect(acceleration).toBeCloseTo(2 * frames[i].coefficient / 120 ** 2, 8);
      expect(acceleration).toBeGreaterThan(0);
    }
    expect(frames[12].x).not.toBe(from.x); expect(frames[108].x).not.toBe(to.x);
    expect(frames[48].y).not.toBe(frames[72].y);
  });

  it("keeps the complete body above the actual side rim while crossing it", () => {
    for (const [a, b] of [[from, to], [to, from]]) for (let i = 0; i <= 240; i++) {
      const point = sampleCompanionSofaTravel(a, b, i / 240, crest, bed);
      expect(point.safe).toBe(true);
      expect(point.y).toBeGreaterThanOrEqual(bed.ceiling - 1e-7);
      if (rims.some(([left, right]) => point.x >= left && point.x <= right)) expect(point.y).toBeLessThanOrEqual(crest + 1e-7);
    }
  });

  it("clears a92px body from the actual snug seat without a ceiling-breaking impulse", () => {
    const snug = { left: 52, right: 179, bodyHalfWidth: 92 * .38 + 3, ceiling: 100 };
    const seated = { x: 115.5, y: 420 }, outside = { x: 400, y: 500 }, clearance = 353;
    for (const [a, b] of [[seated, outside], [outside, seated]]) for (let i = 0; i <= 240; i++) {
      const point = sampleCompanionSofaTravel(a, b, i / 240, clearance, snug);
      expect(point.safe).toBe(true); expect(point.y).toBeGreaterThanOrEqual(snug.ceiling);
      if (i > 0 && i < 240) { expect(point.x).not.toBe(a.x); expect(point.x).not.toBe(b.x); }
    }
    // The sofa-side horizontal speed ramps continuously. Both coordinate
    // components remain quadratic; neither contains a separate hold/plateau.
    const samples = [.1, .2, .3, .4].map(p => sampleCompanionSofaTravel(seated, outside, p, clearance, snug));
    expect(samples[0].horizontal).toBeCloseTo(.01);
    expect(samples[1].x - 2 * samples[2].x + samples[3].x).toBeCloseTo(samples[0].x - 2 * samples[1].x + samples[2].x, 9);
  });

  it("mirrors both time and geometry without changing its support endpoints", () => {
    for (const p of [0, .05, .23, .5, .79, .95, 1]) {
      const forward = sampleCompanionSofaTravel(from, to, p, crest, bed), reverse = sampleCompanionSofaTravel(to, from, 1 - p, crest, bed);
      expect(reverse.x).toBeCloseTo(forward.x, 10); expect(reverse.y).toBeCloseTo(forward.y, 10);
      expect(reverse.safe).toBe(forward.safe);
      const moved = sampleCompanionSofaTravel({ x: from.x + 17, y: from.y + 29 }, { x: to.x + 17, y: to.y + 29 }, p, crest + 29,
        { ...bed, left: bed.left + 17, right: bed.right + 17, ceiling: bed.ceiling + 29 });
      expect(moved.x).toBeCloseTo(forward.x + 17, 10); expect(moved.y).toBeCloseTo(forward.y + 29, 10); expect(moved.safe).toBe(forward.safe);
    }
    expect(sampleCompanionSofaTravel(from, to, -1, crest, bed)).toMatchObject(from);
    expect(sampleCompanionSofaTravel(from, to, 2, crest, bed)).toMatchObject(to);
  });

  it("freezes a launched sofa shape when scrolling opens more headroom", () => {
    const a = { x: 190, y: 140 }, b = { x: 190, y: 160 }, clearance = 100;
    const launched = sampleCompanionSofaTravel(a, b, .5, clearance, bed);
    expect(launched.safe).toBe(true); expect(launched.coefficient).toBeCloseTo(160, 3);
    const fixed = { coefficient: launched.coefficient, curve: launched.curve };
    for (const p of [.1, .25, .5, .75, .9]) {
      const before = sampleCompanionSofaTravel(a, b, p, clearance, bed, fixed);
      const after = sampleCompanionSofaTravel({ x: a.x, y: a.y + 100 }, { x: b.x, y: b.y + 100 }, p, clearance + 100, bed, fixed);
      expect(after.safe).toBe(true); expect(after.coefficient).toBe(fixed.coefficient); expect(after.curve).toBe(fixed.curve);
      expect(after.x).toBe(before.x); expect(after.y).toBeCloseTo(before.y + 100, 10);
    }
    const replanned = sampleCompanionSofaTravel({ x: a.x, y: a.y + 100 }, { x: b.x, y: b.y + 100 }, .5, clearance + 100, bed);
    expect(replanned.y).toBeLessThan(launched.y + 100 - 19);
  });

  it("marks an unsafe carried sofa flight for recovery without changing its coefficient or curve", () => {
    const launched = sampleCompanionSofaTravel(from, to, .5, crest, bed);
    const fixed = { coefficient: launched.coefficient, curve: launched.curve };
    const moved = sampleCompanionSofaTravel({ x: from.x, y: from.y - 260 }, { x: to.x, y: to.y - 260 }, .5, crest - 260, bed, fixed);
    expect(moved.safe).toBe(false); expect(moved.coefficient).toBe(fixed.coefficient); expect(moved.curve).toBe(fixed.curve);
    expect(moved.x).toBe(launched.x); expect(moved.y).toBeCloseTo(launched.y - 260, 10);
    const changedClassification = sampleCompanionSofaTravel(from, to, .5, crest, { ...bed, left: 500, right: 680 }, fixed);
    expect(changedClassification.curve).toBe(fixed.curve); expect(changedClassification.x).toBe(launched.x);
  });

  it("reports impossible ceiling or already intersecting endpoints instead of hiding a forced jump", () => {
    const cramped = { ...bed, ceiling: 340 };
    expect(sampleCompanionSofaTravel(from, to, .5, crest, cramped).safe).toBe(false);
    for (let i = 0; i <= 120; i++) expect(sampleCompanionSofaTravel(from, to, i / 120, crest, cramped).y).toBeGreaterThanOrEqual(cramped.ceiling);
    const intersecting = { x: 250, y: 450 };
    expect(sampleCompanionSofaTravel(intersecting, to, 0, crest, bed).safe).toBe(false);
    expect(sampleCompanionSofaTravel(to, intersecting, 1, crest, bed).safe).toBe(false);
  });

  it("keeps a same-x contained lift continuous and rejects a same-x wall crossing", () => {
    for (let i = 0; i <= 120; i++) {
      const point = sampleCompanionSofaTravel(to, { ...to, y: 260 }, i / 120, crest, bed);
      expect(point.safe).toBe(true); expect(point.x).toBe(to.x);
    }
    expect(sampleCompanionSofaTravel({ x: 250, y: 450 }, { x: 250, y: 260 }, .5, crest, bed).safe).toBe(false);
  });

  it("uses a continuous unconstrained arc when only the old clearance contract is available", () => {
    for (let i = 0; i <= 120; i++) {
      const p = i / 120, point = sampleCompanionSofaTravel(from, to, p, crest);
      expect(point.safe).toBe(true); expect(point.horizontal).toBe(p);
      expect(point.x).toBe(from.x + (to.x - from.x) * p);
      expect(point.y).toBe(from.y + (to.y - from.y) * p - point.coefficient * p * (1 - p));
    }
    expect(sampleCompanionSofaTravel(from, to, .5, crest).y).toBe(crest);
  });

  it("fails closed for invalid measured furniture without treating it as a proved path", () => {
    for (const change of [{ right: 0 }, { bodyHalfWidth: 0 }, { left: NaN }, { ceiling: Infinity }]) expect(sampleCompanionSofaTravel(from, to, .4, crest, { ...bed, ...change }).safe).toBe(false);
    expect(sampleCompanionSofaTravel({ x: NaN, y: 1 }, to, .4, crest, bed).safe).toBe(false);
    expect(sampleCompanionSofaTravel(from, to, .4, Infinity, bed).safe).toBe(false);
  });
});
