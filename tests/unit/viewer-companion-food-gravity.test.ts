import { describe, expect, it } from "vitest";
import { createCompanionFoodGravity } from "@/lib/ui/viewer-companion/food-gravity";
import { attachCompanionFood, followCompanionFood, placeCompanionFood } from "@/lib/ui/viewer-companion/food";

const start = { x: 200, y: 100 }, end = { x: 200, y: 700 };

describe("finite companion food gravity", () => {
  it("starts at the actual released point and accelerates between equal time intervals", () => {
    const drop = createCompanionFoodGravity(start, end, 1000), fall = drop.duration - 240;
    expect(drop.sample(1000)).toMatchObject({ ...start, scaleX: 1, scaleY: 1, active: true });
    const a = drop.sample(1000 + fall * .25), b = drop.sample(1000 + fall * .5), c = drop.sample(1000 + fall * .75);
    expect(a.y).toBeGreaterThan(start.y); expect(b.y - a.y).toBeGreaterThan(a.y - start.y); expect(c.y - b.y).toBeGreaterThan(b.y - a.y);
    expect([a.x, b.x, c.x]).toEqual([start.x, start.x, start.x]);
  });
  it("ends on the exact real target with no residual squash, rotation or activity", () => {
    const drop = createCompanionFoodGravity(start, end, 1000);
    expect(drop.sample(1000 + drop.duration)).toEqual({ ...end, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, active: false });
    expect(drop.sample(1000 + drop.duration - .01).active).toBe(true);
    expect(drop.sample(1e9)).toEqual(drop.sample(1000 + drop.duration));
  });
  it("has one small impact and bounded bounce while keeping the logical endpoints unchanged", () => {
    const from = Object.freeze({ ...start }), target = Object.freeze({ ...end });
    const drop = createCompanionFoodGravity(from, target, 0), fall = drop.duration - 240;
    const impact = drop.sample(fall + 40), bounce = drop.sample(fall + 160);
    expect(impact.y).toBe(end.y); expect(impact.scaleY).toBeLessThan(1); expect(impact.scaleX).toBeGreaterThan(1);
    expect(bounce.y).toBeLessThan(end.y); expect(bounce.y).toBeGreaterThanOrEqual(end.y - 4);
    for (let at = fall; at < drop.duration; at += 8) {
      const sample = drop.sample(at);
      expect(sample.y).toBeGreaterThanOrEqual(end.y - 4); expect(sample.y).toBeLessThanOrEqual(end.y);
      expect(sample.scaleY).toBeGreaterThanOrEqual(.87); expect(sample.scaleY).toBeLessThanOrEqual(1.035);
    }
    expect(from).toEqual(start); expect(target).toEqual(end);
  });
  it("carries source scrolling and reflow without resetting the same flight clock", () => {
    const drop = createCompanionFoodGravity(start, end, 20), now = 250;
    const original = drop.sample(now), carried = drop.sample(now, { x: end.x - 12, y: end.y - 90 });
    expect(carried.x).toBeCloseTo(original.x - 12); expect(carried.y).toBeCloseTo(original.y - 90);
    expect(carried.active).toBe(original.active); expect(carried.scaleY).toBe(original.scaleY);
    expect(drop.sample(20 + drop.duration, { x: 188, y: 610 })).toMatchObject({ x: 188, y: 610, active: false });
  });
  it("returns the same shared-time pose at 60 and 120Hz and never depends on sampling history", () => {
    const slow = createCompanionFoodGravity(start, end, 0), fast = createCompanionFoodGravity(start, end, 0);
    for (let i = 0; i < 100; i++) {
      fast.sample((i * 2 + 1) * 1000 / 120);
      expect(fast.sample((i + 1) * 1000 / 60)).toEqual(slow.sample((i + 1) * 1000 / 60));
    }
    expect(slow.sample(300)).toEqual(slow.sample(300));
  });
  it("keeps small horizontal attraction inside the two real endpoint coordinates", () => {
    const drop = createCompanionFoodGravity(start, { x: 220, y: 400 }, 0);
    for (let at = 0; at < drop.duration; at += 8) {
      const sample = drop.sample(at);
      expect(sample.x).toBeGreaterThanOrEqual(200); expect(sample.x).toBeLessThanOrEqual(220);
    }
  });
  it("does not manufacture upward falls or run a loop for an already settled point", () => {
    const still = createCompanionFoodGravity(end, end, 0), above = createCompanionFoodGravity(end, start, 0);
    expect(still.duration).toBe(0); expect(above.duration).toBe(0);
    expect(still.sample(0)).toMatchObject({ ...end, active: false }); expect(above.sample(0)).toMatchObject({ ...end, active: false });
  });
  it("caps a very long fall and safely handles invalid clocks and overflowing inputs", () => {
    const drop = createCompanionFoodGravity(start, { x: 200, y: 100000 }, 0);
    expect(drop.duration).toBeLessThanOrEqual(1440); expect(drop.sample(1440).active).toBe(false);
    expect(drop.sample(-100)).toMatchObject({ ...start, active: true }); expect(drop.sample(NaN).active).toBe(false);
    const overflow = createCompanionFoodGravity({ x: 0, y: -Number.MAX_VALUE }, { x: 0, y: Number.MAX_VALUE }, Infinity);
    expect(overflow.duration).toBe(0);
    const bad = createCompanionFoodGravity({ x: NaN, y: Infinity }, { x: NaN, y: 0 }, NaN).sample(Infinity);
    expect(Object.values(bad).every(value => typeof value !== "number" || Number.isFinite(value))).toBe(true);
  });
  it("continuously falls from an unsupported release to the retained world floor without an instant teleport", () => {
    const from = Object.freeze({ x: 200, y: 260 });
    const food = placeCompanionFood({ id: "apple", kind: "apple", ...from }, from, [], { width: 1000, height: 800 });
    expect(food).toMatchObject({ ...from, y: 844 }); expect(food.platformId).toBeUndefined();
    const drop = createCompanionFoodGravity(from, food, 1000), fall = drop.duration - 240;
    expect(drop.duration).toBeGreaterThan(0); expect(drop.duration).toBeLessThanOrEqual(1440);
    expect(drop.sample(1000)).toMatchObject({ ...from, active: true });
    const a = drop.sample(1000 + fall * .25), b = drop.sample(1000 + fall * .5), c = drop.sample(1000 + fall * .75);
    expect(a.y).toBeGreaterThan(from.y); expect(c.y).toBeLessThan(food.y);
    expect(b.y - a.y).toBeGreaterThan(a.y - from.y); expect(c.y - b.y).toBeGreaterThan(b.y - a.y);
    expect(drop.sample(1000 + drop.duration)).toEqual({ x: food.x, y: food.y, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, active: false });
  });
  it("carries that unsupported world floor through scrolling and resumes a caught fall from its actual drawing", () => {
    const from = { x: 200, y: 260 }, viewport = { width: 1000, height: 800 };
    const food = placeCompanionFood({ id: "apple", kind: "apple", ...from }, from, [], viewport);
    const attachment = attachCompanionFood(food, { x: 0, y: 120 });
    const drop = createCompanionFoodGravity(from, food, 0), at = 200;
    const shown = drop.sample(at), target = followCompanionFood(attachment, { x: 0, y: 220 }).point;
    expect(drop.sample(at, target).y).toBeCloseTo(shown.y - 100);
    const caught = drop.sample(at, target), placed = placeCompanionFood(food, caught, [], viewport);
    const resumed = createCompanionFoodGravity(caught, placed, at);
    expect(resumed.sample(at)).toMatchObject({ x: caught.x, y: caught.y, active: true });
    expect(resumed.sample(at + 60).y).toBeGreaterThan(caught.y);
    expect(resumed.sample(at + resumed.duration)).toMatchObject({ x: placed.x, y: placed.y, active: false });
  });
});
