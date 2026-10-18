import { afterEach, describe, expect, it, vi } from "vitest";
import * as brainModule from "@/lib/ui/viewer-companion/brain";
import { createBrain, commitAction, type CompanionBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionReactiveCues, type CompanionReactiveInput } from "@/lib/ui/viewer-companion/reactive-cues";
import { getLivingAction } from "@/lib/ui/viewer-companion/living";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

const floor: Platform = { id: "floor", x: 0, y: 600, width: 1000, kind: "floor" };
const fresh = (): CompanionBrain => ({ ...createBrain(0, () => .5), hunger: .1, energy: .9 });
const world = (): CompanionWorld => ({ x: 100, y: 600, platformId: floor.id, platforms: [floor], width: 1000, height: 700, animated: true, pointer: { x: 900, y: 580, stableMs: 2000 } });
const input = (): CompanionReactiveInput => ({ brain: fresh(), world: world(), preferences: { ...DEFAULT_COMPANION_PREFERENCES, animalMode: "dog" }, action: { kind: "walk", target: { x: 950, y: floor.y, platformId: floor.id }, duration: 12000 }, now: 0, active: true, grounded: true });
afterEach(() => vi.restoreAllMocks());

describe("finite genuine reactive cues on the existing host tick", () => {
  it("notices a stable distant pointer during an ordinary long walk and spends a finite epoch budget", () => {
    const cues = createCompanionReactiveCues(), context = input();
    expect(cues.notice({ ...context, world: { ...context.world, pointer: { ...context.world.pointer!, stableMs: 749 } } })).toBeUndefined();
    expect(cues.notice({ ...context, now: 250 })).toBe("pointer");
    expect(cues.notice({ ...context, now: 1000 })).toBeUndefined();
    expect(cues.notice({ ...context, now: 15250, world: { ...context.world, x: 200 } })).toBe("pointer");
    expect(cues.notice({ ...context, now: 30250, world: { ...context.world, x: 250 } })).toBeUndefined();
    expect(cues.notice({ ...context, now: 30500, world: { ...context.world, pointer: { x: 700, y: 580, stableMs: 2000 } } })).toBe("pointer");
  });

  it("lets a new real cursor interrupt optional scenery inspection while an invitation or food story keeps ownership", () => {
    const context = input();
    for (const id of [31, 32, 33, 35]) expect(createCompanionReactiveCues().notice({ ...context, action: { ...context.action!, scene: { id } } })).toBe("pointer");
    for (const id of [1, 10, 13, 19, 22]) expect(createCompanionReactiveCues().notice({ ...context, action: { ...context.action!, scene: { id } } })).toBeUndefined();
  });

  it("spends failed pointer-route attempts at the personality cadence, not each paint or pixel movement", () => {
    const route = vi.spyOn(brainModule, "findPlatformRoute"), context = input(), cues = createCompanionReactiveCues();
    const ledge = { ...floor, id: "far", x: 800, y: 200, width: 100 };
    context.preferences.jump = false; context.world.platforms = [{ ...floor, manualOnly: true }, ledge];
    expect(cues.notice(context)).toBeUndefined(); expect(route).toHaveBeenCalledTimes(1);
    for (let now = 250; now < 15000; now += 250) expect(cues.notice({ ...context, now, world: { ...context.world, x: 100 + now / 1000 } })).toBeUndefined();
    expect(route).toHaveBeenCalledTimes(1);
    expect(cues.notice({ ...context, now: 15000 })).toBeUndefined(); expect(route).toHaveBeenCalledTimes(2);
    cues.notice({ ...context, now: 30000 }); expect(route).toHaveBeenCalledTimes(2);
  });

  it("lets a genuinely new stable pointer epoch bypass the old cue's retry cooldown", () => {
    const cues = createCompanionReactiveCues(), context = input();
    expect(cues.notice(context)).toBe("pointer");
    expect(cues.notice({ ...context, now: 1000 })).toBeUndefined();
    expect(cues.notice({ ...context, now: 1250, world: { ...context.world, pointer: { x: 650, y: 580, stableMs: 1000 } } })).toBe("pointer");
  });

  it("notices a newly reachable real meal first and never reissues it just because its coordinates moved", () => {
    const cues = createCompanionReactiveCues(), context = input(); context.brain.hunger = .8;
    const food = { id: "actual-food", kind: "apple" as const, x: 800, y: 600, platformId: floor.id };
    context.world.foods = [food]; expect(cues.notice(context)).toBe("food");
    expect(cues.notice({ ...context, now: 20000, world: { ...context.world, foods: [{ ...food, x: 650 }] } })).toBeUndefined();
    expect(cues.notice({ ...context, now: 20250, world: { ...context.world, foods: [{ ...food, id: "new-real-food" }] } })).toBe("food");
    expect(createCompanionReactiveCues().notice({ ...context, preferences: { ...context.preferences, feeding: false, petting: false } })).toBeUndefined();
  });

  it("caps failed food proofs at four per probe and two per real identity, including all eight objects", () => {
    const route = vi.spyOn(brainModule, "findPlatformRoute"), cues = createCompanionReactiveCues(), context = input();
    context.brain.hunger = .8; context.world.foods = Array.from({ length: 8 }, (_, i) => ({ id: "food-" + i, kind: "apple" as const, x: 800, y: 100, platformId: "missing" }));
    cues.notice(context); expect(route).toHaveBeenCalledTimes(4);
    cues.notice({ ...context, now: 250 }); expect(route).toHaveBeenCalledTimes(8);
    cues.notice({ ...context, now: 500 }); expect(route).toHaveBeenCalledTimes(8);
    cues.notice({ ...context, now: 15000 }); cues.notice({ ...context, now: 15250 }); expect(route).toHaveBeenCalledTimes(16);
    cues.notice({ ...context, now: 30000 }); expect(route).toHaveBeenCalledTimes(16);
  });

  it("preserves every direct, air, explicit-command, scene, toy, household, performance and meal owner", () => {
    const context = input();
    const patches: Partial<CompanionReactiveInput>[] = [{ active: false }, { grounded: false }, { held: true }, { commanded: true }, { busy: true },
      { preferences: { ...context.preferences, roam: false } }, { preferences: { ...context.preferences, petting: false } }, { brain: { ...context.brain, energy: .27 } },
      { world: { ...context.world, paused: true } }, { action: { ...context.action!, kind: "jump" } }, { action: { ...context.action!, kind: "eat" } },
      ...["scene", "toy", "household", "radio", "accessory", "living"].map(key => ({ action: { ...context.action!, [key]: true } } as unknown as Partial<CompanionReactiveInput>)),
      { brain: { ...context.brain, foodGoal: { foodId: "meal", remaining: 8, retryAfter: 0 } } },
      { brain: { ...context.brain, intention: { kind: "rest", targetId: floor.id, offset: .5, remaining: 8, stage: "travel" } } }];
    for (const patch of patches) expect(createCompanionReactiveCues().notice({ ...context, ...patch }), JSON.stringify(patch)).toBeUndefined();
  });
});

