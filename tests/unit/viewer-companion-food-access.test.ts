import { describe, expect, it } from "vitest";
import { accessibleCompanionFoods } from "@/lib/ui/viewer-companion/food-access";
import type { CompanionFood, Platform } from "@/lib/ui/viewer-companion/brain";

const food: CompanionFood = { id: "snack", x: 150, y: 300, platformId: "card-3-food-top-1", kind: "apple" };
const top: Platform = { id: "card-3-top-2", x: 120, y: 300, width: 70, kind: "card", manualOnly: true };

describe("snack collision and creature access remain separate", () => {
  it("maps only a matching anonymous card top with a real pet-safe x and height", () => {
    const result = accessibleCompanionFoods([food], [top]);
    expect(result).toEqual([{ ...food, platformId: top.id }]);
    expect(food.platformId).toBe("card-3-food-top-1"); expect(result[0]).not.toBe(food);
    expect(accessibleCompanionFoods([food], [{ ...top, id: "card-30-top-2" }])).toEqual([]);
    expect(accessibleCompanionFoods([food], [{ ...top, id: "card-3-top-extra" }])).toEqual([]);
    expect(accessibleCompanionFoods([food], [{ ...top, x: 170 }])).toEqual([]);
    expect(accessibleCompanionFoods([food], [{ ...top, y: 302 }])).toEqual([]);
  });

  it("keeps food physically placeable while withholding a target that only the smaller food can fit", () => {
    const snapshot = { ...food };
    expect(accessibleCompanionFoods([food], [{ ...top, width: 10 }])).toEqual([]);
    expect(food).toEqual(snapshot);
    expect(accessibleCompanionFoods([food], [{ ...top, y: 300.4 }])).toHaveLength(1);
  });

  it("maps home and floor food only onto an actual matching safe support, never a nearby replacement", () => {
    const home = { ...food, platformId: "companion-home-food" }, floor = { ...food, platformId: "viewport-floor-food-1" };
    const homeSupport = { ...top, id: "companion-home", kind: "date" as const };
    const floorSupport = { ...top, id: "viewport-floor-3", kind: "floor" as const };
    expect(accessibleCompanionFoods([home], [homeSupport])[0].platformId).toBe(homeSupport.id);
    expect(accessibleCompanionFoods([floor], [floorSupport])[0].platformId).toBe(floorSupport.id);
    expect(accessibleCompanionFoods([home], [floorSupport, top])).toEqual([]);
    expect(accessibleCompanionFoods([floor], [homeSupport, top])).toEqual([]);
    expect(accessibleCompanionFoods([home], [{ ...homeSupport, x: 151 }])).toEqual([]);
  });

  it("ignores unplaced/malformed snacks and caps the already bounded working set", () => {
    expect(accessibleCompanionFoods([{ ...food, platformId: undefined }, { ...food, x: NaN }, food], [top])).toEqual([{ ...food, platformId: top.id }]);
    expect(accessibleCompanionFoods(Array.from({ length: 10 }, (_, i) => ({ ...food, id: `snack-${i}` })), [top])).toHaveLength(3);
    expect(accessibleCompanionFoods([food], [{ ...top, width: Infinity }])).toEqual([]);
  });
});
