import { describe, expect, it } from "vitest";
import { accessibleCompanionFoods } from "@/lib/ui/viewer-companion/food-access";
import { COMPANION_HOME_BED_FOOD, COMPANION_HOME_FLOOR_FOOD, MAX_COMPANION_FOOD } from "@/lib/ui/viewer-companion/food";
import { createBrain, getFoodAction } from "@/lib/ui/viewer-companion/brain";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import type { CompanionFood, Platform } from "@/lib/ui/viewer-companion/brain";

const food: CompanionFood = { id: "snack", x: 150, y: 300, platformId: "card-3-food-top-1", kind: "apple" };
const top: Platform = { id: "card-3-top-2", x: 120, y: 300, width: 70, kind: "card", manualOnly: true };

describe("snack collision and creature access remain separate", () => {
  it("eats a real house-floor snack from its separate manual support without moving its physical position", () => {
    const snack = Object.freeze({ ...food, platformId: COMPANION_HOME_FLOOR_FOOD });
    const floor: Platform = { ...top, id: "companion-home-floor-1", kind: "floor" };
    const available = accessibleCompanionFoods([snack], [floor]);
    expect(available).toEqual([{ ...snack, platformId: floor.id }]);
    expect(snack).toEqual({ ...food, platformId: COMPANION_HOME_FLOOR_FOOD });
    expect(getFoodAction({ ...createBrain(0), hunger: .8 }, { x: 150, y: 300, platformId: floor.id, platforms: [floor], foods: available, width: 1000, height: 800 }, { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false }, 1000)).toMatchObject({ kind: "eat", foodId: snack.id, target: { x: 150, y: 300, platformId: floor.id } });
  });
  it("never projects house-floor food onto a bed, a distant floor span or a stale/different plane", () => {
    const snack = { ...food, platformId: COMPANION_HOME_FLOOR_FOOD }, floor: Platform = { ...top, id: "companion-home-floor", kind: "floor" };
    expect(accessibleCompanionFoods([snack], [])).toEqual([]);
    expect(accessibleCompanionFoods([snack], [{ ...floor, id: "companion-home" }, { ...floor, id: "viewport-floor" }])).toEqual([]);
    expect(accessibleCompanionFoods([snack], [{ ...floor, x: 151 }, { ...floor, y: 300.6 }, { ...floor, manualOnly: false }])).toEqual([]);
    expect(accessibleCompanionFoods([snack], [{ ...floor, id: "companion-home-floor-extra" }])).toEqual([]);
    expect(accessibleCompanionFoods([snack], [{ ...floor, y: 300.4 }])).toEqual([{ ...snack, platformId: floor.id }]);
  });
  it("offers a manually placed bed snack from an actual safe home without moving the visible food", () => {
    const snack = Object.freeze({ ...food, x: 150, y: 312, platformId: COMPANION_HOME_BED_FOOD });
    const home = { ...top, id: "companion-home", kind: "date" as const, manualOnly: false };
    const available = accessibleCompanionFoods([snack], [home]);
    expect(available).toEqual([{ ...snack, y: 300, platformId: home.id }]);
    expect(snack).toMatchObject({ x: 150, y: 312, platformId: COMPANION_HOME_BED_FOOD });
    expect(getFoodAction({ ...createBrain(0), hunger: .8 }, { x: 150, y: 300, platformId: home.id, platforms: [home], foods: available, width: 1000, height: 800 }, { ...DEFAULT_COMPANION_PREFERENCES, enabled: true }, 1000)).toMatchObject({ kind: "eat", foodId: snack.id, target: { x: 150, y: 300, platformId: home.id } });
  });
  it("withholds unreachable bed food and never invents a home while folded or too narrow/far", () => {
    const snack = { ...food, platformId: COMPANION_HOME_BED_FOOD };
    const home = { ...top, id: "companion-home", kind: "date" as const, manualOnly: false };
    expect(accessibleCompanionFoods([snack], [])).toEqual([]);
    expect(accessibleCompanionFoods([snack], [top])).toEqual([]);
    expect(accessibleCompanionFoods([{ ...snack, y: 318 }], [home])).toHaveLength(1);
    expect(accessibleCompanionFoods([{ ...snack, y: 318.1 }], [home])).toEqual([]);
    expect(accessibleCompanionFoods([{ ...snack, x: 95 }], [home])).toEqual([]);
    expect(accessibleCompanionFoods([snack], [{ ...home, x: 190, width: 2 }])).toEqual([]);
  });
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
    const snacks = Object.freeze(Array.from({ length: MAX_COMPANION_FOOD + 2 }, (_, i) => Object.freeze({ ...food, id: `snack-${i + 1}` })));
    const available = accessibleCompanionFoods(snacks, [top]);
    expect(available.map(item => item.id)).toEqual(snacks.slice(0, MAX_COMPANION_FOOD).map(item => item.id));
    expect(available.slice(3).map(item => item.platformId)).toEqual(Array(MAX_COMPANION_FOOD - 3).fill(top.id));
    expect(snacks.every(item => item.platformId === food.platformId)).toBe(true);
    expect(accessibleCompanionFoods([food], [{ ...top, width: Infinity }])).toEqual([]);
  });
});