describe("distant social recognition and real one-leg pursuit", () => {
  it("reuses a failed distant route at the same cue cadence instead of searching at each idle decision", () => {
    const route = vi.spyOn(brainModule, "findPlatformRoute"), p = { ...DEFAULT_COMPANION_PREFERENCES, animalMode: "dog" as const, jump: false };
    const home = { ...floor, id: "companion-home-floor", manualOnly: true }, ledge = { ...floor, id: "unreachable", x: 800, y: 200, width: 100 };
    const scene = { ...world(), platformId: home.id, platforms: [home, ledge] }, state = fresh();
    expect(getLivingAction(state, scene, p, 0)).toBeUndefined(); expect(route).toHaveBeenCalledTimes(1);
    for (let at = 500; at < 15000; at += 500) getLivingAction(state, { ...scene, x: scene.x + at / 1000 }, p, at);
    expect(route).toHaveBeenCalledTimes(1);
    getLivingAction(state, scene, p, 15000); expect(route).toHaveBeenCalledTimes(2);
  });
  it.each(["dog", "affectionate"] as const)("signals %s recognition promptly, then follows a distant pointer without inventing a touch reward", mode => {
    const p = { ...DEFAULT_COMPANION_PREFERENCES, ...(mode === "dog" ? { animalMode: "dog" as const } : { personality: "affectionate" as const }) }, state = fresh(), scene = world();
    const signal = getLivingAction(state, scene, p, 600)!;
    expect(signal).toMatchObject({ kind: "play", play: mode === "dog" ? "bow" : "ask-petting", target: { x: scene.x, y: scene.y } });
    expect(signal.duration + 600).toBeLessThanOrEqual(3000);
    const committed = commitAction(state, signal, 600), follow = getLivingAction(committed, scene, p, 600 + signal.duration)!;
    expect(follow).toMatchObject({ kind: "walk", pace: "scoot", living: "social", target: { platformId: floor.id } });
    expect(follow.target.x).toBeGreaterThan(scene.x + 220); expect(follow.target.x).toBeLessThan(scene.pointer!.x); expect(follow.duration).toBeLessThanOrEqual(12000);
    expect(committed.affection).toBe(state.affection); expect(committed.life).toEqual(state.life);
  });

  it("follows a proved different platform when allowed, while respecting disabled jumps and actual support safety", () => {
    const p = { ...DEFAULT_COMPANION_PREFERENCES, animalMode: "dog" as const }, state = { ...fresh(), recentLiving: ["social" as const] };
    const ledge = { ...floor, id: "card", x: 400, y: 490, width: 180, kind: "card" as const }, scene = { ...world(), x: 450, pointer: { x: 480, y: 460, stableMs: 1000 }, platforms: [floor, ledge] };
    // Existing local150px attention stays local; a higher real target proves travel.
    scene.pointer.y = 390;
    let actor = scene, current = state, time = 0, action = getLivingAction(current, actor, p, time)!;
    for (let leg = 0; leg < 3 && action.kind === "walk"; leg++) {
      expect(action.target.platformId).toBe(floor.id);
      current = { ...commitAction(current, action, time), recentLiving: ["social"] };
      actor = { ...actor, ...action.target }; time += action.duration;
      action = getLivingAction(current, actor, p, time)!;
    }
    expect(action).toMatchObject({ kind: "jump", target: { platformId: ledge.id } });
    const blocked = getLivingAction(state, scene, { ...p, jump: false }, 0);
    expect(blocked?.kind).not.toBe("jump");
    expect(getLivingAction(state, { ...scene, platforms: [{ ...floor, kind: "control" }] }, p, 0)).toBeUndefined();
    expect(getLivingAction({ ...state, hunger: .8 }, { ...scene, foods: [{ id: "meal", kind: "apple", x: 460, y: 600, platformId: floor.id }] }, p, 0)).toBeUndefined();
  });
});
