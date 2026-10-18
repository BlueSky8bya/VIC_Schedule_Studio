import { describe, expect, it } from "vitest";
import { getCompanionBehaviorProfile } from "@/lib/ui/viewer-companion/behavior-profile";
import { cancelCompanionTravelGoal, commitAction, createBrain, getAction, type CompanionAction, type CompanionBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { companionPlayDuration } from "@/lib/ui/viewer-companion/timing";
import { deliberateCompanionAction } from "@/lib/ui/viewer-companion/deliberation";

const prefs = { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, feeding: false, heartPrank: false, ambientPrank: false };
const floor: Platform = { id: "floor", x: 0, y: 700, width: 1000, kind: "floor" };
const world: CompanionWorld = { x: 500, y: 700, platformId: floor.id, platforms: [floor], width: 1000, height: 900 };
const healthy = (): CompanionBrain => ({ ...createBrain(0, () => .5), energy: .8, curiosity: .8, hunger: .1 });
function seeded(seed = 121) { let n = seed; return () => { n = Math.imul(n, 1664525) + 1013904223 | 0; return (n >>> 0) / 4294967296; }; }
function sample(changes: Partial<CompanionPreferences> = {}, context = world, brain = healthy(), count = 1600, seed = 121) {
  const rng = seeded(seed);
  return Array.from({ length: count }, () => getAction(brain, context, { ...prefs, ...changes }, 100000, rng));
}
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const walk = (actions: CompanionAction[]) => actions.filter(a => a.kind === "walk");
function running() {
  let brain = healthy();
  for (let step = 0; step < 2; step++) brain = commitAction(brain, { kind: "walk", pace: "scoot", target: { x: 500, y: 700, platformId: floor.id }, duration: 2000 }, step * 3000);
  return brain;
}
function timeline(changes: Partial<CompanionPreferences>, seed: number, context = world) {
  const rng = seeded(seed), options = { ...prefs, ...changes }, actions: { action: CompanionAction; from: number }[] = [];
  let brain = healthy(), point = { ...context }, now = 100000;
  while (now < 130000) {
    const action = getAction(brain, point, options, now, rng);
    actions.push({ action, from: point.x });
    brain = commitAction(brain, action, now);
    point = { ...point, x: action.target.x, y: action.target.y, platformId: action.target.platformId };
    brain.activeMs += action.duration;
    now += action.duration + 220;
  }
  return actions;
}

describe("independent companion species, motivation and gait", () => {
  it("chooses a substantive same-span run once and retains its destination through a live intermediate replan", () => {
    const space: Platform = { ...floor, width: 1800 }, context = { ...world, x: 100, width: 1800, platforms: [space] };
    const options = { ...prefs, speed: "lively" as const, jump: false, sleep: false };
    const runs = walk(sample(options, context, healthy(), 500, 947)).filter(action => action.pace === "scoot");
    expect(runs.length).toBeGreaterThan(50);
    for (const action of runs) {
      expect(action.target.x - context.x).toBeGreaterThan(520);
      expect(action.duration).toBeGreaterThan(2000); expect(action.duration).toBeLessThanOrEqual(12000);
      expect(action.intention).toMatchObject({ kind: "explore", targetId: space.id, stage: "travel", remaining: 12 });
      expect(action.intention!.offset).toBeCloseTo((action.target.x - space.x) / space.width);
    }
    const chosen = runs[0], committed = commitAction(healthy(), chosen, 100000);
    const intermediate = { ...context, x: context.x + 180 };
    const continued = getAction(committed, intermediate, options, 100000 + chosen.duration + 220, () => 0);
    expect(continued).toMatchObject({ kind: "walk", target: chosen.target, intention: { ...chosen.intention, remaining: 11 } });
    expect(continued.target.x - intermediate.x).toBeGreaterThan(300);
    expect(getAction(committed, { ...context, ...chosen.target }, options, 100000 + chosen.duration + 220, () => 0)).toMatchObject({ kind: "look", intention: { stage: "observe", targetId: space.id } });
  });

  it("revokes only exploration on a new scene owner and respects real interruption, food and budget boundaries", () => {
    const intention = { kind: "explore" as const, targetId: floor.id, offset: .85, remaining: 5, stage: "travel" as const };
    const brain = { ...healthy(), intention, foodGoal: { foodId: "retained-snack", remaining: 17, retryAfter: 0 } }, before = JSON.stringify(brain), cancelled = cancelCompanionTravelGoal(brain);
    expect(cancelled.intention).toBeUndefined(); expect(cancelled.foodGoal).toBe(brain.foodGoal); expect(JSON.stringify(brain)).toBe(before);
    for (const kind of ["feed", "rest"] as const) {
      const retained = { ...brain, intention: { ...intention, kind } };
      expect(cancelCompanionTravelGoal(retained)).toBe(retained);
    }
    for (const changes of [{ roam: false }, { enabled: false }]) expect(getAction(brain, world, { ...prefs, ...changes }, 100000, () => 0).intention).toBeUndefined();
    expect(getAction(brain, { ...world, paused: true }, prefs, 100000, () => 0).intention).toBeUndefined();
    const expired = getAction({ ...brain, intention: { ...intention, remaining: 0 } }, world, prefs, 100000, () => 0);
    expect(expired.intention).toBeUndefined(); expect(expired.outcomes).toContainEqual({ targetId: floor.id, result: "blocked" });
    const food = { id: "native-snack", x: world.x + 10, y: world.y, platformId: floor.id, kind: "apple" as const };
    expect(getAction({ ...brain, hunger: .8 }, { ...world, foods: [food] }, { ...prefs, feeding: true }, 100000, () => 0)).toMatchObject({ kind: "eat", foodId: food.id, intention: { kind: "feed" } });
    const shifted = { ...floor, x: 100, width: 600 }, redirected = getAction(brain, { ...world, platforms: [shifted] }, prefs, 100000, () => 0);
    expect(redirected).toMatchObject({ kind: "walk", intention }); expect(redirected.target.x).toBeCloseTo(610);
    expect(redirected.target.x).toBeLessThanOrEqual(shifted.x + shifted.width - 12);
  });

  it.each(["relaxed", "normal", "lively"] as const)("retains the chosen %s run through the actual inspect-commit-planner handoff", speed => {
    const space: Platform = { ...floor, width: 1800 }, context = { ...world, x: 100, width: 1800, platforms: [space] };
    const options = { ...prefs, speed, jump: false, sleep: false }, brain = healthy();
    const chosen = walk(sample(options, context, brain, 700, 673)).find(action => action.pace === "scoot" && action.duration > 2000)!;
    expect(chosen).toBeDefined();
    const inspected = deliberateCompanionAction(brain, context, options, chosen, true);
    expect(inspected).toMatchObject({ kind: "look", intention: { kind: "explore", stage: "consider" } });
    const committed = commitAction(brain, inspected, 100000);
    const moving = getAction(committed, context, options, 100000 + inspected.duration + 60, () => 0);
    expect(moving).toMatchObject({ kind: "walk", pace: "scoot", target: chosen.target });
    expect(moving.duration).toBeCloseTo(chosen.duration); expect(moving.duration).toBeLessThanOrEqual(12000);
  });

  it("composes orthogonal habits without replacing other choices or mutating preferences", () => {
    const base = getCompanionBehaviorProfile(prefs), before = JSON.stringify(prefs);
    const cat = getCompanionBehaviorProfile({ ...prefs, animalMode: "cat" });
    const lovedCat = getCompanionBehaviorProfile({ ...prefs, animalMode: "cat", personality: "affectionate" });
    const quickCat = getCompanionBehaviorProfile({ ...prefs, animalMode: "cat", speed: "lively" });
    expect(cat.highPlaceWeight).toBeGreaterThan(base.highPlaceWeight);
    expect(lovedCat.socialPull).toBeGreaterThan(cat.socialPull);
    expect(lovedCat.highPlaceWeight).toBe(cat.highPlaceWeight);
    expect(quickCat.walkSpeed).toBeGreaterThan(cat.walkSpeed);
    expect(quickCat.highPlaceWeight).toBe(cat.highPlaceWeight);
    expect(JSON.stringify(prefs)).toBe(before);
  });

  it("makes an affectionate mascot approach and invite contact even with heart jokes OFF", () => {
    const context = { ...world, pointer: { x: 320, y: 700 } };
    const curious = sample({ jump: false }, context);
    const affectionate = sample({ jump: false, personality: "affectionate" }, context);
    expect(walk(curious).every(a => a.target.x > world.x)).toBe(true);
    expect(walk(affectionate).length).toBeGreaterThan(200);
    expect(walk(affectionate).every(a => a.target.x < world.x)).toBe(true);
    expect(affectionate.some(a => a.kind === "play" && a.play === "celebrate")).toBe(true);
    expect(affectionate.some(a => a.kind === "heart")).toBe(false);
  });

  it("gives cats observable high-place/short-pounce/groom habits and dogs sniff/play invitations", () => {
    const high: Platform = { id: "high", x: 360, y: 580, width: 240, kind: "card" };
    const low: Platform = { id: "low", x: 360, y: 820, width: 240, kind: "card" };
    const context = { ...world, platforms: [floor, high, low] };
    const species = (animalMode: CompanionPreferences["animalMode"]) => Array.from({ length: 8 }, (_, index) => sample({ animalMode }, context, healthy(), 800, 121 + index * 31)).flat();
    const cat = species("cat"), dog = species("dog");
    const jumps = cat.filter(a => a.kind === "jump" && a.target.platformId !== floor.id);
    expect(jumps.length).toBeGreaterThan(100);
    expect(jumps.filter(a => a.target.platformId === high.id).length / jumps.length).toBeGreaterThan(.8);
    expect(cat.some(a => a.play === "groom")).toBe(true);
    expect(dog.some(a => a.play === "bow")).toBe(true);
    expect(dog.filter(a => a.kind === "sniff").length).toBeGreaterThan(cat.filter(a => a.kind === "sniff").length);
    const stalk = sample({ animalMode: "cat" }, { ...world, pointer: { x: 640, y: 700 } });
    expect(stalk.some(a => a.play === "pounce")).toBe(true);
    expect(walk(stalk).every(a => a.pace === "amble" && Math.abs(a.target.x - world.x) <= 100)).toBe(true);
  });

  it("changes stride, pause rhythm, scoot frequency and hop impulse along with gait speed", () => {
    const relaxed = sample({ speed: "relaxed" }), lively = sample({ speed: "lively" });
    const slowWalks = walk(relaxed), quickWalks = walk(lively);
    expect(Math.max(...slowWalks.filter(a => a.pace === "amble").map(a => a.target.x - world.x))).toBeLessThan(81);
    expect(Math.max(...quickWalks.map(a => a.target.x - world.x))).toBeGreaterThan(150);
    expect(quickWalks.filter(a => a.pace === "scoot").length / quickWalks.length).toBeGreaterThan(.7);
    expect(slowWalks.filter(a => a.pace === "scoot").length / slowWalks.length).toBeLessThan(.2);
    const perPixel = (actions: CompanionAction[]) => mean(actions.map(a => a.duration / Math.abs(a.target.x - world.x)));
    expect(perPixel(slowWalks)).toBeGreaterThan(perPixel(quickWalks));
    const pauses = (actions: CompanionAction[]) => mean(actions.filter(a => a.kind === "idle").map(a => a.duration));
    expect(pauses(relaxed)).toBeGreaterThan(pauses(lively));
    expect(relaxed.filter(a => a.jumpHeight !== undefined).every(a => a.jumpHeight! < 39)).toBe(true);
    expect(lively.filter(a => a.jumpHeight !== undefined).every(a => a.jumpHeight! >= 44)).toBe(true);
  });

  it("lets sleepy pets seek a real bed earlier and rest longer without bypassing the sleep switch", () => {
    const home = { id: "companion-home", x: 560, y: 600, width: 150, kind: "date" as const };
    const context = { ...world, platforms: [floor, home] }, brain = { ...healthy(), energy: .35 };
    const action = getAction(brain, context, { ...prefs, personality: "sleepy" }, 100000, () => .5);
    expect(action.intention).toMatchObject({ kind: "rest", targetId: home.id });
    expect(getAction(brain, context, prefs, 100000, () => .5).intention?.kind).not.toBe("rest");
    const awake = sample({ personality: "sleepy", sleep: false, jump: false }, context, brain);
    expect(awake.some(a => a.kind === "sleep" || a.intention?.kind === "rest")).toBe(false);
    expect(sample({ personality: "sleepy", roam: false }, world, brain).some(a => a.kind === "sleep")).toBe(true);
  });

  it("carries the gait into multi-step expeditions, rather than applying it only to local wandering", () => {
    const ledges: Platform[] = [floor, { id: "low", x: 100, y: 580, width: 120, kind: "card" }, { id: "mid", x: 150, y: 460, width: 120, kind: "card" }, { id: "high", x: 250, y: 340, width: 100, kind: "card" }];
    const context = { ...world, x: 40, platforms: ledges };
    const relaxed = getAction(healthy(), context, { ...prefs, speed: "relaxed" }, 100000, () => .5);
    const lively = getAction(healthy(), context, { ...prefs, speed: "lively" }, 100000, () => .5);
    expect(relaxed).toMatchObject({ kind: "walk", pace: "amble", intention: { kind: "explore" } });
    expect(lively).toMatchObject({ kind: "walk", pace: "scoot", intention: { kind: "explore" } });
    expect(relaxed.target).toEqual(lively.target);
    expect(relaxed.duration).toBeGreaterThan(lively.duration * 1.8);
    const observed: CompanionBrain = { ...healthy(), intention: { kind: "explore", targetId: "high", offset: .5, remaining: 8, stage: "observe" } };
    const after = sample({ animalMode: "cat" }, context, observed);
    expect(after.some(a => a.play === "groom")).toBe(true);
    expect(after.every(a => a.intention?.kind !== "explore")).toBe(true);
  });

  it("finishes substantive bounded destinations through stateful thirty-second histories", () => {
    const space: Platform = { ...floor, width: 1800 }, context = { ...world, x: 450, width: 1800, platforms: [space] };
    const histories = Array.from({ length: 16 }, (_, index) => timeline({ jump: false, sleep: false }, 121 + index * 31, context));
    expect(histories).toEqual(Array.from({ length: 16 }, (_, index) => timeline({ jump: false, sleep: false }, 121 + index * 31, context)));
    const runs = histories.flat().filter(({ action }) => action.kind === "walk" && action.pace === "scoot");
    expect(runs.filter(({ action }) => action.duration >= 2000).length).toBeGreaterThan(15);
    expect(runs.filter(({ action, from }) => Math.abs(action.target.x - from) > 180).length / runs.length).toBeGreaterThan(.7);
    expect(new Set(runs.map(({ action }) => Math.floor(action.duration / 500))).size).toBeGreaterThanOrEqual(6);
    for (const { action, from } of histories.flat()) {
      expect(action.target.platformId).toBe(space.id);
      expect(action.target.x).toBeGreaterThanOrEqual(space.x + 12);
      expect(action.target.x).toBeLessThanOrEqual(space.x + space.width - 12);
      expect(action.target.y).toBe(space.y);
      if (action.kind === "walk") {
        expect(Math.abs(action.target.x - from)).toBeLessThanOrEqual(space.width - 24);
        expect(action.duration).toBeGreaterThanOrEqual(500);
        expect(action.duration).toBeLessThanOrEqual(12000);
      }
    }
  });

  it("retains species, fatigue, gait and small-support reach across stateful run choices", () => {
    const collect = (changes: Partial<CompanionPreferences>, brain = healthy(), context = world) => Array.from({ length: 8 }, (_, seed) => {
      if (brain.energy >= .28) return timeline({ ...changes, jump: false, sleep: false }, seed + 91, context);
      return sample({ ...changes, jump: false, sleep: false }, context, brain, 200).map(action => ({ action, from: context.x }));
    }).flat().filter(({ action }) => action.kind === "walk");
    const cat = collect({ animalMode: "cat" }), tired = collect({}, { ...healthy(), energy: .27 });
    expect(cat.length).toBeGreaterThan(10); expect(tired.length).toBeGreaterThan(10);
    expect([...cat, ...tired].every(({ action, from }) => action.pace === "amble" && Math.abs(action.target.x - from) <= 180)).toBe(true);
    const relaxed = collect({ speed: "relaxed" }), lively = collect({ speed: "lively" });
    const ratio = (items: typeof relaxed) => items.filter(({ action }) => action.pace === "scoot").length / items.length;
    expect(ratio(lively)).toBeGreaterThan(ratio(relaxed) + .35);
    const perPixel = (items: typeof relaxed) => mean(items.map(({ action, from }) => action.duration / Math.abs(action.target.x - from)));
    expect(perPixel(relaxed)).toBeGreaterThan(perPixel(lively));
    for (const support of [{ ...floor, id: "arrow", kind: "control" as const }, { ...floor, id: "companion-home", kind: "date" as const }, { ...floor, id: "companion-home-floor-1" }]) {
      const actions = collect({ speed: "lively" }, healthy(), { ...world, platformId: support.id, platforms: [support] });
      expect(actions.length).toBeGreaterThan(10);
      expect(actions.every(({ action, from }) => Math.abs(action.target.x - from) <= 180)).toBe(true);
      for (const { action, from } of actions.filter(({ action }) => action.pace === "scoot")) expect(action.duration).toBeCloseTo(Math.max(500, Math.abs(action.target.x - from) / 100 * 850));
    }
  });
});

describe("bounded cartoon play after actual movement", () => {
  it("reserves floor and card mishaps for proved locomotion contact, not a stationary choice", () => {
    for (const support of [floor, { ...floor, id: "ordinary-card", kind: "card" as const }]) for (const brain of [healthy(), running()]) {
      const context = { ...world, platformId: support.id, platforms: [support] };
      expect(sample({}, context, brain, 1200).every(action => !["tumble", "bump", "slip", "bonk-sad", "bonk-tears"].includes(action.play ?? ""))).toBe(true);
    }
  });

  it("records an independent mishap cooldown without letting emotion or grooming extend it", () => {
    for (const play of ["tumble", "bump", "slip"] as const) {
      const action: CompanionAction = { kind: "play", play, target: { x: world.x, y: world.y, platformId: floor.id }, duration: companionPlayDuration(play) };
      const next = commitAction(running(), action, 100000), deadline = 100000 + action.duration + 20000;
      expect(next.cooldowns).toMatchObject({ play: deadline, mishap: deadline });
      expect(next.movementMs).toBe(0);
      for (const expression of ["dizzy", "groom", "bonk-tears", "celebrate"] as const) {
        const emotional: CompanionAction = { ...action, play: expression, duration: companionPlayDuration(expression) };
        expect(commitAction(healthy(), emotional, 100100).cooldowns.mishap).toBeUndefined();
        const continued = commitAction(next, emotional, 100100);
        expect(continued.cooldowns.mishap).toBe(deadline);
        expect(continued.cooldowns.play).toBe(100100 + emotional.duration + 20000);
      }
    }
  });

  it("keeps food, paused/disabled state, manual supports and navigation switches authoritative", () => {
    const brain = running(), snack = { id: "offered", x: 510, y: 700, platformId: floor.id, kind: "apple" as const };
    expect(getAction({ ...brain, hunger: .8 }, { ...world, foods: [snack] }, { ...prefs, feeding: true }, 100000, () => 0).kind).toBe("eat");
    for (const changes of [{ enabled: false }, { roam: false }]) expect(getAction(brain, world, { ...prefs, ...changes }, 100000, () => 0).kind).not.toBe("play");
    expect(getAction(brain, { ...world, paused: true }, prefs, 100000, () => 0).kind).toBe("idle");
    expect(getAction(brain, { ...world, platforms: [{ ...floor, manualOnly: true }] }, prefs, 100000, () => 0).kind).not.toBe("play");
    expect(getAction(brain, world, { ...prefs, jump: false }, 100000, () => 0).play).not.toBe("tumble");
    expect(sample({ animalMode: "cat", jump: false }, { ...world, pointer: { x: 640, y: 700 } }).every(a => a.play !== "pounce" && a.kind !== "jump")).toBe(true);
  });

  it("keeps every cross-product deterministic, finite and local without mutating input state", () => {
    for (const animalMode of ["default", "cat", "dog"] as const) for (const personality of ["curious", "affectionate", "sleepy"] as const) for (const speed of ["relaxed", "normal", "lively"] as const) {
      const options = { animalMode, personality, speed }, before = JSON.stringify(world);
      const actions = sample(options, world, healthy(), 100);
      expect(actions).toEqual(sample(options, world, healthy(), 100));
      for (const action of actions) {
        expect(Number.isFinite(action.duration) && action.duration > 0).toBe(true);
        expect(action.target.platformId).toBe(floor.id);
        expect(action.target.x).toBeGreaterThanOrEqual(floor.x + 12);
        expect(action.target.x).toBeLessThanOrEqual(floor.x + floor.width - 12);
        expect(action.target.y).toBe(floor.y);
        if (action.kind === "play") expect(action.target).toEqual({ x: world.x, y: world.y, platformId: floor.id });
      }
      expect(JSON.stringify(world)).toBe(before);
    }
  });
});
