import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import {
  advanceBrain, commitAction, createBrain, findPlatformRoute, getAction, getFoodAction, COMPANION_ROUTE_LIMITS,
  reachablePlatforms, recordCompanionEvent, type CompanionBrain,
  type CompanionWorld, type Platform,
} from "@/lib/ui/viewer-companion/brain";
import { COMPANION_FULL_THRESHOLD } from "@/lib/ui/viewer-companion/care";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { MAX_COMPANION_FOOD } from "@/lib/ui/viewer-companion/food-capacity";
import { COMPANION_FEED_ACTION_BUDGET, COMPANION_FEED_RETRY_MS } from "@/lib/ui/viewer-companion/planner";
import { companionEpisodeRunHop } from "@/lib/ui/viewer-companion/episodes";

const prefs = { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, feeding: true };
const floor: Platform = { id: "floor", x: 0, y: 700, width: 1000, kind: "floor" };
const low: Platform = { id: "low", x: 100, y: 580, width: 120, kind: "card" };
const mid: Platform = { id: "mid", x: 150, y: 460, width: 120, kind: "card" };
const high: Platform = { id: "high", x: 250, y: 340, width: 100, kind: "card" };
const world: CompanionWorld = { x: 40, y: 700, platformId: floor.id, platforms: [floor, low, mid, high], width: 1000, height: 800 };
const food = { id: "apple-1", x: 290, y: 340, platformId: high.id, kind: "apple" as const };
const hungry = () => createBrain(0, () => .5);
function seeded(seed = 321) {
  let value = seed;
  return () => { value = Math.imul(value, 1664525) + 1013904223 | 0; return (value >>> 0) / 4294967296; };
}

