import { describe, expect, it } from "vitest";
import { planCompanionDispenserEjection, planCompanionFoodToss } from "@/lib/ui/viewer-companion/food-toss";
import { createCompanionFoodToss } from "@/lib/ui/viewer-companion/food-gravity";
import type { CompanionFood, Platform } from "@/lib/ui/viewer-companion/brain";
import type { CompanionFoodDropSupport } from "@/lib/ui/viewer-companion/food";

const viewport = { width: 1000, height: 800 };
const food: CompanionFood = Object.freeze({ id: "one", kind: "apple", x: 200, y: 300, platformId: "origin" });
const floor: Platform = { id: "viewport-floor-food", kind: "floor", x: 24, y: 770, width: 952 };
const from = { x: 190, y: 300 };

describe("physical companion snack throws", () => {
  it("ejects from the actual studio outlet onto an accessible room floor instead of the distant screen floor", () => {
    const outlet = { ...food, x: 264.515625, y: 421.46875 };
    const stance = { x: 172.25875, y: 430.65625 };
    const room: CompanionFoodDropSupport = { id: "companion-home-floor-food", kind: "floor", x: 41, y: stance.y, width: 179 };
    const screen = { ...floor, y: 1082, width: 1872 };
    const plan = planCompanionDispenserEjection(outlet, stance, [screen, room], { width: 1920, height: 1100 })!;
    expect(plan.food.platformId).toBe(room.id); expect(plan.food.x).toBeLessThan(outlet.x);
    expect(plan.food.x).toBeGreaterThanOrEqual(room.x); expect(plan.food.x).toBeLessThanOrEqual(room.x + room.width);
    expect(Math.abs(plan.food.x - stance.x)).toBeLessThanOrEqual(36); expect(plan.food.y).toBe(stance.y);
    const flight = createCompanionFoodToss(outlet, plan.food, 100, plan), contactAt = flight.duration - 240;
    expect(flight.sample(100)).toMatchObject({ x: outlet.x, y: outlet.y, active: true });
    expect(flight.sample(100 + contactAt / 2).y).toBeLessThan(outlet.y);
    expect(flight.sample(100 + contactAt)).toMatchObject({ x: plan.contactX, y: stance.y });
    expect(flight.sample(100 + flight.duration)).toMatchObject({ x: plan.food.x, y: stance.y, active: false });
  });
  it("never ejects through an earlier card, onto a sofa, across a missing floor or outside the actual stance's reach", () => {
    const outlet = { ...food, x: 264.515625, y: 421.46875 }, stance = { x: 172.25875, y: 430.65625 };
    const room: CompanionFoodDropSupport = { id: "companion-home-floor-food", kind: "floor", x: 41, y: stance.y, width: 179 };
    const view = { width: 1920, height: 1100 };
    const earlier: CompanionFoodDropSupport = { id: "earlier-card", kind: "card", x: 24, y: 425, width: 400 };
    for (const supports of [[floor], [{ ...room, id: "companion-home" }], [{ ...room, kind: "card" as const }], [{ ...room, y: stance.y + .51 }], [earlier, room]]) {
      expect(planCompanionDispenserEjection(outlet, stance, supports, view)).toBeUndefined();
    }
    expect(planCompanionDispenserEjection(outlet, { ...stance, x: 80 }, [room], view)).toBeUndefined();
    expect(planCompanionDispenserEjection(outlet, { ...stance, x: NaN }, [room], view)).toBeUndefined();
    expect(planCompanionDispenserEjection(outlet, stance, Array.from({ length: 200 }, (_, index) => ({ ...floor, id: `off-${index}`, x: 1500 })).concat(room), view)).toBeUndefined();
  });
  it("lands on the first descending crossed ledge rather than the destination/floor", () => {
    const near: Platform = { id: "first", kind: "card", x: 210, y: 340, width: 160 };
    const lower: Platform = { id: "lower", kind: "card", x: 180, y: 460, width: 300 };
    const plan = planCompanionFoodToss(food, from, 1, [floor, lower, near], viewport)!;
    expect(plan.food.platformId).toBe("first"); expect(plan.food.x).toBeGreaterThan(food.x); expect(plan.food.y).toBe(340);
    const flight = createCompanionFoodToss(food, plan.food, 100, plan), contactAt = flight.duration - 240;
    expect(flight.sample(100)).toMatchObject({ x: food.x, y: food.y, active: true });
    expect(flight.sample(100 + contactAt)).toMatchObject({ x: plan.contactX, y: near.y });
    for (let age = 0; age < contactAt; age += 1) expect(flight.sample(100 + age).y).toBeLessThan(near.y);
    expect(flight.sample(100 + flight.duration)).toEqual({ x: plan.food.x, y: near.y, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, active: false });
  });
  it("crosses the real card even at a control gap, then slides only onto that card's safe span", () => {
    const card: CompanionFoodDropSupport = { id: "card-safe", kind: "card", x: 290, width: 30, y: 340, dropSurface: { x: 200, width: 120 } };
    const plan = planCompanionFoodToss(food, from, 1, [floor, card], viewport)!;
    expect(plan.food.platformId).toBe(card.id); expect(plan.contactX).toBeLessThan(card.x); expect(plan.food.x).toBe(card.x);
    const flight = createCompanionFoodToss(food, plan.food, 0, plan), at = flight.duration - 240;
    expect(flight.sample(at).x).toBe(plan.contactX); expect(flight.sample(at + 80).x).toBeGreaterThan(plan.contactX); expect(flight.sample(at + 160).x).toBe(card.x);
  });
  it("does not attract an arc to another column or a higher uncrossed ledge", () => {
    const offRay: Platform = { id: "other-column", kind: "card", x: 700, width: 100, y: 340 };
    const tooHigh: Platform = { id: "above-apex", kind: "card", x: 150, width: 300, y: 260 };
    expect(planCompanionFoodToss(food, from, 1, [floor, offRay, tooHigh], viewport)?.food.platformId).toBe(floor.id);
    expect(planCompanionFoodToss(food, from, 1, [offRay, tooHigh], viewport)).toBeUndefined();
  });
  it("can catch a reachable upper ledge only after the peak, with no rectangular jump", () => {
    const ledge: Platform = { id: "slightly-above", kind: "card", x: 220, width: 100, y: 285 };
    const plan = planCompanionFoodToss(food, from, 1, [floor, ledge], viewport)!;
    expect(plan.food.platformId).toBe(ledge.id);
    const flight = createCompanionFoodToss(food, plan.food, 0, plan), at = flight.duration - 240;
    const samples = Array.from({ length: 101 }, (_, i) => flight.sample(at * i / 100));
    const peak = samples.reduce((best, pose, i) => pose.y < samples[best].y ? i : best, 0);
    expect(peak).toBeGreaterThan(10); expect(peak).toBeLessThan(90);
    expect(samples[peak].y).toBeLessThan(ledge.y); expect(samples[peak].x).toBeGreaterThan(food.x);
    expect(samples[peak + 1].y).toBeGreaterThan(samples[peak].y);
  });
  it("preserves source translation and the clock, and is sampling-rate independent", () => {
    const plan = planCompanionFoodToss(food, from, 2, [floor], viewport)!;
    const a = createCompanionFoodToss(food, plan.food, 500, plan), b = createCompanionFoodToss(food, plan.food, 500, plan);
    for (let i = 0; i < 90; i++) { b.sample(500 + (i * 2 + 1) * 1000 / 120); expect(b.sample(500 + (i + 1) * 1000 / 60)).toEqual(a.sample(500 + (i + 1) * 1000 / 60)); }
    const original = a.sample(650), shifted = a.sample(650, { x: plan.food.x - 12, y: plan.food.y - 90 });
    expect(shifted.x).toBeCloseTo(original.x - 12); expect(shifted.y).toBeCloseTo(original.y - 90); expect(shifted.active).toBe(original.active);
    expect(a.sample(500 + a.duration, { x: plan.food.x - 12, y: plan.food.y - 90 })).toMatchObject({ x: plan.food.x - 12, y: plan.food.y - 90, active: false });
  });
  it("keeps all visible-flight x coordinates inside viewport input bounds at either wall", () => {
    for (const x of [24, 25, 100, 500, 975, 976]) for (const strength of [1, 2, 3]) for (const away of [0, 1000]) {
      const start = { ...food, x }, plan = planCompanionFoodToss(start, { x: away, y: 300 }, strength, [floor], viewport)!;
      const flight = createCompanionFoodToss(start, plan.food, 0, plan);
      for (let at = 0; at <= flight.duration; at += 8) { const pose = flight.sample(at); expect(pose.x).toBeGreaterThanOrEqual(24 - 1e-8); expect(pose.x).toBeLessThanOrEqual(976 + 1e-8); expect(pose.y).toBeGreaterThanOrEqual(8); }
      expect(flight.duration).toBeLessThanOrEqual(1640);
    }
  });
  it("rejects sofas, stale/protected floors, invalid supports and malformed inputs without making a recipient", () => {
    const invalid: CompanionFoodDropSupport[] = [
      { ...floor, id: "companion-home" }, { ...floor, id: "companion-home-bed-food-2" },
      { ...floor, y: 300 }, { ...floor, x: -1 }, { ...floor, width: Infinity }, { ...floor, y: 790 },
    ];
    expect(planCompanionFoodToss(food, from, 1, invalid, viewport)).toBeUndefined();
    for (const bad of [{ ...food, x: NaN }, { ...food, y: Infinity }, { ...food, y: -1 }]) expect(planCompanionFoodToss(bad, from, 1, [floor], viewport)).toBeUndefined();
    expect(planCompanionFoodToss(food, { x: NaN, y: 0 }, 1, [floor], viewport)).toBeUndefined();
    expect(planCompanionFoodToss(food, from, 1, [floor], { width: 30, height: 800 })).toBeUndefined();
    const still = createCompanionFoodToss(food, { x: 300, y: 0 }, NaN, { height: 1, contactX: 300 });
    expect(still.duration).toBe(0); expect(still.sample(NaN)).toMatchObject({ x: food.x, y: food.y, active: false });
    expect(planCompanionFoodToss(food, from, Infinity, [floor], viewport)).toEqual(planCompanionFoodToss(food, from, 1, [floor], viewport));
  });
});
