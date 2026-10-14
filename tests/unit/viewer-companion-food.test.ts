import { describe, expect, it } from "vitest";
import { placeCompanionFood, reconcileCompanionFood } from "@/lib/ui/viewer-companion/food";
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
});