describe("local companion feeding and animal habits", () => {
  it("starts ready to feed, gains hunger only from supplied active time and never catches up absence", () => {
    const brain = hungry();
    expect(brain.hunger).toBe(.58);
    expect(advanceBrain(brain, 1000).hunger).toBeGreaterThan(brain.hunger);
    expect(advanceBrain(brain, 0)).toEqual(brain);
    expect(advanceBrain(brain, 86400000)).toEqual(advanceBrain(brain, 30000));
    expect(advanceBrain({ ...brain, hunger: .999 }, 30000).hunger).toBe(1);
  });

  it("eating satisfies hunger and increases affection without overfeeding a full creature", () => {
    const brain = hungry(), fed = recordCompanionEvent(brain, "ate");
    expect(fed.hunger).toBeCloseTo(.22);
    expect(fed.affection).toBeGreaterThan(brain.affection);
    expect(fed.energy).toBeGreaterThan(brain.energy);
    expect(recordCompanionEvent(fed, "ate")).toEqual(fed);
    expect(recordCompanionEvent({ ...brain, hunger: COMPANION_FULL_THRESHOLD }, "ate").hunger).toBe(0);
  });

  it("finds a concrete three-jump route with explicit walking before takeoff", () => {
    const route = findPlatformRoute(world, food, world.platforms)!;
    expect(route).not.toBeNull();
    expect(route[0].kind).toBe("walk");
    expect(route.filter(step => step.kind === "jump").map(step => step.target.platformId)).toEqual(["low", "mid", "high"]);
    let point = { x: world.x, y: world.y, platformId: world.platformId };
    for (const step of route) {
      const support = world.platforms.find(p => p.id === step.target.platformId)!;
      if (step.kind === "jump") expect(reachablePlatforms(point, [support])).toHaveLength(1);
      else { expect(step.target.platformId).toBe(point.platformId); expect(step.target.y).toBe(point.y); }
      point = step.target;
    }
    expect(point).toEqual({ x: food.x, y: food.y, platformId: food.platformId });
  });

  it("finishes the same food route rather than picking random intermediate ledges", () => {
    let context = { ...world, foods: [food] };
    let previousLength = Infinity;
    let ate = false;
    for (let i = 0; i < 15; i++) {
      const routeLength = findPlatformRoute(context, food, context.platforms)!.length;
      expect(routeLength).toBeLessThan(previousLength);
      previousLength = routeLength;
      const action = getAction(hungry(), context, prefs, 100000 + i * 5000, seeded(i));
      expect(action.foodId).toBe(food.id);
      if (action.kind === "eat") { ate = true; break; }
      expect(["walk", "jump"]).toContain(action.kind);
      context = { ...context, ...action.target };
    }
    expect(ate).toBe(true);
  });

  it("remembers and completes a visible twelve-hop meal route with a decreasing finite action budget", () => {
    const ground: Platform = { ...floor, y: 1900 };
    const ledges: Platform[] = Array.from({ length: COMPANION_ROUTE_LIMITS.maxHops }, (_, i) => ({ id: `ledge-${i}`, x: 100, y: 1780 - i * 120, width: 100, kind: "card" }));
    const last = ledges.at(-1)!, snack = { ...food, x: 150, y: last.y, platformId: last.id };
    let context: CompanionWorld = { ...world, x: 150, y: ground.y, platformId: ground.id, platforms: [ground, ...ledges], foods: [snack], height: 2100 }, state = hungry();
    let jumps = 0, ate = false;
    for (let step = 0; step < COMPANION_FEED_ACTION_BUDGET; step++) {
      const action = getAction(state, context, prefs, 100000 + step * 5000, seeded(step));
      expect(action.foodId).toBe(snack.id);
      expect(action.intention?.remaining).toBe(COMPANION_FEED_ACTION_BUDGET - step);
      state = commitAction(state, action, 100000 + step * 5000);
      expect(state.foodGoal).toMatchObject({ foodId: snack.id, remaining: COMPANION_FEED_ACTION_BUDGET - step - 1 });
      if (action.kind === "eat") { ate = true; break; }
      expect(action.kind).toBe("jump"); jumps++; context = { ...context, ...action.target };
    }
    expect(jumps).toBe(12); expect(ate).toBe(true);
    expect(recordCompanionEvent(state, "ate").foodGoal).toBeUndefined();
    const thirteenth = { ...last, id: "thirteenth", y: last.y - 120 };
    expect(findPlatformRoute({ x: 150, y: ground.y, platformId: ground.id }, { x: 150, y: thirteenth.y, platformId: thirteenth.id }, [ground, ...ledges, thirteenth])).toBeNull();
  });

  it("finishes one clear supported food span without artificial180px stops or a renewed meal budget", () => {
    const snack = { ...food, x: 800, y: floor.y, platformId: floor.id };
    const context: CompanionWorld = { ...world, foods: [snack] }, action = getFoodAction(hungry(), context, prefs, 100000)!;
    expect(action.kind).toBe("walk"); expect(action.target).toEqual({ x: snack.x, y: floor.y, platformId: floor.id });
    expect(action.duration).toBeCloseTo((snack.x - world.x) / 70 * 1000);
    const state = commitAction(hungry(), action, 100000);
    expect(state.foodGoal?.remaining).toBe(COMPANION_FEED_ACTION_BUDGET - 1);
    expect(getFoodAction(state, { ...context, ...action.target }, prefs, 130000)).toMatchObject({ kind: "eat", foodId: snack.id });
    expect(getFoodAction(state, { ...context, x: 790 }, prefs, 130000)).toMatchObject({ kind: "eat", target: { x: 790, y: floor.y } });
  });

  it.each(["bound", "bound-slip"] as const)("%s reserves only a proved running takeoff while retaining the same final snack", variant => {
    const snack = { ...food, x: 800, y: floor.y, platformId: floor.id }, options = { ...prefs, speed: "lively" as const };
    const context = { ...world, foods: [snack], animated: true };
    const brain: CompanionBrain = { ...hungry(), energy: .9, episode: { kind: "meal", phase: "greet", variant, remaining: 22, foodId: snack.id, mishapUsed: false, legs: 0 } };
    const action = getAction(brain, context, options, 100000, () => 0);
    expect(action).toMatchObject({ kind: "walk", pace: "scoot", foodId: snack.id, intention: { kind: "feed", foodId: snack.id, targetId: floor.id } });
    expect(action.target.x - context.x).toBeGreaterThan(180); expect(action.target.x).toBeLessThan(snack.x - 112);
    const state = commitAction(brain, action, 100000), hop = companionEpisodeRunHop(action, context, floor, [snack], state, options)!;
    expect(hop).toMatchObject({ kind: "jump", foodId: snack.id });
    expect(hop.target.x).toBeCloseTo(snack.x - 112); expect(hop.runUp).toBeCloseTo((action.target.x - context.x) / action.duration * 1000);
    const landed = commitAction(state, hop, 100000 + action.duration);
    const last = getFoodAction(landed, { ...context, ...hop.target }, options, 130000)!;
    expect(last).toMatchObject({ kind: "walk", foodId: snack.id, target: { x: snack.x, y: floor.y, platformId: floor.id } });
    expect(last.intention?.remaining).toBe(COMPANION_FEED_ACTION_BUDGET - 2);
    expect(getFoodAction(brain, context, { ...options, jump: false }, 100000)?.target.x).toBe(snack.x);
  });

  it("keeps only the food identity and budget while unavailable, then replans fresh geometry before a closer new snack", () => {
    const first = getFoodAction(hungry(), { ...world, foods: [food] }, prefs, 100000)!;
    const state = commitAction(hungry(), first, 100000), memory = state.foodGoal;
    expect(getFoodAction(state, { ...world, foods: [] }, prefs, 101000)).toBeUndefined();
    const rested = commitAction(state, { kind: "look", target: { x: world.x, y: world.y, platformId: floor.id }, duration: 900 }, 101000);
    expect(rested.foodGoal).toEqual(memory); expect(rested.intention).toBeUndefined();
    const moved = { ...food, x: 360 }, closer = { ...food, id: "new-near", x: world.x + 10, y: floor.y, platformId: floor.id };
    const next = getFoodAction(rested, { ...world, foods: [closer, moved] }, prefs, 102000)!;
    expect(next.foodId).toBe(food.id); expect(next.intention?.remaining).toBe(COMPANION_FEED_ACTION_BUDGET - 1);
    expect(getFoodAction(rested, { ...world, foods: [moved], platforms: [floor] }, prefs, 102000)).toBeUndefined();
    expect(recordCompanionEvent(rested, "food-lost").foodGoal).toBeUndefined();
  });

  it("yields after its finite attempts and retries only after four seconds of supplied active time", () => {
    const state = { ...hungry(), foodGoal: { foodId: food.id, remaining: 1, retryAfter: 0 }, activeMs: 500 };
    const action = getFoodAction(state, { ...world, foods: [food] }, prefs, 100000)!;
    expect(action.intention?.remaining).toBe(1);
    const waiting = commitAction(state, action, 100000);
    expect(waiting.foodGoal).toEqual({ foodId: food.id, remaining: 0, retryAfter: 500 + COMPANION_FEED_RETRY_MS });
    expect(getFoodAction(waiting, { ...world, foods: [food] }, prefs, 86400000)).toBeUndefined();
    const ready = advanceBrain(waiting, COMPANION_FEED_RETRY_MS);
    expect(getFoodAction(ready, { ...world, foods: [food] }, prefs, 86401000)?.intention?.remaining).toBe(COMPANION_FEED_ACTION_BUDGET);
    expect(getFoodAction({ ...ready, hunger: .2 }, { ...world, foods: [food] }, prefs, 86401000)).toBeUndefined();
    expect(getFoodAction(ready, { ...world, foods: [food] }, { ...prefs, roam: false }, 86401000)).toBeUndefined();
    expect(getFoodAction(ready, { ...world, foods: [food] }, { ...prefs, jump: false }, 86401000)).toBeUndefined();
  });

  it("never substitutes a different platform for a missing or out-of-budget named food support", () => {
    const identical = Array.from({ length: COMPANION_ROUTE_LIMITS.maxNodes }, (_, i) => ({ ...floor, id: `safe-${i}` }));
    const beyond = { ...floor, id: "outside-bounded-graph" };
    expect(findPlatformRoute(world, { x: food.x, y: floor.y, platformId: "missing" }, [floor])).toBeNull();
    expect(findPlatformRoute({ ...world, platformId: identical[0].id }, { x: 150, y: floor.y, platformId: beyond.id }, [...identical, beyond])).toBeNull();
  });

  it("rejects impossible gaps, unsupported food and jumping disabled", () => {
    expect(findPlatformRoute(world, food, [floor, high])).toBeNull();
    expect(findPlatformRoute(world, food, world.platforms, false)).toBeNull();
    expect(getFoodAction(hungry(), { ...world, foods: [{ ...food, y: 250 }] }, prefs, 100000)).toBeUndefined();
    expect(getFoodAction(hungry(), { ...world, foods: [food] }, { ...prefs, jump: false }, 100000)).toBeUndefined();
  });

  it("roaming OFF permits nearby eating only and never pulls or teleports the pet", () => {
    const near = { ...food, x: 63, y: 700, platformId: "floor" };
    const still = { ...prefs, roam: false };
    const action = getFoodAction(hungry(), { ...world, foods: [near] }, still, 100000)!;
    expect(action.kind).toBe("eat"); expect(action.target.x).toBe(world.x); expect(action.target.y).toBe(world.y);
    expect(getFoodAction(hungry(), { ...world, foods: [{ ...near, x: 100 }] }, still, 100000)).toBeUndefined();
    expect(getFoodAction(hungry(), { ...world, foods: [food] }, still, 100000)).toBeUndefined();
  });

  it("can eat the eighth offered snack while bounding any ninth input outside local capacity", () => {
    const unreachable = Array.from({ length: MAX_COMPANION_FOOD - 1 }, (_, i) => Object.freeze({ ...food, id: `unreachable-${i}`, y: 250, platformId: `missing-${i}` }));
    const last = Object.freeze({ ...food, id: "eighth", x: world.x + 10, y: world.y, platformId: world.platformId });
    const foods = Object.freeze([...unreachable, last]);
    expect(getFoodAction(hungry(), { ...world, foods }, { ...prefs, roam: false }, 100000)).toMatchObject({ kind: "eat", foodId: last.id, target: { x: world.x, y: world.y } });
    const fullUnreachable = Object.freeze([...unreachable, { ...food, id: "unreachable-last", y: 250, platformId: "missing-last" }, last]);
    expect(getFoodAction(hungry(), { ...world, foods: fullUnreachable }, prefs, 100000)).toBeUndefined();
    expect(foods[MAX_COMPANION_FOOD - 1]).toBe(last);
  });

  it.each(COMPANION_FOOD_KINDS)("a hungry pet can eat the offered %s without moving its support", kind => {
    const context = { ...world, foods: [{ ...food, x: 50, y: 700, platformId: "floor", kind }] };
    const action = getFoodAction(hungry(), context, prefs, 100000);
    expect(action).toMatchObject({ kind: "eat", foodId: food.id, target: { x: world.x, y: world.y, platformId: world.platformId } });
  });

  it("full or feeding-disabled pets ignore all thirteen snacks", () => {
    for (const kind of COMPANION_FOOD_KINDS) {
      const context = { ...world, foods: [{ ...food, x: 50, y: 700, platformId: "floor", kind }] };
      expect(getFoodAction({ ...hungry(), hunger: .2 }, context, prefs, 100000)).toBeUndefined();
      expect(getFoodAction(hungry(), context, { ...prefs, feeding: false }, 100000)).toBeUndefined();
    }
  });

  it("direct food decisions honor the master and pause gates too", () => {
    const context = { ...world, foods: [{ ...food, x: 50, y: 700, platformId: "floor" }] };
    expect(getFoodAction(hungry(), context, { ...prefs, enabled: false }, 100000)).toBeUndefined();
    expect(getFoodAction(hungry(), { ...context, paused: true }, prefs, 100000)).toBeUndefined();
    expect(getFoodAction(hungry(), context, prefs, NaN)).toBeUndefined();
  });

  it("cat habits favor high ledges without modifying the character's anatomy", () => {
    const ground: Platform = { id: "current", x: 300, y: 500, width: 120, kind: "card" };
    const above: Platform = { id: "above", x: 300, y: 400, width: 120, kind: "card" };
    const below: Platform = { id: "below", x: 300, y: 600, width: 120, kind: "card" };
    const context = { ...world, x: 350, y: 500, platformId: "current", platforms: [ground, above, below] };
    const rng = seeded(), jumps: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const action = getAction(hungry(), context, { ...prefs, animalMode: "cat" }, 100000, rng);
      if (action.kind === "jump") jumps.push(action.target.platformId!);
    }
    expect(jumps.length).toBeGreaterThan(100);
    expect(jumps.filter(id => id === "above").length / jumps.length).toBeGreaterThan(.8);
  });

  it("dog habits approach the pointer on the current ledge and sniff without forbidden jumps", () => {
    const context = { ...world, x: 400, platformId: "floor", pointer: { x: 700, y: 680 } };
    const rng = seeded(), actions = Array.from({ length: 800 }, () => getAction(hungry(), context, { ...prefs, animalMode: "dog", jump: false }, 100000, rng));
    const walks = actions.filter(action => action.kind === "walk");
    expect(walks.length).toBeGreaterThan(250);
    expect(walks.every(action => action.target.x > context.x && action.target.x - context.x <= 140 && action.target.platformId === "floor")).toBe(true);
    let approaching = context, state = hungry(), now = 100000;
    // Each finite excursion preserves the same owner-approach intention. It
    // reaches the old672px stopping distance through small, valid steps.
    for (let step = 0; step < 3; step++) {
      const next = getAction(state, approaching, { ...prefs, animalMode: "dog", jump: false, heartPrank: false, ambientPrank: false }, now, () => .999999);
      expect(next.kind).toBe("walk");
      expect(next.target.x - approaching.x).toBeLessThanOrEqual(140);
      state = commitAction(state, next, now);
      approaching = { ...approaching, ...next.target };
      now += next.duration + 1000;
      if (approaching.x === 672) break;
    }
    expect(approaching.x).toBe(672);
    expect(actions.some(action => action.kind === "sniff")).toBe(true);
    expect(actions.some(action => action.kind === "jump")).toBe(false);
  });

  it("immutable feeding does not corrupt cooldowns or prior memory", () => {
    const brain: CompanionBrain = hungry();
    const old = JSON.stringify(brain);
    recordCompanionEvent(brain, "ate");
    expect(JSON.stringify(brain)).toBe(old);
  });
});
