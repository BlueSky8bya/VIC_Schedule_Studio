import { describe, expect, it, vi } from "vitest";
import { advanceBrain, cancelCompanionTravelGoal, commitAction, createBrain, getAction, getFoodAction, type CompanionBrain, type CompanionWorld } from "@/lib/ui/viewer-companion/brain";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { createCompanionLife, experienceCompanionLife } from "@/lib/ui/viewer-companion/life";
import { companionFoodApproachScale, COMPANION_LIVING_COOLDOWN, getLivingAction } from "@/lib/ui/viewer-companion/living";

const prefs = { ...DEFAULT_COMPANION_PREFERENCES }, now = 120000;
const brain = (): CompanionBrain => ({ ...createBrain(0, () => .5), life: createCompanionLife(() => 0), activeMs: now, hunger: .1 });
const world = (): CompanionWorld => ({ x: 150, y: 300, width: 800, height: 600, platformId: "date-a", platforms: [{ id: "date-a", x: 0, y: 300, width: 500, kind: "date" }], animated: true });

describe("finite living actions on the actual occupied support", () => {
  it("approaches a stable nearby pointer once, then asks without granting a petting reward", () => {
    const state = brain(), scene = { ...world(), pointer: { x: 300, y: 290, stableMs: 1000 } };
    const approach = getLivingAction(state, scene, prefs, now, () => .9)!;
    expect(approach.kind).toBe("walk"); expect(approach.living).toBe("social");
    expect(approach.target.platformId).toBe(scene.platformId); expect(approach.target.x - scene.x).toBeLessThanOrEqual(96);
    const committed = commitAction(state, approach, now), end = now + approach.duration;
    const ask = getLivingAction(committed, { ...scene, x: approach.target.x }, prefs, end, () => .9)!;
    expect(ask.play).toBe("ask-petting"); expect(ask.kind).toBe("play"); expect(ask.duration).toBeGreaterThan(0);
    const waiting = commitAction(committed, ask, end);
    expect(waiting.affection).toBe(state.affection); expect(waiting.life).toEqual(state.life);
    expect(waiting.pendingLiving).toBeUndefined(); expect(waiting.cooldowns.living).toBe(end + ask.duration + COMPANION_LIVING_COOLDOWN);
    expect(getLivingAction(waiting, scene, prefs, end + ask.duration, () => 0)).toBeUndefined();
  });

  it("can nuzzle nearby after real affection without inventing a touch or escaping the support", () => {
    const state = { ...brain(), affection: .7 }, scene = { ...world(), pointer: { x: 190, y: 290, stableMs: 1000 } };
    const action = getLivingAction(state, scene, prefs, now, () => .9)!;
    expect(action.play).toBe("lean-nuzzle"); expect(action.target).toEqual({ x: scene.x, y: scene.y, platformId: scene.platformId });
    expect(state.affection).toBe(.7); expect(state.life!.recent).toEqual([]);
  });

  it("requires a renderer-proved stable pointer and yields to disabled controls, food and commands", () => {
    const state = brain(), scene = { ...world(), pointer: { x: 190, y: 290, stableMs: 1000 } };
    for (const altered of [{ ...scene, animated: false }, { ...scene, paused: true }, { ...scene, pointer: { x: 190, y: 290 } }, { ...scene, pointer: { x: 190, y: 290, stableMs: 899 } }, { ...scene, y: 270 }]) expect(getLivingAction(state, altered, prefs, now, () => .9)).toBeUndefined();
    for (const altered of [{ ...prefs, enabled: false }, { ...prefs, roam: false }, { ...prefs, petting: false }]) expect(getLivingAction(state, scene, altered, now, () => .9)).toBeUndefined();
    const hungry = { ...state, hunger: .8 }, foodScene = { ...scene, foods: [{ id: "offered", kind: "apple" as const, x: 160, y: 300, platformId: "date-a" }] };
    expect(getAction(hungry, foodScene, prefs, now, () => .9).living).toBeUndefined();
    expect(getLivingAction({ ...state, foodGoal: { foodId: "offered", remaining: 2, retryAfter: 0 } }, scene, prefs, now, () => 0)).toBeUndefined();
    expect(getLivingAction({ ...state, intention: { kind: "rest", targetId: "date-a", offset: .5, remaining: 2, stage: "travel" } }, scene, prefs, now, () => 0)).toBeUndefined();
    const approaching = commitAction(state, getLivingAction(state, { ...scene, pointer: { ...scene.pointer, x: 300 } }, prefs, now, () => .9)!, now);
    expect(cancelCompanionTravelGoal(approaching).pendingLiving).toBeUndefined();
  });

  it("never invites interaction from a control, hidden ledge or manually chosen card top", () => {
    for (const patch of [{ kind: "control" as const }, { kind: "hide" as const }, { manualOnly: true }]) {
      const scene = world(); scene.platforms = [{ ...scene.platforms[0], ...patch }];
      expect(getLivingAction(brain(), { ...scene, pointer: { x: 190, y: 300, stableMs: 1500 } }, prefs, now, () => 0)).toBeUndefined();
    }
  });

  it("settles only at a real home, curls when tired and then sleeps without teleporting", () => {
    const state = { ...brain(), energy: .2 }, scene = world();
    scene.platformId = "companion-home"; scene.platforms = [{ ...scene.platforms[0], id: scene.platformId, manualOnly: true }];
    const curl = getLivingAction(state, scene, prefs, now, () => .9)!;
    expect(curl.play).toBe("doze-curl"); expect(curl.living).toBe("cozy");
    const resting = commitAction(state, curl, now), sleep = getLivingAction(resting, scene, prefs, now + curl.duration, () => .9)!;
    expect(sleep.kind).toBe("sleep"); expect(sleep.target).toEqual(curl.target);
    expect(getLivingAction(resting, scene, { ...prefs, sleep: false }, now + curl.duration, () => 0)).toBeUndefined();
  });

  it("runs a bounded cheer clip rarely and consumes a long cooldown only on commit", () => {
    const state = brain(), scene = world(), action = getLivingAction(state, scene, prefs, now, () => 0)!;
    expect(action.play).toBe("cheer-rehearsal"); expect(action.duration).toBeGreaterThan(0); expect(action.duration).toBeLessThan(10000);
    expect(state.cooldowns.living).toBeUndefined(); expect(state.life!.recent).toEqual([]);
    const committed = commitAction(state, action, now);
    expect(getLivingAction(committed, scene, prefs, now + action.duration + 1000, () => 0)).toBeUndefined();
    expect(getLivingAction(committed, scene, prefs, now + action.duration + COMPANION_LIVING_COOLDOWN, () => 0)?.play).toBe("cheer-rehearsal");
    expect(committed.recentLiving).toEqual(["cheer"]);
  });

  it("offers a missed first rehearsal after150 active seconds without another random draw or bypassing priority", () => {
    const state = { ...brain(), activeMs: 150000 }, scene = world(), rng = vi.fn(() => NaN);
    expect(getLivingAction({ ...state, activeMs: 149999 }, scene, prefs, now, () => .9)).toBeUndefined();
    expect(getLivingAction(state, scene, prefs, now, rng)?.play).toBe("cheer-rehearsal"); expect(rng).not.toHaveBeenCalled();
    expect(getLivingAction({ ...state, recentLiving: ["cheer"] }, scene, prefs, now, () => .9)).toBeUndefined();
    expect(getLivingAction({ ...state, cooldowns: { living: now + 1 } }, scene, prefs, now, rng)).toBeUndefined();
    expect(getLivingAction({ ...state, foodGoal: { foodId: "real-meal", remaining: 8, retryAfter: 0 } }, scene, prefs, now, rng)).toBeUndefined();
    expect(getLivingAction(state, { ...scene, paused: true }, prefs, now, rng)).toBeUndefined();
    expect(getLivingAction(state, scene, { ...prefs, roam: false }, now, rng)).toBeUndefined();
  });

  it("uses existing failed-place memory to inspect rather than rushing through it", () => {
    const state = { ...brain(), places: [{ id: "date-a", visits: 0, failures: 1, retryAfter: now + 8000 }] }, scene = world();
    const check = getLivingAction(state, scene, prefs, now, () => .9)!;
    expect(check.kind).toBe("look"); expect(check.target.x).toBe(scene.x); expect(check.living).toBeUndefined();
    expect(getLivingAction(commitAction(state, check, now), scene, prefs, now + 100, () => .9)).toBeUndefined();
  });

  it("checks a real failed place once despite living cooldown, then yields through its remaining short memory", () => {
    const state = { ...brain(), cooldowns: { living: now + COMPANION_LIVING_COOLDOWN }, places: [{ id: "date-a", visits: 0, failures: 1, retryAfter: now + 8000 }] }, scene = world();
    const original = structuredClone(state), check = getLivingAction(state, scene, prefs, now, () => .9)!;
    expect(check.kind).toBe("look"); expect(check.placeCheckMs).toBe(8000);
    const checked = commitAction(state, check, now);
    expect(checked.cooldowns.look).toBe(now + 8000);
    expect(checked.cooldowns.living).toBe(state.cooldowns.living);
    expect(getLivingAction({ ...checked, activeMs: now + 3000 }, scene, prefs, now + 3000, () => .9)).toBeUndefined();
    expect(getLivingAction({ ...checked, activeMs: now + 8001 }, scene, prefs, now + 8001, () => .9)).toBeUndefined();
    expect(getLivingAction(state, scene, { ...prefs, learnFromYou: false }, now, () => .9)).toBeUndefined();
    expect(getLivingAction({ ...state, foodGoal: { foodId: "committed", remaining: 6, retryAfter: 0 } }, scene, prefs, now, () => .9)).toBeUndefined();
    expect(getLivingAction({ ...state, intention: { kind: "rest", targetId: "date-a", stage: "travel", offset: .5, remaining: 3 } }, scene, prefs, now, () => .9)).toBeUndefined();
    expect(state).toEqual(original);
  });
});

