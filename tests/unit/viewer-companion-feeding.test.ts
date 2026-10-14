import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import {
  advanceBrain, createBrain, findPlatformRoute, getAction, getFoodAction,
  reachablePlatforms, recordCompanionEvent, type CompanionBrain,
  type CompanionWorld, type Platform,
} from "@/lib/ui/viewer-companion/brain";
import { COMPANION_FULL_THRESHOLD } from "@/lib/ui/viewer-companion/care";

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

  it("full or feeding-disabled pets ignore both apples and lemons", () => {
    for (const kind of ["apple", "lemon"] as const) {
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
    expect(walks.every(action => action.target.x === 672 && action.target.platformId === "floor")).toBe(true);
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
