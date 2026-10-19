import { describe, expect, it } from "vitest";
import { advanceBrain, commitAction, createBrain, getAction, getFoodAction, type CompanionBrain, type CompanionFood, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { getLivingAction } from "@/lib/ui/viewer-companion/living";
import { companionFoodAcceptance, createCompanionFoodCuriosity } from "@/lib/ui/viewer-companion/novel-food";
import { createCompanionHousehold } from "@/lib/ui/viewer-companion/household";
import { companionPresenceActive, createCompanionPresence } from "@/lib/ui/viewer-companion/presence";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES, normalizeCompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_TIMING } from "@/lib/ui/viewer-companion/timing";

const preferences = { ...DEFAULT_COMPANION_PREFERENCES };
const floor: Platform = { id: "floor", x: 0, y: 600, width: 1000, kind: "floor" };
const world: CompanionWorld = { x: 100, y: 600, width: 1000, height: 700, platformId: floor.id, platforms: [floor], animated: true };
const brain = (): CompanionBrain => ({ ...createBrain(0, () => .5), hunger: .1, energy: .9, activeMs: 0 });

describe("visible activity, automatic sleep and distinct companion personalities", () => {
  it("adopts active visible behavior for old records and round-trips all eight explicit personalities", () => {
    expect(normalizeCompanionPreferences({ enabled: false, sleep: false })).toMatchObject({ enabled: false, sleep: false, activeWhileVisible: true });
    expect(normalizeCompanionPreferences({ activeWhileVisible: false })).toMatchObject({ activeWhileVisible: false });
    expect(normalizeCompanionPreferences({ activeWhileVisible: "true", personality: "private-canary" })).toMatchObject({ activeWhileVisible: true, personality: "curious" });
    expect(COMPANION_PERSONALITIES).toHaveLength(8);
    for (const personality of COMPANION_PERSONALITIES) expect(normalizeCompanionPreferences({ personality }).personality).toBe(personality);
  });

  it("keeps visible unfocused sources active while hidden and blocked sources remain inactive", () => {
    for (const focused of [false, true]) {
      expect(companionPresenceActive({ focused, visible: true, activeWhileVisible: true })).toBe(true);
      expect(companionPresenceActive({ focused, visible: false, activeWhileVisible: true })).toBe(false);
      expect(companionPresenceActive({ focused, visible: true, activeWhileVisible: true, blocked: true })).toBe(false);
    }
    expect(companionPresenceActive({ focused: false, visible: true, activeWhileVisible: false })).toBe(false);
    expect(companionPresenceActive({ focused: true, visible: true, activeWhileVisible: false })).toBe(true);
  });

  it("parks the existing passive clock with a neutral awake frame when automatic sleep is OFF", () => {
    const presence = createCompanionPresence(false, 0, { autoSleep: false });
    const neutral = () => { expect(presence.pose).toEqual({ row: 0, status: "idle" }); expect(presence.dreaming).toBe(false); };
    neutral(); presence.step(0, false); neutral();
    presence.step(COMPANION_TIMING.presenceRest, false); neutral();
    expect(presence.step(COMPANION_TIMING.presenceRest + COMPANION_TIMING.presenceYawn, false)).toBe("parked"); neutral();
    presence.focus(true, 10000); neutral();
    expect(presence.step(10000 + COMPANION_TIMING.presenceWake, false)).toBe("active"); neutral();
    const sleeping = createCompanionPresence(false, 0);
    sleeping.step(0, false); sleeping.step(COMPANION_TIMING.presenceRest, false);
    expect(sleeping.pose).toEqual({ row: 10, status: "yawn" });
    sleeping.step(COMPANION_TIMING.presenceRest + COMPANION_TIMING.presenceYawn, false);
    expect(sleeping.pose).toEqual({ row: 11, status: "sleep" }); expect(sleeping.dreaming).toBe(true);
  });

  it("recovers fatigue through quiet awake actions without absence catch-up or automatic sleep", () => {
    const tired = { ...brain(), energy: .1, recent: ["idle" as const] }, off = { ...preferences, sleep: false };
    const rested = advanceBrain(tired, 30000, false, off);
    expect(rested.energy).toBeGreaterThan(tired.energy); expect(rested.activeMs).toBe(30000);
    expect(advanceBrain(tired, 86400000, false, off)).toEqual(rested);
    expect(advanceBrain(tired, 0, false, off).energy).toBe(tired.energy);
    expect(advanceBrain(tired, 30000, false, preferences).energy).toBeLessThan(tired.energy);
    for (const personality of COMPANION_PERSONALITIES) for (const draw of [0, .1, .4, .8, .999]) {
      const action = getAction(tired, world, { ...off, personality }, 10000, () => draw);
      expect(action.kind).not.toBe("sleep"); expect(action.intention?.kind).not.toBe("rest");
    }
  });

  it.each([{ animalMode: "dog" as const }, { personality: "affectionate" as const }])("notices a stable nearby pointer in the first active second: %j", change => {
    const state = brain(), scene = { ...world, pointer: { x: 135, y: 590, stableMs: 200 } }, settings = { ...preferences, ...change };
    const action = getLivingAction(state, scene, settings, 750, () => .99)!;
    expect(action).toMatchObject({ kind: "play", play: "ask-petting", attention: { kind: "social", point: { x: 135, y: 590 } } });
    const committed = commitAction(state, action, 750);
    expect(committed.affection).toBe(state.affection); expect(committed.life).toEqual(state.life);
    expect(getLivingAction(committed, scene, settings, 750 + action.duration, () => .99)).toBeUndefined();
    for (const patch of [{ petting: false }, { roam: false }, { enabled: false }]) expect(getLivingAction(state, scene, { ...settings, ...patch }, 750)).toBeUndefined();
    expect(getLivingAction(state, { ...scene, paused: true }, settings, 750)).toBeUndefined();
    expect(getLivingAction(state, { ...scene, pointer: { ...scene.pointer, stableMs: 199 } }, settings, 750)).toBeUndefined();
  });

  it("allows at most one short unfamiliar-food inspection for dogs and gourmets, preserving full refusal", () => {
    const food: CompanionFood = { id: "actual-meal", x: 115, y: 600, platformId: floor.id, kind: "bagel" };
    const scene = { ...world, foods: [food] }, hungry = { ...brain(), hunger: .7 };
    for (const change of [{ animalMode: "dog" as const }, { personality: "gourmet" as const }]) {
      const settings = { ...preferences, ...change }, meal = getFoodAction(hungry, scene, settings, 0)!;
      const curiosity = createCompanionFoodCuriosity(() => .999), inspect = curiosity.consider(meal, food, false, hungry.hunger, settings);
      expect(inspect).toMatchObject({ kind: "sniff", duration: 500, foodId: food.id, effectPoint: meal.effectPoint });
      expect(curiosity.consider(meal, food, false, hungry.hunger, settings)).toBe(meal);
      expect(getFoodAction({ ...hungry, hunger: .1 }, scene, settings, 0)).toBeUndefined();
      expect(getFoodAction(hungry, scene, { ...settings, feeding: false }, 0)).toBeUndefined();
    }
    expect(companionFoodAcceptance("bagel", .1, { ...preferences, personality: "gourmet" }).chance).toBeGreaterThan(companionFoodAcceptance("bagel", .1, preferences).chance);
    expect(hungry.hunger).toBe(.7); expect(scene.foods).toEqual([food]);
  });

  it("lets performers rehearse early on a real safe support, yielding to a meal and pause", () => {
    const state = { ...brain(), activeMs: 8000 }, performer = { ...preferences, personality: "performer" as const };
    expect(getLivingAction(state, world, performer, 8000, () => .99)).toMatchObject({ kind: "play", play: "cheer-rehearsal" });
    expect(getLivingAction(state, world, preferences, 8000, () => 0)).toBeUndefined();
    expect(getLivingAction({ ...state, foodGoal: { foodId: "actual-meal", remaining: 8, retryAfter: 0 } }, world, performer, 8000)).toBeUndefined();
    expect(getLivingAction(state, { ...world, paused: true }, performer, 8000)).toBeUndefined();
    expect(getLivingAction(state, { ...world, platforms: [{ ...floor, kind: "control" }] }, performer, 8000)).toBeUndefined();
  });

  it("visits a real reachable home while awake and never substitutes a missing home or disabled route", () => {
    const home: Platform = { id: "companion-home", x: 500, y: 600, width: 180, kind: "date" };
    const state = { ...brain(), activeMs: 16000 }, settings = { ...preferences, personality: "homebody" as const, sleep: false }, scene = { ...world, platforms: [floor, home] };
    const visit = getAction(state, scene, settings, 16000, () => .5);
    expect(visit).toMatchObject({ kind: "walk", intention: { kind: "explore", targetId: home.id } });
    let moving = visit, nextBrain = state, point = scene, now = 16000;
    for (let step = 0; step < 8 && moving.intention?.stage !== "observe"; step++) {
      nextBrain = commitAction(nextBrain, moving, now); now += moving.duration;
      point = { ...point, ...moving.target }; moving = getAction(nextBrain, point, settings, now, () => .5);
    }
    const arrived = moving;
    expect(arrived).toMatchObject({ kind: "look", intention: { kind: "explore", stage: "observe", targetId: home.id } });
    expect(getAction(state, world, settings, 16000, () => .5).intention?.targetId).not.toBe(home.id);
    expect(getAction(state, scene, { ...settings, roam: false }, 16000, () => .5).intention).toBeUndefined();
    expect(getAction(state, scene, { ...settings, jump: false }, 16000, () => .5).intention?.targetId).not.toBe(home.id);
  });

  it("finds one distant snack for tidy disposal only through both real routes and yields to hunger", () => {
    const food: CompanionFood = { id: "far-snack", x: 850, y: 600, platformId: floor.id, kind: "apple" };
    const room: Platform = { id: "companion-home-floor", x: 900, y: 600, width: 100, kind: "floor", manualOnly: true };
    const context = { brain: brain(), world: { ...world, platforms: [{ ...floor, width: 880 }, room], foods: [food] }, preferences: { ...preferences, personality: "tidy" as const, ambientPrank: false }, now: 0, home: { bin: { x: 950, y: 600, platformId: room.id } }, count: 1 };
    const approach = createCompanionHousehold(() => 0).next(context);
    expect(approach).toMatchObject({ kind: "walk", target: { x: 850, platformId: floor.id }, household: { kind: "tidy", foodId: food.id } });
    expect(createCompanionHousehold(() => 0).next({ ...context, brain: { ...context.brain, hunger: .6 } })).toBeUndefined();
    expect(createCompanionHousehold(() => 0).next({ ...context, home: {} })).toBeUndefined();
    expect(createCompanionHousehold(() => 0).next({ ...context, home: { bin: { x: 950, y: 600, platformId: "missing" } } })).toBeUndefined();
    expect(createCompanionHousehold(() => 0).next({ ...context, home: { bin: { x: 850, y: 600, platformId: floor.id } } })).toBeUndefined();
    expect(food.x).toBe(850);
  });
});
