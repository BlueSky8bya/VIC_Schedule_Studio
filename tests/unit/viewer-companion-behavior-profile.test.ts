import { describe, expect, it } from "vitest";
import { getCompanionBehaviorProfile } from "@/lib/ui/viewer-companion/behavior-profile";
import { commitAction, createBrain, getAction, type CompanionAction, type CompanionBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";

const prefs = { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, feeding: false, heartPrank: false, ambientPrank: false };
const floor: Platform = { id: "floor", x: 0, y: 700, width: 1000, kind: "floor" };
const world: CompanionWorld = { x: 500, y: 700, platformId: floor.id, platforms: [floor], width: 1000, height: 900 };
const healthy = (): CompanionBrain => ({ ...createBrain(0, () => .5), energy: .8, curiosity: .8, hunger: .1 });
function seeded(seed = 121) { let n = seed; return () => { n = Math.imul(n, 1664525) + 1013904223 | 0; return (n >>> 0) / 4294967296; }; }
function sample(changes: Partial<CompanionPreferences> = {}, context = world, brain = healthy(), count = 1600) {
  const rng = seeded();
  return Array.from({ length: count }, () => getAction(brain, context, { ...prefs, ...changes }, 100000, rng));
}
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const walk = (actions: CompanionAction[]) => actions.filter(a => a.kind === "walk");
function running() {
  let brain = healthy();
  for (let step = 0; step < 2; step++) brain = commitAction(brain, { kind: "walk", pace: "scoot", target: { x: 500, y: 700, platformId: floor.id }, duration: 2000 }, step * 3000);
  return brain;
}

describe("independent companion species, motivation and gait", () => {
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
    const cat = sample({ animalMode: "cat" }, context), dog = sample({ animalMode: "dog" }, context);
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
    expect(Math.max(...slowWalks.map(a => a.target.x - world.x))).toBeLessThan(81);
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
    const context = { ...world, platforms: [floor, home] }, brain = { ...healthy(), energy: .65 };
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
});

describe("bounded cartoon play after actual movement", () => {
  it("requires a committed burst and keeps finite mishaps on the same real support", () => {
    expect(getAction(healthy(), world, prefs, 100000, () => 0).kind).not.toBe("play");
    const action = getAction(running(), world, prefs, 100000, () => 0);
    expect(action).toMatchObject({ kind: "play", play: "tumble", target: { x: world.x, y: world.y, platformId: floor.id } });
    expect(action.duration).toBeGreaterThanOrEqual(2800); expect(action.duration).toBeLessThanOrEqual(4300);
    const next = commitAction(running(), action, 100000);
    expect(next.cooldowns.play! - 100000 - action.duration).toBeGreaterThanOrEqual(15000);
    expect(next.movementMs).toBe(0);
    expect(getAction(next, world, prefs, 100000 + action.duration + 1, () => 0).kind).not.toBe("play");
  });

  it("caps eligibility odds and reserves bonk reactions for explicit human input", () => {
    const actions = sample({}, world, running(), 4000);
    const accidents = actions.filter(a => ["tumble", "slip", "bump"].includes(a.play ?? ""));
    expect(accidents.length).toBeGreaterThan(100); expect(accidents.length).toBeLessThan(1000);
    expect(actions.every(a => a.play !== "bonk-sad" && a.play !== "bonk-tears")).toBe(true);
    expect(sample({ animalMode: "cat" }, world, running(), 4000).filter(a => ["tumble", "slip", "bump"].includes(a.play ?? "")).length).toBeLessThan(accidents.length / 4);
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
