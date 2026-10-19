import { describe, expect, it, vi } from "vitest";
import { createBrain, type Platform } from "@/lib/ui/viewer-companion/brain";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES, type CompanionPersonality } from "@/lib/ui/viewer-companion/preferences";
import { createCompanionRoutineArbiter, type CompanionRoutineInput } from "@/lib/ui/viewer-companion/routine-arbiter";

const floor: Platform = { id: "companion-home-floor", x: 0, y: 600, width: 650, kind: "floor", manualOnly: true };
const pad: Platform = { id: "companion-home-floor-400", x: 450, y: 600, width: 60, kind: "floor", manualOnly: true, bodyOnly: true };
const sofa: Platform = { id: "companion-home", x: 0, y: 570, width: 150, kind: "floor" };
const outside: Platform = { id: "actual-date", x: 700, y: 600, width: 300, kind: "date" };
const input = (personality: CompanionPersonality = "balanced"): CompanionRoutineInput => ({
  world: { x: 200, y: floor.y, platformId: floor.id, platforms: [floor, pad, sofa, outside], width: 1000, height: 700, animated: true, foods: [{ id: "actual-carrot", kind: "carrot", x: 260, y: floor.y, platformId: floor.id }] },
  brain: { ...createBrain(0, () => .5), hunger: .2, energy: .9 }, preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality },
  now: 0, active: true, entryReady: true, home: { floor: { x: 320, y: floor.y, platformId: floor.id }, pad: { x: 480, y: pad.y, platformId: pad.id }, sofa: { x: 80, y: sofa.y, platformId: sofa.id }, dispenser: { x: 380, y: floor.y, platformId: floor.id } },
  toys: [], tv: "off", environment: { date: { y: 2026, m: 10, d: 20 }, season: "autumn", band: "noon", hour: 13, night: false, weather: "clear" },
});

