import { describe, expect, it } from "vitest";
import { COMPANION_TRASH_DISCARD_MS, COMPANION_TRASH_DWELL_MS, companionTrashProgress, placeCompanionFood, presentCompanionFood, reconcileCompanionFood } from "@/lib/ui/viewer-companion/food";
import type { CompanionFood, Platform } from "@/lib/ui/viewer-companion/brain";

const floor: Platform = { id: "floor", x: 12, y: 782, width: 976, kind: "floor" };
const card: Platform = { id: "card", x: 100, y: 350, width: 200, kind: "card" };
const apple: CompanionFood = { id: "apple", x: 200, y: 340, kind: "apple" };

describe("companion food support", () => {
  it("lands on a ledge instead of covering its text and keeps only explicit snack fields", () => {
    const placed = placeCompanionFood(apple, apple, [floor, card]);
    expect(placed).toEqual({ id: "apple", kind: "apple", x: 200, y: 350, platformId: "card" });
    expect(placeCompanionFood(apple, { x: 200, y: 400 }, [floor, card]).platformId).toBe("floor");
  });
  it("drops to the floor when its card disappears and follows a moving support", () => {
    const placed = placeCompanionFood(apple, apple, [floor, card]);
    expect(reconcileCompanionFood(placed, [floor])).toEqual({ ...placed, y: 782, platformId: "floor" });
    expect(reconcileCompanionFood(placed, [floor, { ...card, x: 250, y: 420 }])).toEqual({ ...placed, x: 262, y: 420 });
  });
  it("keeps either fruit inside the visible supporting rail", () => {
    expect(placeCompanionFood({ ...apple, kind: "lemon" }, { x: 0, y: 800 }, [floor]).x).toBe(24);
    expect(placeCompanionFood(apple, { x: 9999, y: 800 }, [floor]).x).toBe(976);
  });
  it("uses a real safe ledge when mobile controls leave no usable floor", () => {
    expect(placeCompanionFood(apple, { x: 200, y: 800 }, [card])).toEqual({ id: "apple", kind: "apple", x: 200, y: 350, platformId: "card" });
  });
});

describe("companion food presentation", () => {
  const mouth = { x: 420, y: 260 };
  it("lifts the presentation to the mouth without moving its logical support", () => {
    const food = Object.freeze({ ...apple, platformId: "card" });
    expect(presentCompanionFood(food, 0, mouth)).toEqual({ x: 200, y: 340, scale: 1, rotation: 0 });
    const halfway = presentCompanionFood(food, .12, mouth);
    expect(halfway.x).toBeGreaterThan(food.x);
    expect(halfway.x).toBeLessThan(mouth.x);
    expect(halfway.y).toBeLessThan((food.y + mouth.y + 16) / 2);
    const arrived = presentCompanionFood(food, .24, mouth);
    expect(arrived.x).toBe(424); expect(arrived.y).toBeCloseTo(276);
    expect(food).toEqual({ ...apple, platformId: "card" });
  });
  it("chews and shrinks after arrival while keeping the fruit inside the mouth area", () => {
    const poses = Array.from({ length: 77 }, (_, i) => presentCompanionFood(apple, .24 + i / 100, mouth));
    expect(new Set(poses.map(pose => pose.rotation.toFixed(2))).size).toBeGreaterThan(20);
    expect(poses.every(pose => Math.abs(pose.x - 424) < .001 && Math.abs(pose.y - 276) <= .801)).toBe(true);
    expect(poses.at(-1)!.scale).toBeCloseTo(.28);
    expect(poses.every(pose => pose.scale >= .25 && pose.scale <= 1.02)).toBe(true);
  });
  it("mirrors the small approach offset, freezes reduced motion, and safely clamps bad progress", () => {
    expect(presentCompanionFood(apple, .24, mouth, -1).x).toBe(416);
    expect(presentCompanionFood(apple, .7, mouth, -1, true)).toEqual({ x: 416, y: 276, scale: 1, rotation: 0 });
    expect(presentCompanionFood(apple, NaN, mouth)).toEqual(presentCompanionFood(apple, 0, mouth));
    expect(presentCompanionFood(apple, -8, mouth)).toEqual(presentCompanionFood(apple, 0, mouth));
    expect(presentCompanionFood(apple, 8, mouth)).toEqual(presentCompanionFood(apple, 1, mouth));
    expect(presentCompanionFood(apple, 1, { x: NaN, y: 3 })).toEqual({ x: apple.x, y: apple.y, scale: .28, rotation: 0 });
    expect(presentCompanionFood(apple, .5).scale).toBeCloseTo(.64);
  });
  it("requires a deliberate trash dwell, with a separate finite discard", () => {
    expect(COMPANION_TRASH_DWELL_MS).toBe(320); expect(COMPANION_TRASH_DISCARD_MS).toBe(180);
    expect(companionTrashProgress(-1)).toBe(0); expect(companionTrashProgress(NaN)).toBe(0);
    expect(companionTrashProgress(160)).toBe(.5); expect(companionTrashProgress(319)).toBeLessThan(1);
    expect(companionTrashProgress(320)).toBe(1); expect(companionTrashProgress(900)).toBe(1);
  });
});
