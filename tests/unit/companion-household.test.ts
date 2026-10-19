import { describe, expect, it } from "vitest";
import { createCompanionHousehold } from "@/lib/ui/viewer-companion/household";
import { createBrain, type CompanionFood, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { DEFAULT_COMPANION_PREFERENCES, normalizeCompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { getCompanionBehaviorProfile } from "@/lib/ui/viewer-companion/behavior-profile";

const floor: Platform = { id: "floor", x: 0, y: 600, width: 800, kind: "floor" };
const foods: CompanionFood[] = [{ id: "a", kind: "apple", x: 650, y: 600, platformId: floor.id }, { id: "b", kind: "bread", x: 680, y: 600, platformId: floor.id }];
const world: CompanionWorld = { x: 500, y: 600, platformId: floor.id, platforms: [floor], width: 800, height: 700, animated: true, foods };
const input = () => ({ brain: { ...createBrain(0, () => .5), hunger: .1, energy: .9 }, world: { ...world }, preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "tidy" as const }, now: 10000, home: {}, count: 2 });

describe("contextual household ownership", () => {
  it("carries an actual scattered snack to the same real support and stops after placement", () => {
    const controller = createCompanionHousehold(() => 0), context = input();
    const approach = controller.next(context)!;
    expect(approach).toMatchObject({ kind: "walk", target: { x: 650, y: 600, platformId: floor.id }, household: { kind: "tidy", foodId: "a" } });
    context.world = { ...context.world, ...approach.target };
    const pick = controller.next(context)!;
    expect(pick.household.effect).toBe("pick"); controller.resolve(pick.household, true, 11000);
    const carrying = { ...context, carried: "a", world: { ...context.world, foods: foods.slice(1) }, now: 11500 };
    const deliver = controller.next(carrying)!;
    expect(deliver.target.platformId).toBe(floor.id); expect(deliver.target.y).toBe(floor.y);
    expect(Math.abs(deliver.target.x - foods[1].x)).toBeGreaterThanOrEqual(44);
    expect(Math.abs(deliver.target.x - foods[0].x)).toBeLessThan(44);
    const put = controller.next({ ...carrying, world: { ...carrying.world, ...deliver.target } })!;
    expect(put.household.effect).toBe("put"); controller.resolve(put.household, true, 12000);
    expect(controller.active()).toBe(false);
    expect(controller.next({ ...context, now: 13000 })).toBeUndefined();
    // Late acknowledgements from an interrupted animation cannot revive it.
    controller.resolve(pick.household, true, 14000); expect(controller.active()).toBe(false);
  });
  it("cannot invent a route, tidy a hungry pet's food, or continue after a native takeover", () => {
    const context = input();
    expect(createCompanionHousehold(() => 0).next({ ...context, brain: { ...context.brain, hunger: .8 } })).toBeUndefined();
    expect(createCompanionHousehold(() => 0).next({ ...context, world: { ...world, platforms: [] } })).toBeUndefined();
    const controller = createCompanionHousehold(() => 0), walk = controller.next(context)!;
    const atSnack = { ...context, world: { ...world, ...walk.target } }, pick = controller.next(atSnack)!;
    controller.resolve(pick.household, true, 11000);
    expect(controller.next({ ...atSnack, world: { ...atSnack.world, foods: foods.slice(1) }, carried: undefined })).toBeUndefined();
    expect(controller.active()).toBe(false);
  });
  it("uses the actual finite spawn acknowledgement then runs into that food, without eating or stamping it", () => {
    const controller = createCompanionHousehold(() => 0), context = { ...input(), preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "mischievous" as const }, home: { dispenser: { x: 500, y: 600, platformId: floor.id } }, count: 0, world: { ...world, foods: [] } };
    const press = controller.next(context)!; expect(press.household.effect).toBe("spawn");
    controller.resolve(press.household, "actual-new-id", 11000);
    expect(controller.next(context)?.household.effect).toBeUndefined();
    const settled = { ...context, world: { ...world, foods: [{ ...foods[0], id: "actual-new-id" }] } };
    const run = controller.next(settled)!;
    expect(run).toMatchObject({ kind: "walk", pace: "scoot", household: { effect: "scatter", foodId: "actual-new-id" } });
    expect(run.foodId).toBeUndefined();
    controller.resolve(run.household, true, 13000); expect(controller.active()).toBe(false);
  });
  it("obeys feeding, prank, pause, cap, fatigue, route and deadline boundaries", () => {
    for (const patch of [{ feeding: false }, { enabled: false }, { roam: false }]) {
      const context = input(); expect(createCompanionHousehold(() => 0).next({ ...context, preferences: { ...context.preferences, ...patch } })).toBeUndefined();
    }
    const context = input();
    expect(createCompanionHousehold(() => 0).next({ ...context, world: { ...world, paused: true } })).toBeUndefined();
    expect(createCompanionHousehold(() => 0).next({ ...context, brain: { ...context.brain, energy: .1 } })).toBeUndefined();
    const controller = createCompanionHousehold(() => 0); controller.next(context); controller.cancel();
    expect(controller.next({ ...context, now: 11000 })).toBeUndefined();
    const expiry = createCompanionHousehold(() => 0); expiry.next(context);
    expect(expiry.next({ ...context, now: 56000 })).toBeUndefined();
    const mischief = { ...context, world: { ...world, foods: [] }, preferences: { ...context.preferences, personality: "mischievous" as const, ambientPrank: false } };
    expect(createCompanionHousehold(() => 0).next(mischief)).toBeUndefined();
    const full = { ...mischief, preferences: { ...mischief.preferences, ambientPrank: true }, count: 8, world: { ...world, foods: [] }, home: { dispenser: { x: 500, y: 600, platformId: floor.id } } };
    expect(createCompanionHousehold(() => 0).next(full)).toBeUndefined();
  });
  it("keeps the explicit personality and gives neatness and mischief distinct motivations", () => {
    const tidy = normalizeCompanionPreferences({ personality: "tidy" }), mischievous = normalizeCompanionPreferences({ personality: "mischievous" });
    expect(tidy.personality).toBe("tidy"); expect(mischievous.personality).toBe("mischievous");
    const a = getCompanionBehaviorProfile(tidy), b = getCompanionBehaviorProfile(mischievous);
    expect(a.tidyWeight).toBeGreaterThan(b.tidyWeight * 8); expect(b.mischiefWeight).toBeGreaterThan(a.mischiefWeight * 8);
    expect(b.accidentChance).toBeGreaterThan(a.accidentChance); expect(b.playWeight).toBeGreaterThan(a.playWeight * 3);
  });
  it("approaches a real dispenser along one measured manual room span without granting ordinary control tops", () => {
    const room: Platform = { id: "companion-home-floor", x: 50, y: 467.1875, width: 160.04, kind: "floor", manualOnly: true };
    const context = { ...input(), preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "mischievous" as const }, world: { ...world, x: 136.414, y: room.y, platformId: room.id, platforms: [room], foods: [] }, home: { dispenser: { x: 198.04, y: room.y, platformId: room.id } }, count: 0 };
    expect(createCompanionHousehold(() => 0).next(context)).toMatchObject({ kind: "walk", target: context.home.dispenser });
    expect(createCompanionHousehold(() => 0).next({ ...context, home: { dispenser: { ...context.home.dispenser, x: 250 } } })).toBeUndefined();
    const control = { ...room, id: "manual-control", kind: "control" as const };
    expect(createCompanionHousehold(() => 0).next({ ...context, world: { ...context.world, platforms: [control], platformId: control.id }, home: { dispenser: { ...context.home.dispenser, platformId: control.id } } })).toBeUndefined();
  });
  it("can reconsider ordinary exploration after arrival, while preserving an unfinished travel or meal", () => {
    const context = input(), intention = { kind: "explore" as const, targetId: floor.id, offset: .8, remaining: 4, stage: "observe" as const };
    expect(createCompanionHousehold(() => 0).next({ ...context, brain: { ...context.brain, intention } })?.household.kind).toBe("tidy");
    expect(createCompanionHousehold(() => 0).next({ ...context, brain: { ...context.brain, intention: { ...intention, stage: "travel" } } })).toBeUndefined();
    expect(createCompanionHousehold(() => 0).next({ ...context, brain: { ...context.brain, intention: { ...intention, kind: "feed" } } })).toBeUndefined();
  });
  it("prefers a proved bin stance without imposing a second distance-to-bin centre gate", () => {
    const room: Platform = { id: "companion-home-floor", kind: "floor", manualOnly: true, x: 50, y: 600, width: 160 };
    const context = { ...input(), world: { ...world, x: 80, platformId: room.id, platforms: [room], foods: [{ ...foods[0], x: 170, platformId: room.id }] }, home: { bin: { x: 198, y: 600, platformId: room.id } }, count: 1 };
    const controller = createCompanionHousehold(() => 0), walk = controller.next(context)!;
    const atFood = { ...context, world: { ...context.world, ...walk.target } }, pick = controller.next(atFood)!;
    expect(pick.household.effect).toBe("pick"); controller.resolve(pick.household, true, 11000);
    const carried = { ...atFood, carried: "a", now: 11500, world: { ...atFood.world, foods: [] } }, deliver = controller.next(carried)!;
    expect(deliver.target).toEqual(context.home.bin);
    const discard = controller.next({ ...carried, world: { ...carried.world, ...deliver.target } })!;
    expect(discard.household.effect).toBe("discard");
    controller.resolve(discard.household, false, 12000); expect(controller.active()).toBe(false);
  });
  it("sorts four overlapping foods without piling them together or moving an already good survivor", () => {
    const controller = createCompanionHousehold(() => 0), context = input();
    context.world = { ...world, foods: Array.from({ length: 4 }, (_, i) => ({ ...foods[0], id: `food-${i}`, x: 400 })) };
    context.count = 4;
    const moves: string[] = [];
    for (let turn = 0; turn < 4; turn++) {
      const step = controller.next(context);
      if (!step) break;
      context.world = { ...context.world, ...step.target };
      const pick = controller.next(context)!; expect(pick.household.effect).toBe("pick");
      const id = pick.household.foodId!, old = context.world.foods!.find(food => food.id === id)!;
      controller.resolve(pick.household, true, context.now + 100);
      const siblings = context.world.foods!.filter(food => food.id !== id);
      const carried = { ...context, carried: id, world: { ...context.world, foods: siblings } };
      const delivery = controller.next(carried)!;
      const put = delivery.household.effect === "put" ? delivery : controller.next({ ...carried, world: { ...carried.world, ...delivery.target } })!;
      expect(put.household.effect).toBe("put");
      const target = put.household.point!;
      expect(siblings.every(food => Math.abs(food.x - target.x) >= 44)).toBe(true);
      context.world = { ...context.world, ...target, foods: [...siblings, { ...old, ...target }] };
      controller.resolve(put.household, true, context.now + 200); moves.push(id); context.now += 7000;
    }
    expect(moves).toHaveLength(3); expect(new Set(moves).size).toBe(3);
    expect(new Set(context.world.foods!.map(food => food.x)).size).toBe(4);
    expect(context.world.foods!.some(food => food.x === 400)).toBe(true);
    expect(controller.next({ ...context, now: context.now + 200000 })).toBeUndefined();
  });
  it("uses a proved free44px centre on a support narrower than120px and respects toy occupancy", () => {
    const small: Platform = { ...floor, x: 100, width: 112 }, context = input();
    context.world = { ...world, x: 150, platformId: small.id, platforms: [small], foods: [{ ...foods[0], x: 166 }, { ...foods[1], x: 166 }] };
    const controller = createCompanionHousehold(() => 0), step = controller.next({ ...context, occupied: [{ x: 194, y: 600 }] })!;
    expect(step).toBeDefined(); context.world = { ...context.world, ...step.target };
    const pick = controller.next({ ...context, occupied: [{ x: 194, y: 600 }] })!; controller.resolve(pick.household, true, 11000);
    const next = controller.next({ ...context, carried: "a", world: { ...context.world, foods: [context.world.foods![1]] }, occupied: [{ x: 194, y: 600 }], now: 11500 })!;
    const target = next.household.point ?? next.target;
    expect(target.x).toBeGreaterThanOrEqual(112); expect(target.x).toBeLessThanOrEqual(200);
    expect(Math.abs(target.x - 194)).toBeGreaterThanOrEqual(44);
    expect(Math.abs(target.x - 166)).toBeGreaterThanOrEqual(44);
    // A single available centre is not permission to pick up and return to
    // the same overlapping point repeatedly.
    expect(createCompanionHousehold(() => 0).next({ ...context, world: { ...context.world, x: 150, platforms: [{ ...small, x: 140, width: 20 }], foods: context.world.foods!.map(food => ({ ...food, x: 150 })) } })).toBeUndefined();
  });
  it("keeps all three free44px positions in a narrow body-safe centre interval", () => {
    const support: Platform = { ...floor, x: 100, width: 112 }, context = input(), controller = createCompanionHousehold(() => 0);
    context.world = { ...world, x: 156, platforms: [support], foods: Array.from({ length: 3 }, (_, i) => ({ ...foods[0], id: `small-${i}`, x: 156 })) };
    context.count = 3;
    for (let turn = 0; turn < 2; turn++) {
      const approach = controller.next(context)!;
      context.world = { ...context.world, ...approach.target };
      const pick = approach.household.effect === "pick" ? approach : controller.next(context)!;
      expect(pick.household.effect).toBe("pick");
      const id = pick.household.foodId!, moved = context.world.foods!.find(food => food.id === id)!;
      controller.resolve(pick.household, true, context.now + 100);
      const siblings = context.world.foods!.filter(food => food.id !== id), carried = { ...context, carried: id, world: { ...context.world, foods: siblings } };
      const delivery = controller.next(carried)!;
      const put = delivery.household.effect === "put" ? delivery : controller.next({ ...carried, world: { ...carried.world, ...delivery.target } })!;
      expect(put.household.effect).toBe("put");
      context.world = { ...context.world, ...put.household.point!, foods: [...siblings, { ...moved, ...put.household.point! }] };
      controller.resolve(put.household, true, context.now + 200); context.now += 7000;
    }
    expect(context.world.foods!.map(food => food.x).sort((a, b) => a - b)).toEqual([112, 156, 200]);
    expect(controller.next({ ...context, now: context.now + 200000 })).toBeUndefined();
  });
  it("rechecks actual sibling positions before delivery and leaves separated foods alone", () => {
    const context = input(), controller = createCompanionHousehold(() => 0), approach = controller.next(context)!;
    const atFood = { ...context, world: { ...world, ...approach.target } }, pick = controller.next(atFood)!;
    controller.resolve(pick.household, true, 11000);
    const occupiedTarget = controller.currentCleanup()!.point!.x;
    const next = controller.next({ ...atFood, carried: "a", now: 11500, world: { ...atFood.world, foods: [{ ...foods[1], x: occupiedTarget }] } })!;
    const destination = next.household.point ?? next.target;
    expect(Math.abs(destination.x - occupiedTarget)).toBeGreaterThanOrEqual(44);
    const neat = { ...context, world: { ...world, foods: [{ ...foods[0], x: 200 }, { ...foods[1], x: 244 }] } };
    expect(createCompanionHousehold(() => 0).next(neat)).toBeUndefined();
  });
});