describe("141 bounded common daily needs", () => {
  it.each(COMPANION_PERSONALITIES)("admits a real hungry meal for %s regardless of signature weighting", personality => {
    const arbiter = createCompanionRoutineArbiter(), scene = input(personality); scene.brain.hunger = .5; scene.meal = { foodId: "actual-carrot" };
    const before = JSON.stringify(scene), chosen = arbiter.next(scene)!;
    expect(chosen).toMatchObject({ kind: "meal", itemId: "actual-carrot", reason: "hunger", recipe: { id: "routine-meal", personality } });
    expect(chosen.recipe.steps.some(step => step.kind === "food" && step.mode === "eat")).toBe(true);
    expect(chosen.recipe.steps.some(step => step.kind === "food" && step.mode === "spawn")).toBe(false);
    expect(JSON.stringify(scene)).toBe(before); expect(arbiter.current()).toBe("meal");
    scene.now = 2000; expect(arbiter.next(scene)).toBeUndefined(); // Existing director retains ownership.
    arbiter.observe("played", 2000); expect(arbiter.current()).toBe("meal");
    arbiter.observe("ate", 2100); expect(arbiter.current()).toBeUndefined();
  });

  it("requires the proved existing meal ID or an actual supply source, with feeding OFF authoritative", () => {
    for (const state of ["missing-id", "no-source", "feeding-off", "no-proof"] as const) {
      const arbiter = createCompanionRoutineArbiter(), scene = input(); scene.brain.hunger = .6;
      if (state === "missing-id") scene.meal = { foodId: "gone", canSupply: true };
      if (state === "no-source") { scene.meal = { canSupply: true }; delete scene.home.dispenser; }
      if (state === "feeding-off") { scene.meal = { foodId: "actual-carrot" }; scene.preferences.feeding = false; }
      expect(arbiter.next(scene), state).toBeUndefined();
    }
    const scene = input(); scene.brain.hunger = .5; scene.world.foods = []; scene.meal = { canSupply: true };
    const supplied = createCompanionRoutineArbiter().next(scene)!;
    expect(supplied.recipe.steps[0]).toEqual({ kind: "food", mode: "spawn" });
    expect(supplied.itemId).toBeUndefined();
  });

  it("gives tidy one finite first8second real pickup window before supplying a new nonurgent meal", () => {
    const arbiter = createCompanionRoutineArbiter(), scene = input("tidy"); scene.world.foods = []; scene.brain.hunger = .5; scene.meal = { canSupply: true };
    scene.toys = [{ id: "same-real-ball", kind: "ball", x: 280, y: floor.y, platformId: floor.id, angle: 0, held: false, carried: false }];
    expect(arbiter.next(scene)).toBeUndefined(); expect(arbiter.current()).toBeUndefined();
    scene.now = 7999; expect(arbiter.next(scene)).toBeUndefined();
    scene.now = 8000; expect(arbiter.next(scene)).toMatchObject({ kind: "meal", recipe: { steps: expect.arrayContaining([{ kind: "food", mode: "spawn" }]) } });
  });

  it("does not block a real existing meal or urgent hunger for the early tidy window", () => {
    for (const realMeal of [false, true]) {
      const scene = input("tidy"); scene.toys = [{ id: "real-ball", kind: "ball", x: 280, y: floor.y, platformId: floor.id, angle: 0, held: false, carried: false }];
      scene.brain.hunger = realMeal ? .5 : .78; scene.meal = realMeal ? { foodId: "actual-carrot" } : { canSupply: true };
      if (!realMeal) scene.world.foods = [];
      expect(createCompanionRoutineArbiter().next(scene)?.kind).toBe("meal");
    }
  });

  it("counts only actual settled visible toys and never recreates the initial window after a new toy", () => {
    for (const state of ["held", "carried", "hidden", "air", "missing-support", "off-support"] as const) {
      const scene = input("tidy"); scene.world.foods = []; scene.brain.hunger = .5; scene.meal = { canSupply: true };
      const toy = { id: "real-ball", kind: "ball" as const, x: 280, y: floor.y, platformId: floor.id as string | undefined, angle: 0, held: false, carried: false, hidden: false };
      if (state === "held" || state === "carried" || state === "hidden") toy[state] = true;
      if (state === "air") toy.platformId = undefined;
      if (state === "missing-support") toy.platformId = "gone";
      if (state === "off-support") toy.y -= 30;
      scene.toys = [toy]; expect(createCompanionRoutineArbiter().next(scene)?.kind, state).toBe("meal");
    }
    const arbiter = createCompanionRoutineArbiter(), scene = input("tidy"); arbiter.next(scene);
    scene.now = 9000; scene.world.foods = []; scene.brain.hunger = .5; scene.meal = { canSupply: true };
    scene.toys = [{ id: "new-real-ball", kind: "ball", x: 280, y: floor.y, platformId: floor.id, angle: 0, held: false, carried: false }];
    expect(arbiter.next(scene)?.kind).toBe("meal");
  });

  it.each(COMPANION_PERSONALITIES.filter(personality => personality !== "tidy"))("does not postpone %s supply for tidy's first pickup opportunity", personality => {
    const scene = input(personality); scene.world.foods = []; scene.brain.hunger = .5; scene.meal = { canSupply: true };
    scene.toys = [{ id: "real-ball", kind: "ball", x: 280, y: floor.y, platformId: floor.id, angle: 0, held: false, carried: false }];
    expect(createCompanionRoutineArbiter().next(scene)?.kind).toBe("meal");
  });

  it("retains a real cleanup owner after8seconds and preserves busy and explicit OFF gates", () => {
    for (const gate of ["owned", "busy", "enabled", "feeding", "roam", "active", "animated"] as const) {
      const scene = input("tidy"), arbiter = createCompanionRoutineArbiter(); scene.world.foods = []; scene.brain.hunger = .5; scene.meal = { canSupply: true }; scene.canOuting = false;
      scene.toys = [{ id: "real-ball", kind: "ball", x: 280, y: floor.y, platformId: floor.id, angle: 0, held: false, carried: false }];
      arbiter.next(scene); scene.now = 8001;
      if (gate === "owned" || gate === "busy") scene[gate] = true;
      if (gate === "enabled" || gate === "feeding" || gate === "roam") scene.preferences[gate] = false;
      if (gate === "active") scene.active = false;
      if (gate === "animated") scene.world.animated = false;
      expect(arbiter.next(scene), gate).toBeUndefined(); expect(arbiter.current(), gate).toBeUndefined();
    }
  });

  it.each(COMPANION_PERSONALITIES)("actual meals make %s wash on the measured pad; smiles and time alone never acknowledge it", personality => {
    const arbiter = createCompanionRoutineArbiter(), scene = input(personality);
    expect(arbiter.next(scene)).toBeUndefined(); arbiter.observe("ate", 1); scene.now = 2;
    const chosen = arbiter.next(scene)!;
    expect(chosen).toMatchObject({ kind: "wash", reason: "hygiene" });
    expect(chosen.recipe.steps.slice(0, 2)).toEqual([{ kind: "go", target: "pad" }, { kind: "wash", ms: personality === "tidy" ? 3000 : personality === "mischievous" ? 1900 : 2400 }]);
    scene.now = 5000; arbiter.next(scene); expect(arbiter.current()).toBe("wash");
    arbiter.observe("washed", 5000); expect(arbiter.current()).toBeUndefined();
    scene.now = 5001; expect(arbiter.next(scene)).toBeUndefined();
  });

  it("cannot wash on an ordinary floor, missing body stance or misplaced replacement", () => {
    for (const state of ["ordinary", "not-body", "missing"] as const) {
      const arbiter = createCompanionRoutineArbiter(), scene = input(); arbiter.next(scene); arbiter.observe("ate", 1); scene.now = 2;
      if (state === "ordinary") scene.home.pad = { x: 480, y: floor.y, platformId: floor.id };
      if (state === "not-body") scene.world.platforms = [floor, { ...pad, bodyOnly: false }, sofa, outside];
      if (state === "missing") scene.world.platforms = [floor, sofa, outside];
      expect(arbiter.next(scene), state).toBeUndefined();
    }
  });

  it("lets overdue hygiene outrank a nonurgent repeating meal while urgent real hunger still wins", () => {
    const arbiter = createCompanionRoutineArbiter(), scene = input("tidy"); scene.canOuting = false; arbiter.next(scene); scene.now = 120000;
    scene.brain.hunger = .5; scene.meal = { foodId: "actual-carrot" }; expect(arbiter.next(scene)?.kind).toBe("wash");
    const urgent = createCompanionRoutineArbiter(), other = input("tidy"); urgent.next(other); other.now = 120000;
    other.brain.hunger = .9; other.meal = { foodId: "actual-carrot" }; expect(urgent.next(other)?.kind).toBe("meal");
  });

  it.each(COMPANION_PERSONALITIES)("%s has finite night sleep and real daytime naps, both controlled by sleep OFF", personality => {
    for (const night of [false, true]) {
      const scene = input(personality); scene.brain.energy = .15; scene.environment = { ...scene.environment!, band: night ? "night" : "noon", night };
      const chosen = createCompanionRoutineArbiter().next(scene)!;
      expect(chosen.kind).toBe(night ? "sleep" : "nap");
      expect(chosen.recipe.steps.slice(0, 4)).toEqual([{ kind: "radio", playing: false, optional: true }, { kind: "curtain", phase: "closed" }, { kind: "light", lit: false }, { kind: "go", target: "sofa" }]);
      const sleeping = chosen.recipe.steps.find(step => step.kind === "sleep")!;
      expect(sleeping.kind === "sleep" && sleeping.ms).toBeGreaterThanOrEqual(2000);
      expect(sleeping.kind === "sleep" && sleeping.ms).toBeLessThan(7000);
      expect(chosen.recipe.steps.at(-1)).toEqual({ kind: "pose", pose: "stretch" });
      scene.preferences.sleep = false; expect(createCompanionRoutineArbiter().next(scene)).toBeUndefined();
    }
  });

  it("uses real energy and completion cooldown instead of periodic forced sleep", () => {
    const arbiter = createCompanionRoutineArbiter(), scene = input("sleepy"); scene.canOuting = false;
    expect(arbiter.next(scene)).toBeUndefined(); scene.brain.energy = .5; scene.now = 1;
    expect(arbiter.next(scene)?.kind).toBe("nap"); arbiter.observe("slept", 6000);
    scene.now = 7000; expect(arbiter.next(scene)).toBeUndefined();
    scene.now = 97000; expect(arbiter.next(scene)?.kind).toBe("nap");
  });

  it.each(COMPANION_PERSONALITIES)("%s wakes into an actual outside walk after daytime rest", personality => {
    const arbiter = createCompanionRoutineArbiter(), scene = input(personality); arbiter.next(scene); arbiter.observe("slept", 1); scene.now = 2;
    expect(arbiter.next(scene)).toMatchObject({ kind: "outing", reason: "wake" });
    arbiter.observe("went-out", 2000); scene.now = 2001; expect(arbiter.next(scene)).toBeUndefined();
  });

  it("does not call a sofa/room/body-only/manual ledge an outside walk", () => {
    for (const state of ["no-outside", "manual-only", "body-only", "night", "no-route"] as const) {
      const arbiter = createCompanionRoutineArbiter(), scene = input(); arbiter.next(scene); arbiter.observe("slept", 1); scene.now = 2;
      if (state === "no-outside") scene.world.platforms = [floor, pad, sofa];
      if (state === "manual-only") scene.world.platforms = [floor, pad, sofa, { ...outside, manualOnly: true }];
      if (state === "body-only") scene.world.platforms = [floor, pad, sofa, { ...outside, bodyOnly: true }];
      if (state === "night") scene.environment = { ...scene.environment!, band: "night", night: true };
      if (state === "no-route") scene.canOuting = false;
      expect(arbiter.next(scene), state).toBeUndefined();
    }
  });

  it("keeps manual/carry/entry/hidden/reduced/OFF owners ahead of every real need", () => {
    for (const state of ["entry", "owned", "busy", "inactive", "disabled", "roam", "reduced", "paused", "carried", "air"] as const) {
      const arbiter = createCompanionRoutineArbiter(), scene = input(); scene.brain.hunger = .9; scene.meal = { foodId: "actual-carrot" };
      if (state === "entry") scene.entryReady = false;
      if (state === "owned") scene.owned = true;
      if (state === "busy") scene.busy = true;
      if (state === "inactive") scene.active = false;
      if (state === "disabled") scene.preferences.enabled = false;
      if (state === "roam") scene.preferences.roam = false;
      if (state === "reduced") scene.world.animated = false;
      if (state === "paused") scene.world.paused = true;
      if (state === "carried") scene.carriedToyId = "human-held-same-toy";
      if (state === "air") scene.world.platformId = undefined;
      expect(arbiter.next(scene), state).toBeUndefined();
    }
  });

  it("bounds abandoned ownership and retry while elapsed time cannot fake a meal completion", () => {
    const arbiter = createCompanionRoutineArbiter(), scene = input(); scene.brain.hunger = .5; scene.meal = { foodId: "actual-carrot" }; scene.canOuting = false;
    expect(arbiter.next(scene)?.kind).toBe("meal"); scene.now = 60000; expect(arbiter.next(scene)).toBeUndefined(); expect(arbiter.current()).toBe("meal");
    scene.now = 60001; expect(arbiter.next(scene)).toBeUndefined(); expect(arbiter.current()).toBeUndefined();
    scene.now = 68000; expect(arbiter.next(scene)).toBeUndefined(); scene.now = 68001; expect(arbiter.next(scene)?.kind).toBe("meal");
    arbiter.cancel(68002); scene.now = 76001; expect(arbiter.next(scene)).toBeUndefined(); scene.now = 76002; expect(arbiter.next(scene)?.kind).toBe("meal");
  });

  it("uses only its supplied active time and never asks for random, wall clock, or human activity", () => {
    const scene = input(); scene.brain.hunger = .6; scene.meal = { foodId: "actual-carrot" };
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("unexpected random"); });
    const clock = vi.spyOn(Date, "now").mockImplementation(() => { throw new Error("unexpected wall clock"); });
    try {
      const arbiter = createCompanionRoutineArbiter(); expect(arbiter.next(scene)?.kind).toBe("meal");
      scene.now = Number.NaN; expect(arbiter.next(scene)).toBeUndefined(); scene.now = -1; expect(arbiter.next(scene)).toBeUndefined();
      expect(arbiter.current()).toBe("meal");
    } finally { random.mockRestore(); clock.mockRestore(); }
  });
});
