import { describe, expect, it } from "vitest";
import { accessibleCompanionFoods } from "@/lib/ui/viewer-companion/food-access";
import { createBrain, getFoodAction, type CompanionFood, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionHousehold } from "@/lib/ui/viewer-companion/household";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { withinCompanionFoodReach } from "@/lib/ui/viewer-companion/food-reach";
import { createCompanionScenes, type CompanionSceneInput, type CompanionSceneAction } from "@/lib/ui/viewer-companion/scenes";
import { newCompanionSceneMemory } from "@/lib/ui/viewer-companion/scene-memory";

// The observed painted196.649px snack is only.0005625px beyond a36px
// stance at160.6484375. Keep the physical surface fractional, not rounded.
const floor: Platform = { id: "companion-home-floor", kind: "floor", manualOnly: true, x: 50, y: 454.578125, width: 122.6484375 };
const stance = { x: 160.6484375, y: floor.y, platformId: floor.id };
const foods: CompanionFood[] = [
  { id: "exact", kind: "melon", x: stance.x + 36, y: floor.y, platformId: "companion-home-floor-food" },
  { id: "native-rounded", kind: "yakgwa", x: 196.649, y: 454.578, platformId: "companion-home-floor-food" },
];

describe("131 fractional body floor and native food-paint precision", () => {
  it("retains both actually overlapping foods at the three-decimal display boundary", () => {
    const before = structuredClone(foods), available = accessibleCompanionFoods(foods, [floor]);
    expect(available.map(food => food.id)).toEqual(["exact", "native-rounded"]);
    expect(foods).toEqual(before); expect(available.every(food => food.platformId === floor.id)).toBe(true);
  });
  it("keeps that actual overlap visible to tidy admission and uses a real free pantry point", () => {
    const available = accessibleCompanionFoods(foods, [floor]), brain = { ...createBrain(0, () => 0), hunger: .05, energy: .98 };
    const planner = createCompanionHousehold(() => 0);
    const action = planner.next({ brain, world: { x: 83, y: floor.y, platformId: floor.id, platforms: [floor], foods: available, width: 2400, height: 1100, animated: true },
      preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "tidy", ambientPrank: false }, home: { pantry: { x: 111, y: floor.y, platformId: floor.id } }, count: 2, now: 10000 });
    expect(action?.household.kind).toBe("tidy"); expect(planner.currentCleanup()?.discard).toBe(false);
    const target = planner.currentCleanup()!.point!;
    expect(target.platformId).toBe(floor.id); expect(Math.abs(target.x - foods[1].x)).toBeGreaterThanOrEqual(44);
  });
  it("uses the same precision at the final real eating stance without changing either position", () => {
    const rounded = { ...foods[1], platformId: floor.id };
    const action = getFoodAction({ ...createBrain(0), hunger: .8 }, { ...stance, platforms: [floor], foods: [rounded], width: 2400, height: 1100, animated: true },
      { ...DEFAULT_COMPANION_PREFERENCES, roam: false, jump: false }, 10000);
    expect(action).toMatchObject({ kind: "eat", foodId: rounded.id, target: stance });
    expect(rounded.x).toBe(196.649); expect(floor.x + floor.width - 12).toBe(stance.x);
  });
  it("rejects genuinely beyond36.002px, another floor, controls and stale vertical planes", () => {
    const outside = { ...foods[1], x: stance.x + 36.002 };
    expect(accessibleCompanionFoods([outside], [floor])).toEqual([]);
    expect(accessibleCompanionFoods([foods[1]], [{ ...floor, id: "viewport-floor" }, { ...floor, kind: "control" }, { ...floor, y: floor.y + .51 }])).toEqual([]);
    expect(accessibleCompanionFoods([foods[1]], [{ ...floor, manualOnly: false }])).toEqual([]);
  });
  it("uses only the display precision for both horizontal and circular reach", () => {
    const dx = foods[1].x - stance.x, dy = foods[1].y - stance.y;
    expect(withinCompanionFoodReach(dx)).toBe(true);
    expect(withinCompanionFoodReach(Math.hypot(dx, dy))).toBe(true);
    expect(withinCompanionFoodReach(36.002)).toBe(false);
    for (const invalid of [NaN, Infinity, -1]) expect(withinCompanionFoodReach(invalid)).toBe(false);
  });
  it("moves only the reachable snack while reserving a nearby unreachable snack's real space", () => {
    const unreachable = { ...foods[1], id: "unreachable", x: stance.x + 36.002 };
    const visible = [foods[0], unreachable], available = accessibleCompanionFoods(visible, [floor]);
    expect(available.map(food => food.id)).toEqual([foods[0].id]);
    const planner = createCompanionHousehold(() => 0);
    const action = planner.next({ brain: { ...createBrain(0), hunger: .05, energy: .98 },
      world: { x: 83, y: floor.y, platformId: floor.id, platforms: [floor], foods: available, width: 2400, height: 1100, animated: true }, visibleFoods: visible,
      preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "tidy", ambientPrank: false }, home: { pantry: { x: 150, y: floor.y, platformId: floor.id } }, count: 2, now: 10000 });
    expect(action?.household.foodId).toBe(foods[0].id);
    const target = planner.currentCleanup()!.point!;
    expect(Math.hypot(target.x - unreachable.x, target.y - unreachable.y)).toBeGreaterThanOrEqual(44);
    expect(target.platformId).toBe(floor.id);
  });
  it("does not turn unavailable-only or unknown-support occupancy into a cleanup route", () => {
    const unreachable = { ...foods[1], x: stance.x + 36.002 };
    const unknown = { ...foods[0], id: "unknown", platformId: "unknown-control" };
    const planner = createCompanionHousehold(() => 0);
    expect(planner.next({ brain: { ...createBrain(0), hunger: .05, energy: .98 },
      world: { x: 83, y: floor.y, platformId: floor.id, platforms: [floor], foods: accessibleCompanionFoods([unreachable, unknown], [floor]), width: 2400, height: 1100, animated: true }, visibleFoods: [unreachable, unknown],
      preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "tidy", ambientPrank: false }, home: { pantry: { x: 111, y: floor.y, platformId: floor.id } }, count: 2, now: 10000 })).toBeUndefined();
    expect(planner.active()).toBe(false);
  });
});

