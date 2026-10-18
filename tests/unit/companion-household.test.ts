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
    expect(deliver.target).toEqual({ x: 200, y: 600, platformId: floor.id });
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
});
