import { describe, expect, it } from "vitest";
import { commitAction, createBrain, getAction, type CompanionAction, type CompanionBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { companionAttentionPoint, deliberateCompanionAction, type CompanionAttention } from "@/lib/ui/viewer-companion/deliberation";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

const prefs = { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, heartPrank: false, ambientPrank: false, panelPrank: false };
const floor: Platform = { id: "floor", x: 0, y: 700, width: 1000, kind: "floor" };
const low: Platform = { id: "low", x: 100, y: 580, width: 120, kind: "card" };
const mid: Platform = { id: "mid", x: 150, y: 460, width: 120, kind: "card" };
const high: Platform = { id: "high", x: 250, y: 340, width: 100, kind: "card" };
const world: CompanionWorld = { x: 40, y: 700, platformId: floor.id, platforms: [floor, low, mid, high], width: 1000, height: 800 };
const fresh = (): CompanionBrain => ({ ...createBrain(0, () => .5), energy: .85, curiosity: .8, hunger: .1 });
const choose = (brain = fresh(), context = world, now = 0) => getAction(brain, context, prefs, now, () => .5);

describe("visible local companion deliberation", () => {
  it("observes the actual expedition once, then replans its same normalized goal against moved geometry", () => {
    const brain = fresh(), candidate = choose(brain), prelude = deliberateCompanionAction(brain, world, prefs, candidate);
    expect(prelude).toMatchObject({ kind: "look", target: { x: world.x, y: world.y, platformId: floor.id }, intention: { ...candidate.intention, stage: "consider" }, attention: { kind: "inspect" } });
    expect(prelude.duration).toBe(330);
    const state = commitAction(brain, prelude, 0);
    const moved = { ...world, x: world.x + 23, y: world.y + 40, platforms: world.platforms.map(platform => ({ ...platform, x: platform.x + 23, y: platform.y + 40 })) };
    const next = choose(state, moved, 1000), decided = deliberateCompanionAction(state, moved, prefs, next);
    expect(next.intention?.targetId).toBe(candidate.intention?.targetId);
    expect(next.intention?.stage).toBe("travel");
    expect(next.target.x).toBeCloseTo(candidate.target.x + 23);
    expect(next.target.y).toBe(candidate.target.y + 40);
    expect(decided).toBe(next);
  });

  it("binds an ordinary new-platform transfer but never adds a pause to same-support walking or hopping", () => {
    const brain = fresh(), transfer: CompanionAction = { kind: "jump", target: { x: 160, y: low.y, platformId: low.id }, duration: 950 };
    const prelude = deliberateCompanionAction(brain, world, prefs, transfer);
    expect(prelude.intention).toMatchObject({ kind: "explore", targetId: low.id, offset: .5, remaining: 12, stage: "consider" });
    for (const kind of ["walk", "jump"] as const) {
      const local: CompanionAction = { kind, target: { x: 100, y: floor.y, platformId: floor.id }, duration: 650 };
      expect(deliberateCompanionAction(brain, world, prefs, local)).toBe(local);
    }
    const manual = { ...low, manualOnly: true };
    expect(deliberateCompanionAction(brain, { ...world, platforms: [floor, manual] }, prefs, transfer)).toBe(transfer);
  });

  it.each(["deleted", "blocked"] as const)("briefly reconsiders a %s retained goal once and remembers its outcome", mode => {
    const first = choose(), brain = commitAction(fresh(), deliberateCompanionAction(fresh(), world, prefs, first), 0);
    const altered = { ...world, platforms: mode === "deleted" ? world.platforms.filter(platform => platform.id !== brain.intention?.targetId) : world.platforms.map(platform => platform.id === brain.intention?.targetId ? { ...platform, x: 5000 } : platform) };
    const candidate = choose(brain, altered, 1000), reconsidered = deliberateCompanionAction(brain, altered, prefs, candidate);
    expect(reconsidered).toMatchObject({ kind: "look", duration: 480, target: { x: world.x, y: world.y }, attention: { kind: "reconsider", goal: brain.intention } });
    expect(reconsidered.intention).toBeUndefined(); expect(reconsidered.foodId).toBeUndefined();
    const nextBrain = commitAction(brain, reconsidered, 1000);
    expect(nextBrain.intention).toBeUndefined();
    expect(nextBrain.places.find(place => place.id === brain.intention?.targetId)).toMatchObject({ failures: 1, retryAfter: 8000 });
    const alternative = choose(nextBrain, altered, 2000), next = deliberateCompanionAction(nextBrain, altered, prefs, alternative);
    expect(next.attention?.kind).not.toBe("reconsider");
    expect(next.intention?.targetId).not.toBe(brain.intention?.targetId);
  });

  it("ignores exploratory route-proof failures that do not concern an already retained goal", () => {
    const candidate = { ...choose(), outcomes: [{ targetId: "unreachable-unselected", result: "blocked" as const }] };
    expect(deliberateCompanionAction(fresh(), world, prefs, candidate).attention?.kind).toBe("inspect");
    const previous = { ...candidate.intention!, targetId: "different-retained" };
    expect(deliberateCompanionAction({ ...fresh(), intention: previous }, world, prefs, candidate).attention?.kind).not.toBe("reconsider");
  });

  it("inspects one selected snack, keeps it when a closer snack appears, and still eats immediately when near or urgent", () => {
    const food = { id: "chosen", x: 290, y: high.y, platformId: high.id, kind: "apple" as const };
    const hungry = { ...fresh(), hunger: .7 }, context = { ...world, foods: [food] }, candidate = choose(hungry, context);
    const prelude = deliberateCompanionAction(hungry, context, prefs, candidate);
    expect(prelude).toMatchObject({ kind: "look", foodId: food.id, intention: { kind: "feed", stage: "consider", foodId: food.id } });
    expect(companionAttentionPoint(prelude.attention, context.platforms, context.foods)).toEqual({ x: food.x, y: food.y });
    const brain = commitAction(hungry, prelude, 0), closer = { ...food, id: "closer", x: 50, y: floor.y, platformId: floor.id };
    const offered = { ...context, foods: [closer, food] }, next = choose(brain, offered, 1000);
    expect(next.foodId).toBe(food.id); expect(deliberateCompanionAction(brain, offered, prefs, next)).toBe(next);
    const urgent = { ...hungry, hunger: .85 }, urgentAction = choose(urgent, context);
    expect(deliberateCompanionAction(urgent, context, prefs, urgentAction)).toBe(urgentAction);
    const nearby = { ...world, foods: [closer] }, eat = choose(hungry, nearby);
    expect(eat.kind).toBe("eat"); expect(deliberateCompanionAction(hungry, nearby, prefs, eat)).toBe(eat);
  });

  it("does not inspect a missing snack or bypass motion and preference authorities", () => {
    const brain = fresh(), candidate = choose(brain);
    for (const patch of [{ enabled: false }, { roam: false }]) {
      const gated = { ...prefs, ...patch }, next = getAction(brain, world, gated, 0, () => .5);
      expect(deliberateCompanionAction(brain, world, gated, next)).toBe(next);
    }
    const grounded = { ...prefs, jump: false }, walk = getAction(brain, world, grounded, 0, () => .5);
    expect(walk).toMatchObject({ kind: "walk", target: { platformId: floor.id }, intention: { kind: "explore" } });
    const inspect = deliberateCompanionAction(brain, world, grounded, walk);
    expect(inspect).toMatchObject({ kind: "look", intention: { ...walk.intention, stage: "consider" } });
    expect(getAction(commitAction(brain, inspect, 0), world, grounded, inspect.duration + 60, () => .5)).toMatchObject({ kind: "walk", target: walk.target });
    expect(deliberateCompanionAction(brain, world, prefs, candidate, false)).toBe(candidate);
    expect(deliberateCompanionAction(brain, { ...world, paused: true }, prefs, candidate)).toBe(candidate);
    const missing: CompanionAction = { ...candidate, foodId: "missing", intention: { kind: "feed", foodId: "missing", targetId: high.id, offset: .5, remaining: 12, stage: "travel" } };
    expect(deliberateCompanionAction(brain, world, prefs, missing)).toBe(missing);
  });

  it("gives an existing social pose a live pointer cue without introducing another action", () => {
    const candidate: CompanionAction = { kind: "sniff", target: { x: world.x, y: world.y, platformId: floor.id }, duration: 800 };
    const context = { ...world, pointer: { x: 100, y: 620 } };
    const dog = deliberateCompanionAction(fresh(), context, { ...prefs, animalMode: "dog" }, candidate);
    expect(dog).toMatchObject({ ...candidate, direction: 1, attention: { kind: "social", point: context.pointer } });
    expect(deliberateCompanionAction(fresh(), context, { ...prefs, animalMode: "cat" }, candidate)).toBe(candidate);
    expect(deliberateCompanionAction(fresh(), context, { ...prefs, animalMode: "cat", personality: "affectionate" }, candidate).attention?.kind).toBe("social");
    expect(deliberateCompanionAction(fresh(), { ...context, pointer: { x: 700, y: 620 } }, { ...prefs, animalMode: "dog" }, candidate)).toBe(candidate);
    expect(deliberateCompanionAction(fresh(), { ...context, pointer: { x: NaN, y: 620 } }, { ...prefs, animalMode: "dog" }, candidate)).toBe(candidate);
  });

  it("paces short observations by species/gait, stays finite, deterministic and immutable", () => {
    const brain = fresh(), candidate = choose(brain), before = JSON.stringify({ brain, world, candidate, prefs });
    const durations = new Map<string, number>();
    for (const animalMode of ["default", "dog", "cat"] as const) for (const speed of ["relaxed", "normal", "lively"] as const) {
      const preferences = { ...prefs, animalMode, speed };
      const action = deliberateCompanionAction(brain, world, preferences, candidate);
      expect(action).toEqual(deliberateCompanionAction(brain, world, preferences, candidate));
      expect(Number.isFinite(action.duration)).toBe(true); expect(action.duration).toBeGreaterThanOrEqual(180); expect(action.duration).toBeLessThanOrEqual(520);
      durations.set(`${animalMode}-${speed}`, action.duration);
    }
    expect(durations.get("cat-normal")!).toBeGreaterThan(durations.get("dog-normal")!);
    expect(durations.get("default-relaxed")!).toBeGreaterThan(durations.get("default-lively")!);
    expect(JSON.stringify({ brain, world, candidate, prefs })).toBe(before);
  });

  it("resolves only the referenced live geometry or snack and rejects invalid or deleted references", () => {
    const goal = { kind: "explore" as const, targetId: high.id, offset: .25, remaining: 12, stage: "consider" as const };
    const attention: CompanionAttention = { kind: "inspect", goal };
    expect(companionAttentionPoint(attention, world.platforms)).toEqual({ x: 275, y: high.y });
    expect(companionAttentionPoint(attention, [{ ...high, x: 400, y: 250, width: 200 }])).toEqual({ x: 450, y: 250 });
    expect(companionAttentionPoint(attention, [low])).toBeUndefined();
    expect(companionAttentionPoint(attention, [{ ...high, width: NaN }])).toBeUndefined();
    expect(companionAttentionPoint({ ...attention, goal: { ...goal, offset: Infinity } }, world.platforms)).toBeUndefined();
    expect(companionAttentionPoint({ ...attention, goal: { ...goal, offset: 2 } }, world.platforms)).toEqual({ x: 350, y: high.y });
    const feedAttention: CompanionAttention = { kind: "inspect", goal: { ...goal, kind: "feed", foodId: "chosen" } };
    const apple = { id: "chosen", x: 60, y: 650, platformId: floor.id, kind: "apple" as const };
    expect(companionAttentionPoint(feedAttention, world.platforms, [apple])).toEqual({ x: 60, y: 650 });
    expect(companionAttentionPoint(feedAttention, world.platforms, [{ ...apple, id: "other" }])).toBeUndefined();
    expect(companionAttentionPoint(feedAttention, world.platforms, [{ ...apple, x: NaN }])).toBeUndefined();
    expect(companionAttentionPoint({ kind: "social", point: { x: 30, y: 40 } }, [])).toEqual({ x: 30, y: 40 });
    expect(companionAttentionPoint({ kind: "social", point: { x: Infinity, y: 40 } }, [])).toBeUndefined();
    expect(companionAttentionPoint(undefined, [])).toBeUndefined();
  });
});
