import { describe, expect, it } from "vitest";
import { commitAction, createBrain, findPlatformRoute, getFoodAction, platformLandingX, type CompanionFood, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

// The live131 studio pantry diagnostic: body92 has one real continuous safe
// home span, while the44px snack can sit36px beyond its last landing centre.
const floor: Platform = { id: "companion-home-floor", kind: "floor", manualOnly: true, x: 50, y: 454.578125, width: 122.64937499999999 };
const origin = { x: 83, y: floor.y, platformId: floor.id };
const food: CompanionFood = { id: "observed", kind: "melon", x: 196.649, y: 454.578, platformId: floor.id };
const preferences = { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: true, feeding: true, jump: false };

describe("131 explicit meal on the same measured manual home floor", () => {
  it("walks the actual fractional safe span without a jump, rounded floor or food relocation", () => {
    const before = structuredClone({ floor, origin, food });
    const target = { x: 160.649375, y: floor.y, platformId: floor.id };
    expect(findPlatformRoute(origin, food, [floor], false, floor.id)).toEqual([{ kind: "walk", target }]);
    expect(target.x).toBe(platformLandingX(floor, food.x));
    expect({ floor, origin, food }).toEqual(before);
  });

  it("offers a real walk then eats at the arrived mouth stance with the same remembered meal", () => {
    const brain = { ...createBrain(0, () => .5), hunger: .5, energy: .98 };
    const world: CompanionWorld = { ...origin, platforms: [floor], foods: [food], width: 2400, height: 1100, animated: true };
    const walk = getFoodAction(brain, world, preferences, 10000)!;
    expect(walk).toMatchObject({ kind: "walk", foodId: food.id, target: { x: 160.649375, y: floor.y, platformId: floor.id }, intention: { kind: "feed", stage: "travel" } });
    expect(walk.duration).toBeGreaterThan(0); expect(Number.isFinite(walk.duration)).toBe(true);
    const afterWalk = commitAction(brain, walk, 10000);
    const meal = getFoodAction(afterWalk, { ...world, ...walk.target }, preferences, 10000 + walk.duration)!;
    expect(meal).toMatchObject({ kind: "eat", foodId: food.id, target: walk.target, intention: { kind: "feed", stage: "observe" }, effectPoint: { x: food.x, y: food.y } });
    expect(afterWalk.foodGoal?.foodId).toBe(food.id);
  });

  it("keeps the same exception for a real split home span and an already-near meal", () => {
    const split = { ...floor, id: "companion-home-floor-2" }, start = { ...origin, platformId: "companion-home-floor-2" };
    const snack = { ...food, platformId: split.id };
    expect(findPlatformRoute(start, snack, [split], false, split.id)).toMatchObject([{ kind: "walk", target: { platformId: split.id } }]);
    const near = { ...origin, x: platformLandingX(floor, food.x) };
    expect(findPlatformRoute(near, food, [floor], false, floor.id)).toEqual([]);
  });

  it("requires explicit meal identity and never grants ordinary roaming or cross-span walking", () => {
    expect(findPlatformRoute(origin, food, [floor], false)).toBeNull();
    expect(findPlatformRoute(origin, food, [floor], false, "some-other-food-support")).toBeNull();
    const other = { ...floor, id: "companion-home-floor-1", x: 250 };
    expect(findPlatformRoute(origin, { ...food, x: 300, platformId: other.id }, [floor, other], false, other.id)).toBeNull();
    const brain = { ...createBrain(0), hunger: .5 };
    expect(getFoodAction(brain, { ...origin, platforms: [floor], foods: [food], width: 2400, height: 1100, animated: true }, { ...preferences, roam: false }, 10000)).toBeUndefined();
  });

  it("preserves the restrictions on manual dates, cards, controls, transparent panels and misleading home IDs", () => {
    for (const [id, kind] of [["date-1-floor", "floor"], ["manual-card", "card"], ["manual-control", "control"], ["companion-panel-floor", "floor"], ["companion-home", "floor"], ["companion-home-floor-food", "floor"]] as const) {
      const support = { ...floor, id, kind }, start = { ...origin, platformId: id }, snack = { ...food, platformId: id };
      expect(findPlatformRoute(start, snack, [support], false, id), id).toBeNull();
    }
  });

  it("requires a finite current plane and actual circular mouth reach after the existing12px landing inset", () => {
    const finalX = platformLandingX(floor, food.x);
    for (const target of [{ ...food, x: finalX + 36.002 }, { ...food, x: finalX + 36, y: floor.y + .5 }, { ...food, y: floor.y + .501 }, { ...food, x: Infinity }]) {
      expect(findPlatformRoute(origin, target, [floor], false, floor.id)).toBeNull();
    }
    for (const start of [{ ...origin, y: floor.y + 2.001 }, { ...origin, x: floor.x - .00001 }, { ...origin, x: NaN }]) {
      expect(findPlatformRoute(start, food, [floor], false, floor.id)).toBeNull();
    }
    for (const support of [{ ...floor, width: 0 }, { ...floor, width: Infinity }, { ...floor, x: NaN }]) {
      expect(findPlatformRoute(origin, food, [support], false, floor.id)).toBeNull();
    }
  });
});
