import { describe, expect, it } from "vitest";
import { createBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { createCompanionToyPlanner, createCompanionToys } from "@/lib/ui/viewer-companion/toys";
import { createCompanionHousehold } from "@/lib/ui/viewer-companion/household";

const floor: Platform = { id: "floor", kind: "floor", x: 0, y: 600, width: 1000 };
const brain = { ...createBrain(0, () => .5), hunger: .05, energy: .9 };
const preferences = { ...DEFAULT_COMPANION_PREFERENCES, personality: "tidy" as const };
const world: CompanionWorld = { x: 100, y: 600, platformId: floor.id, platforms: [floor], width: 1000, height: 700, animated: true };
const box = { x: 200, y: floor.y, platformId: floor.id };

describe("123 actual reachable tidy batch ownership", () => {
  it("returns four real objects without admitting a newly offered household prank between successful stashes", () => {
    const model = createCompanionToys(), planner = createCompanionToyPlanner(), household = createCompanionHousehold(() => 0);
    model.sync([floor], { width: 1000, height: 700 }, 0);
    const ids = [300, 360, 420, 480].map(x => model.spawn({ x, y: 500 }, 0)!);
    for (let now = 16; now < 1800; now += 16) model.tick(now);
    let position = { ...world }, now = 2000; const returned: string[] = [], carried: string[] = [];
    for (let beat = 0; beat < 80 && model.count(); beat++) {
      const action = planner.next({ world: position, brain, preferences, now, toys: model.available(), existingIds: model.ids(), carriedId: model.carried(), count: model.count(), box });
      expect(action).toBeDefined(); if (!action) break;
      if (["walk", "jump"].includes(action.kind)) position = { ...position, ...action.target, platformId: action.target.platformId! };
      const held = model.carried(); if (held) expect(model.carry(held, { x: position.x, y: position.y - 30 })).toBe(true);
      if (action.toy.effect === "pick") { const id = action.toy.toyId!, ok = model.pick(id, position); expect(ok).toBe(true); carried.push(id); planner.resolve(action.toy, ok, now); }
      if (action.toy.effect === "stash") {
        const id = action.toy.toyId!, ok = model.stash(id); expect(ok).toBe(true); returned.push(id); planner.resolve(action.toy, ok, now);
        expect(planner.active(), "existing cleanup reserves its next actual route check").toBe(true);
        const unrelated = !planner.active() ? household.next({ brain, world: position, preferences, now, home: { dispenser: box }, count: 0 }) : undefined;
        expect(unrelated).toBeUndefined();
      }
      now += action.duration;
    }
    expect(carried.sort()).toEqual([...ids].sort()); expect(returned.sort()).toEqual([...ids].sort()); expect(now).toBeLessThan(30000);
    expect(planner.next({ world: position, brain, preferences, now, toys: [], existingIds: [], count: 0, box })).toBeUndefined(); expect(planner.active()).toBe(false);
    expect(household.next({ brain, world: position, preferences, now, home: { dispenser: box }, count: 0 })?.household.kind).toBe("mischief");
  });

  function reserved() {
    const planner = createCompanionToyPlanner(), toy = { id: "returned", kind: "ball" as const, x: world.x, y: world.y, platformId: floor.id, angle: 0, held: false, carried: false };
    const input = { world, brain, preferences, now: 2000, toys: [toy], count: 1, box: { ...box, x: world.x } };
    const pick = planner.next(input)!; expect(pick.toy.effect).toBe("pick"); planner.resolve(pick.toy, true, 2000);
    const stash = planner.next({ ...input, toys: [], carriedId: toy.id })!; expect(stash.toy.effect).toBe("stash"); planner.resolve(stash.toy, true, 2600); expect(planner.active()).toBe(true);
    return { planner, input, pick, stash };
  }
  it("releases the reservation immediately when the only remaining real toy cannot be reached and returned", () => {
    const { planner, input } = reserved(), high = { ...floor, id: "unreachable", y: 200 }, toy = { ...input.toys[0], id: "high", x: 500, y: high.y, platformId: high.id };
    expect(planner.next({ ...input, now: 2700, world: { ...world, platforms: [floor, high] }, toys: [toy], existingIds: [toy.id], preferences: { ...preferences, jump: false } })).toBeUndefined();
    expect(planner.active()).toBe(false);
  });
  it("rejects stale pick/stash acknowledgements while a fresh actual continuation is reserved", () => {
    const { planner, input, pick, stash } = reserved(); planner.resolve(pick.toy, true, 2650); planner.resolve(stash.toy, true, 2660);
    const nextToy = { ...input.toys[0], id: "next", x: 350 };
    expect(planner.next({ ...input, now: 2700, toys: [nextToy], existingIds: [nextToy.id] })).toMatchObject({ kind: "walk", target: { x: nextToy.x }, toy: { kind: "tidy" } });
    expect(planner.active()).toBe(true);
  });
  it("yields the reserved batch to actual meal ownership, hidden/disabled behavior and explicit human cancellation", () => {
    for (const patch of [{ brain: { ...brain, foodGoal: { foodId: "actual-food", remaining: 3, retryAfter: 0 } } }, { world: { ...world, paused: true } }, { preferences: { ...preferences, enabled: false } }]) {
      const { planner, input } = reserved(); expect(planner.next({ ...input, ...patch, now: 2700 })).toBeUndefined(); expect(planner.active()).toBe(false);
    }
    const { planner } = reserved(); planner.cancel(2700); expect(planner.active()).toBe(false);
  });
});
