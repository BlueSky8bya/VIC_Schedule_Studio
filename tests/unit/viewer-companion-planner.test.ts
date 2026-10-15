import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { commitAction, createBrain, findPlatformRoute, getAction, getFoodAction, platformLandingX, reachablePlatforms, type CompanionBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { planCompanionGoal, rememberCompanionOutcomes } from "@/lib/ui/viewer-companion/planner";

const prefs = { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: true, jump: true, sleep: true, feeding: true, heartPrank: false, ambientPrank: false };
const floor: Platform = { id: "floor", x: 0, y: 700, width: 1000, kind: "floor" };
const low: Platform = { id: "low", x: 100, y: 580, width: 120, kind: "card" };
const mid: Platform = { id: "mid", x: 150, y: 460, width: 120, kind: "card" };
const high: Platform = { id: "high", x: 250, y: 340, width: 100, kind: "card" };
const world: CompanionWorld = { x: 40, y: 700, platformId: floor.id, platforms: [floor, low, mid, high], width: 1000, height: 800 };
const fresh = (): CompanionBrain => ({ ...createBrain(0, () => .5), energy: .85, curiosity: .8, hunger: .1 });
const ports = { route: findPlatformRoute, landingX: platformLandingX, reachable: reachablePlatforms };

describe("environment-driven finite companion intentions", () => {
  it("keeps a multi-ledge exploration goal through real intermediate steps, then observes its destination", () => {
    let brain = fresh(), context = { ...world }, goal = "", jumps = 0, completed = false;
    for (let step = 0; step < 12; step++) {
      const action = getAction(brain, context, prefs, step * 5000, () => .5);
      expect(action.intention?.kind).toBe("explore");
      goal ||= action.intention!.targetId;
      expect(action.intention!.targetId).toBe(goal);
      if (action.kind === "jump") { jumps++; expect(reachablePlatforms(context, [{ ...context.platforms.find(p => p.id === action.target.platformId)!, x: action.target.x - 12, width: 24 }])).toHaveLength(1); }
      brain = commitAction(brain, action, step * 5000);
      if (action.intention!.stage === "observe") {
        expect(action.kind).toBe("look"); expect(context.platformId).toBe(goal);
        expect(brain.places.find(p => p.id === goal)).toMatchObject({ visits: 1, failures: 0 });
        completed = true; break;
      }
      context = { ...context, ...action.target };
    }
    expect(completed).toBe(true); expect(jumps).toBeGreaterThanOrEqual(2);
  });

  it("retains a valid goal when a novel opportunity appears instead of changing direction every landing", () => {
    const first = getAction(fresh(), world, prefs, 0, () => .2);
    const brain = commitAction(fresh(), first, 0), context = { ...world, ...first.target };
    const tempting: Platform = { id: "new-opportunity", x: 40, y: 350, width: 120, kind: "card" };
    const second = getAction(brain, { ...context, platforms: [...world.platforms, tempting] }, prefs, 5000, () => .999999);
    expect(second.intention?.targetId).toBe(first.intention!.targetId);
    expect(second.intention!.remaining).toBeLessThan(first.intention!.remaining);
  });

  it("replans after deletion or an impossible gap and carries one bounded failure outcome", () => {
    const initial = getAction(fresh(), world, prefs, 0, () => .5), brain = commitAction(fresh(), initial, 0);
    const removed = getAction(brain, { ...world, platforms: world.platforms.filter(p => p.id !== initial.intention!.targetId) }, prefs, 5000, () => .5);
    expect(removed.target.platformId).not.toBe(initial.intention!.targetId);
    expect(removed.outcomes).toContainEqual({ targetId: initial.intention!.targetId, result: "lost" });
    const shifted = getAction(brain, { ...world, platforms: world.platforms.map(p => p.id === initial.intention!.targetId ? { ...p, x: 5000 } : p) }, prefs, 5000, () => .5);
    expect(shifted.intention?.targetId).not.toBe(initial.intention!.targetId);
    expect(shifted.outcomes).toContainEqual({ targetId: initial.intention!.targetId, result: "blocked" });
    const committed = commitAction(brain, shifted, 5000);
    expect(committed.places.find(p => p.id === initial.intention!.targetId)).toMatchObject({ failures: 1, retryAfter: 8000 });
  });

  it("navigation preferences and immediate hunger override a retained exploration intention", () => {
    const first = getAction(fresh(), world, prefs, 0, () => .5), brain = commitAction(fresh(), first, 0);
    for (const changes of [{ roam: false }, { jump: false }, { enabled: false }]) {
      const action = getAction(brain, world, { ...prefs, ...changes }, 5000, () => .5);
      expect(action.intention).toBeUndefined(); expect(action.kind).not.toBe("jump");
    }
    const food = { id: "snack", x: 50, y: 700, platformId: floor.id, kind: "apple" as const };
    const eating = getAction({ ...brain, hunger: .8 }, { ...world, foods: [food] }, prefs, 5000, () => .5);
    expect(eating.kind).toBe("eat"); expect(eating.intention).toMatchObject({ kind: "feed", foodId: food.id });
  });

  it("reuses a goal's measured support location after layout movement and stops when its budget is spent", () => {
    const first = getAction(fresh(), world, prefs, 0, () => .5), brain = commitAction(fresh(), first, 0);
    // A uniform real-world scroll changes every support and the actor equally;
    // the retained target is represented by a fraction, never the old px point.
    const moved = { ...world, x: world.x + 23, y: world.y + 40, platforms: world.platforms.map(p => ({ ...p, x: p.x + 23, y: p.y + 40 })) };
    const next = getAction(brain, moved, prefs, 5000, () => .5);
    expect(next.intention?.targetId).toBe(first.intention!.targetId);
    expect(next.target.x).toBeCloseTo(first.target.x + 23); expect(next.target.y).toBe(first.target.y + 40);
    const spent = getAction({ ...brain, intention: { ...brain.intention!, remaining: 0 } }, world, prefs, 5000, () => .5);
    expect(spent.outcomes).toContainEqual({ targetId: brain.intention!.targetId, result: "blocked" });
    expect(spent.intention?.targetId).not.toBe(brain.intention!.targetId);
  });

  it("uses remembered outcomes to prefer a less-visited goal and bounds memory without persistent identity", () => {
    const first = getAction(fresh(), world, prefs, 0, () => .5);
    const places = rememberCompanionOutcomes([], Array.from({ length: 3 }, () => ({ targetId: first.intention!.targetId, result: "completed" as const })), 0);
    const next = getAction({ ...fresh(), places }, world, prefs, 0, () => .5);
    expect(next.intention?.targetId).not.toBe(first.intention!.targetId);
    let memory = places;
    for (let id = 0; id < 30; id++) memory = rememberCompanionOutcomes(memory, [{ targetId: `anonymous-ledge-${id}`, result: "blocked" }], id * 10);
    expect(memory).toHaveLength(12); expect(memory.every(item => Object.keys(item).sort().join() === "failures,id,retryAfter,visits")).toBe(true);
    expect(places[0].visits).toBe(3);
  });

  it("plans a real route home when tired and cancels it when sleep is disabled", () => {
    const home = { ...mid, id: "companion-home", kind: "date" as const };
    const context = { ...world, platforms: [floor, low, home] }, tired = { ...fresh(), energy: .25 };
    const action = getAction(tired, context, prefs, 0, () => .5);
    expect(action.intention).toMatchObject({ kind: "rest", targetId: home.id });
    const continued = getAction(commitAction(tired, action, 0), context, { ...prefs, sleep: false }, 5000, () => .5);
    expect(continued.intention?.kind).not.toBe("rest"); expect(continued.kind).not.toBe("sleep");
    expect(getAction(tired, world, prefs, 0, () => .5).intention?.kind).not.toBe("rest");
  });

  it("keeps a chosen snack when a closer one appears and invalidates a missing snack", () => {
    const chosen = { id: "chosen", x: 290, y: 340, platformId: high.id, kind: "apple" as const };
    const hungry = { ...fresh(), hunger: .8 }, first = getFoodAction(hungry, { ...world, foods: [chosen] }, prefs, 0)!;
    const state = commitAction(hungry, first, 0), closer = { ...chosen, id: "new", x: 50, y: 700, platformId: floor.id };
    expect(getFoodAction(state, { ...world, foods: [closer, chosen] }, prefs, 5000)?.foodId).toBe(chosen.id);
    expect(getFoodAction(state, { ...world, foods: [closer] }, prefs, 5000)?.foodId).toBe(closer.id);
  });

  it("does not mutate perception or brain while sensing and caps new exploration route proofs", () => {
    const brain = fresh(), before = JSON.stringify({ brain, world }); let calls = 0;
    const result = planCompanionGoal(brain, world, prefs, { ...ports, route(...args) { calls++; return findPlatformRoute(...args); } });
    expect(result.action?.intention?.kind).toBe("explore"); expect(calls).toBeLessThanOrEqual(2);
    expect(JSON.stringify({ brain, world })).toBe(before);
    expect(getAction(brain, world, prefs, 0, () => .5)).toEqual(getAction(brain, world, prefs, 0, () => .5));
  });

  it("permits a manual support only as an unchanged-x jump start, never a destination or takeoff walk", () => {
    const manual = { ...floor, id: "manual", manualOnly: true }, context = { ...world, platformId: manual.id, platforms: [manual, low, mid] };
    const route = findPlatformRoute(context, { x: 160, y: 580, platformId: low.id }, context.platforms)!;
    expect(route[0].kind).toBe("jump"); expect(route.every(step => step.target.platformId !== manual.id)).toBe(true);
    expect(findPlatformRoute({ ...context, x: 160, y: 580, platformId: low.id }, { x: 40, y: 700, platformId: manual.id }, context.platforms)).toBeNull();
    const remote = { ...low, x: 400 };
    expect(findPlatformRoute(context, { x: 460, y: 580, platformId: remote.id }, [manual, remote])).toBeNull();
    for (const draw of [0, .3, .7, .999999]) {
      const action = getAction(fresh(), context, prefs, 100000, () => draw);
      expect(action.kind).not.toBe("walk");
      if (action.kind === "jump") expect(action.target.platformId).not.toBe(manual.id);
    }
    // A real nearby offered snack is a terminal interaction, not an invitation
    // to roam or walk across the manually chosen card edge.
    expect(getFoodAction({ ...fresh(), hunger: .8 }, { ...context, foods: [{ id: "snack", x: 50, y: 700, platformId: manual.id, kind: "apple" }] }, prefs, 0)?.kind).toBe("eat");
    expect(getFoodAction({ ...fresh(), hunger: .8 }, { ...context, foods: [{ id: "distant", x: 200, y: 700, platformId: manual.id, kind: "apple" }] }, prefs, 0)).toBeUndefined();
  });

  it("treats only actual user-offered manual-top food as a terminal affordance, with no walking or intermediate manual route", () => {
    const offered = { ...low, id: "offered-top", manualOnly: true }, context = { ...world, platforms: [floor, offered] };
    const food = { id: "offered", x: 160, y: offered.y, platformId: offered.id, kind: "apple" as const };
    const hungry = { ...fresh(), hunger: .8 }, options = { ...prefs, feeding: true };
    let brain = hungry, point = context, eaten = false;
    for (let step = 0; step < 5; step++) {
      const action = getFoodAction(brain, { ...point, foods: [food] }, options, step * 5000)!;
      expect(action.foodId).toBe(food.id);
      if (action.kind === "eat") { expect(point.platformId).toBe(offered.id); eaten = true; break; }
      if (action.kind === "walk") expect(action.target.platformId).toBe(floor.id);
      if (action.target.platformId === offered.id) { expect(action.kind).toBe("jump"); expect(action.target.x).toBe(food.x); }
      brain = commitAction(brain, action, step * 5000); point = { ...point, ...action.target };
    }
    expect(eaten).toBe(true);
    expect(findPlatformRoute(world, food, context.platforms)).toBeNull();
    expect(getFoodAction(hungry, { ...context, foods: [food] }, { ...options, jump: false }, 0)).toBeUndefined();
    expect(getFoodAction(hungry, { ...context, foods: [food] }, { ...options, feeding: false }, 0)).toBeUndefined();
    // Merely being visible does not make an unoffered manual bridge usable.
    expect(findPlatformRoute(world, { x: mid.x + 60, y: mid.y, platformId: mid.id }, [floor, offered, mid])).toBeNull();
    const landed = { ...context, x: food.x, y: food.y, platformId: offered.id };
    for (const draw of [.2, .9, .999999]) {
      const action = getAction(hungry, { ...landed, foods: [] }, options, 50000, () => draw);
      expect(action.kind).not.toBe("walk");
      if (action.kind === "jump") expect(action.target.platformId).not.toBe(offered.id);
    }
  });
});