describe("131 scene13 uses the same proved food mouth/carry reach", () => {
  const setup = () => {
    const controller = createCompanionScenes(newCompanionSceneMemory());
    const input: CompanionSceneInput = { brain: { ...createBrain(0), hunger: .05, energy: .98 }, preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "tidy", ambientPrank: false },
      world: { x: 83, y: floor.y, platformId: floor.id, platforms: [floor], foods: accessibleCompanionFoods([foods[1]], [floor]), width: 2400, height: 1100, animated: true },
      pantry: { x: 111, y: floor.y, platformId: floor.id }, now: 10000, knownFoods: ["yakgwa"], owned: [], equipped: null };
    const finish = (action: CompanionSceneAction) => { input.now += action.duration; controller.complete(action); };
    return { controller, input, finish };
  };
  it("finishes its measured36px approach, actually requests pick, reserves and later eats without an18px dead end", () => {
    const { controller, input, finish } = setup();
    const approach = controller.next(input)!; expect(approach).toMatchObject({ kind: "walk", scene: { id: 13, beat: 0 } });
    input.world = { ...input.world, x: 160.6490020751953, y: 454.5780029296875 }; finish(approach);
    const pick = controller.next(input)!; expect(pick).toMatchObject({ kind: "sniff", scene: { id: 13, beat: 1, effect: { kind: "pick", foodId: foods[1].id } } });
    input.carriedFoodId = foods[1].id; input.world.foods = []; controller.resolve(pick, true); finish(pick);
    const reserve = controller.next(input)!; expect(reserve.kind).toBe("walk"); input.world = { ...input.world, ...reserve.target }; finish(reserve);
    const put = controller.next(input)!; expect(put.scene.effect?.kind).toBe("put"); controller.resolve(put, true); finish(put);
    input.carriedFoodId = undefined; input.world.foods = accessibleCompanionFoods([foods[1]], [floor]);
    const after = controller.next(input)!; finish(after);
    expect(controller.hasReservedFood()).toBe(foods[1].id);
    input.brain.hunger = .5; input.world = { ...input.world, ...stance };
    const notice = controller.next(input)!; expect(notice.scene.id).toBe(13); finish(notice);
    const sniff = controller.next(input)!; expect(sniff.kind).toBe("sniff"); finish(sniff);
    expect(controller.next(input)).toMatchObject({ kind: "eat", foodId: foods[1].id, scene: { id: 13 } });
  });
  it("cancels a genuinely beyond36.002px or different-support pick instead of extending its route", () => {
    for (const changed of [{ x: stance.x + 36.002 }, { platformId: "another-floor" }]) {
      const { controller, input, finish } = setup();
      const approach = controller.next(input)!; input.world = { ...input.world, ...stance }; finish(approach);
      input.world.foods = [{ ...input.world.foods![0], ...changed }];
      expect(controller.next(input)).toBeUndefined(); expect(controller.current()).toBeUndefined();
    }
  });
});