describe("life affects existing planning without duplicating experience rewards", () => {
  it("advances only the supplied enabled active budget and leaves learned traits unchanged when disabled", () => {
    const state = brain(); state.life = experienceCompanionLife(state.life, { kind: "petted" });
    expect(advanceBrain(state, 0).life).toBe(state.life);
    expect(advanceBrain(state, 3600000).life).toEqual(advanceBrain(state, 30000).life);
    expect(advanceBrain(state, 30000, false).life).toBe(state.life);
  });

  it("weights the first meal by preference but preserves a committed food ID", () => {
    const state = { ...brain(), hunger: .8 }, scene = world();
    state.life!.foodScores.apple = 1; state.life!.foodScores.pear = .1;
    scene.foods = [{ id: "near", kind: "pear", x: 190, y: 300, platformId: "date-a" }, { id: "liked", kind: "apple", x: 210, y: 300, platformId: "date-a" }];
    expect(getFoodAction(state, scene, prefs, now)!.foodId).toBe("liked");
    expect(getFoodAction({ ...state, foodGoal: { foodId: "near", remaining: 8, retryAfter: 0 } }, scene, prefs, now)!.foodId).toBe("near");
    expect(getFoodAction(state, { ...scene, animated: false }, prefs, now)!.foodId).toBe("near");
  });

  it("keeps the same meal, route and budget after an actual recent failure while walking only20% more carefully", () => {
    const state: CompanionBrain = { ...brain(), hunger: .8, foodGoal: { foodId: "committed", remaining: 9, retryAfter: 0 }, episode: { kind: "meal", phase: "approach", variant: "careful", remaining: 6, foodId: "committed", mishapUsed: true, legs: 2 } };
    const scene: CompanionWorld = { ...world(), foods: [{ id: "closer", kind: "apple", x: 170, y: 300, platformId: "date-a" }, { id: "committed", kind: "pear", x: 380, y: 300, platformId: "date-a" }] };
    const failed = { ...state, places: [{ id: "date-a", visits: 0, failures: 1, retryAfter: now + 8000 }] }, snapshot = structuredClone(failed);
    for (const decide of [getFoodAction, (b: CompanionBrain, w: CompanionWorld, p: typeof prefs, time: number) => getAction(b, w, p, time, () => .9)]) {
      const ordinary = decide(state, scene, prefs, now)!, cautious = decide(failed, scene, prefs, now)!;
      expect(cautious.kind).toBe("walk"); expect(cautious.foodId).toBe("committed"); expect(cautious.target).toEqual(ordinary.target); expect(cautious.intention).toEqual(ordinary.intention);
      expect(cautious.duration / ordinary.duration).toBeCloseTo(1.25, 12);
      expect(commitAction(failed, cautious, now).foodGoal).toEqual({ foodId: "committed", remaining: 8, retryAfter: 0 });
      expect(decide(failed, scene, { ...prefs, learnFromYou: false }, now)!.duration).toBe(ordinary.duration);
      expect(decide({ ...failed, activeMs: now + 8001 }, scene, prefs, now + 8001)!.duration).toBe(ordinary.duration);
    }
    expect(failed).toEqual(snapshot);
  });

  it("applies caution only to current/target supports of a committed meal and restores the default when learning is off", () => {
    const state = { ...brain(), foodGoal: { foodId: "meal", remaining: 6, retryAfter: 0 } }, scene = world();
    const on = { ...prefs, learnFromYou: true }, off = { ...prefs, learnFromYou: false };
    for (const id of ["date-a", "date-target"]) {
      const failed = { ...state, places: [{ id, visits: 0, failures: 1, retryAfter: now + 8000 }] };
      expect(companionFoodApproachScale(failed, scene, on, "meal", "date-target")).toBe(.8);
      expect(companionFoodApproachScale(failed, scene, off, "meal", "date-target")).toBe(1);
      expect(companionFoodApproachScale(failed, scene, on, "different-meal", "date-target")).toBe(1);
      expect(companionFoodApproachScale(failed, { ...scene, animated: false }, on, "meal", "date-target")).toBe(1);
    }
    expect(companionFoodApproachScale({ ...state, places: [{ id: "unrelated", visits: 0, failures: 1, retryAfter: now + 8000 }] }, scene, on, "meal", "date-target")).toBe(1);
    expect(companionFoodApproachScale({ ...state, places: [{ id: "date-a", visits: 2, failures: 0, retryAfter: now + 8000 }] }, scene, on, "meal", "date-target")).toBe(1);
  });

  it("chooses the closest new meal with learning off while retaining learned taste and a committed meal", () => {
    const state = { ...brain(), hunger: .8 }, scene = world();
    state.life!.foodScores.apple = 1; state.life!.foodScores.pear = .1;
    state.life!.favoriteFood = "apple";
    const stored = structuredClone(state.life), off = { ...prefs, learnFromYou: false }, on = { ...prefs, learnFromYou: true };
    scene.foods = [{ id: "near", kind: "pear", x: 190, y: 300, platformId: "date-a" }, { id: "liked", kind: "apple", x: 210, y: 300, platformId: "date-a" }];

    expect(getFoodAction(state, scene, on, now)!.foodId).toBe("liked");
    expect(getFoodAction(state, scene, off, now)!.foodId).toBe("near");
    expect(getFoodAction({ ...state, foodGoal: { foodId: "liked", remaining: 8, retryAfter: 0 } }, scene, off, now)!.foodId).toBe("liked");
    expect(state.life).toEqual(stored);
    expect(getFoodAction(state, scene, on, now)!.foodId).toBe("liked");
  });

  it.each([.1, .9])("uses the default social invitation with learning off without erasing learned social tendency %s", social => {
    const state = brain(), scene = { ...world(), pointer: { x: 190, y: 290, stableMs: 1000 } };
    state.life!.social = social;
    const stored = structuredClone(state.life), off = { ...prefs, learnFromYou: false };

    expect(getLivingAction(state, scene, { ...prefs, learnFromYou: true }, now, () => .9)?.play).toBe(social < .4 ? undefined : "ask-petting");
    expect(getLivingAction(state, scene, off, now, () => .9)?.play).toBe("ask-petting");
    expect(state.life).toEqual(stored);
  });

  it.each([.1, .9])("uses the default home-rest choice with learning off without erasing learned comfort %s", comfort => {
    const state = brain(), scene = world();
    state.life!.comfort = comfort;
    scene.platformId = "companion-home"; scene.platforms = [{ ...scene.platforms[0], id: scene.platformId, manualOnly: true }];
    const stored = structuredClone(state.life);

    expect(getLivingAction(state, scene, { ...prefs, learnFromYou: true }, now, () => .9)?.play).toBe(comfort < .6 ? undefined : "cozy-nest");
    expect(getLivingAction(state, scene, { ...prefs, learnFromYou: false }, now, () => .9)).toBeUndefined();
    expect(state.life).toEqual(stored);
  });

  it.each(["play", "curiosity"] as const)("uses the default cheer choice with learning off for low and high learned %s", trait => {
    for (const tendency of [.1, .9]) {
      const state = brain(), scene = world();
      state.life![trait] = tendency;
      const stored = structuredClone(state.life);

      expect(getLivingAction(state, scene, { ...prefs, learnFromYou: true }, now, () => 0)?.play).toBe(tendency < .4 ? undefined : "cheer-rehearsal");
      expect(getLivingAction(state, scene, { ...prefs, learnFromYou: false }, now, () => 0)?.play).toBe("cheer-rehearsal");
      expect(state.life).toEqual(stored);
    }
  });
});
