import { describe, expect, it } from "vitest";
import { createBrain, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITY_SCENES, type PersonalitySceneRecipe } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { createCompanionPersonalityJobs } from "@/lib/ui/viewer-companion/personality-jobs";
import { createCompanionHousehold } from "@/lib/ui/viewer-companion/household";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { createCompanionToys, createCompanionToyPlanner, accessibleCompanionToys, findCompanionToyRoute } from "@/lib/ui/viewer-companion/toys";
import { randomCompanionToy, type CompanionToyKind } from "@/lib/ui/viewer-companion/toy-catalog";
import { companionToyPlayDuration } from "@/lib/ui/viewer-companion/toy-play";
import { companionToyReturnDelivered, companionToyReturnTarget, sampleCompanionToyReturn } from "@/lib/ui/viewer-companion/toy-return";

const floor: Platform = { id: "companion-home-floor", kind: "floor", x: 20, y: 600, width: 700, manualOnly: true };
const contact: Platform = { ...floor, id: "companion-home-floor-food" };
const source = (id: string) => COMPANION_PERSONALITY_SCENES.find(recipe => recipe.id === id)!;
function input(personality: PersonalitySceneInput["preferences"]["personality"]): PersonalitySceneInput {
  return { world: { x: 180, y: 600, platformId: floor.id, platforms: [floor], width: 900, height: 720, animated: true, foods: [] },
    brain: { ...createBrain(0, () => .5), energy: .9, hunger: .1 },
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality, sleep: false, learnFromYou: false }, now: 3000,
    home: { box: { x: 650, y: 600, platformId: floor.id } }, toys: [], tv: "off" };
}
function actualToy(kind: CompanionToyKind = "ball") {
  const roll = Array.from({ length: 4096 }, (_, index) => index / 4096).find(value => randomCompanionToy(undefined, () => value) === kind)!;
  expect(roll).toBeTypeOf("number");
  const model = createCompanionToys(() => roll);
  model.sync([floor], { width: 900, height: 720 }, 0, [contact]);
  expect(model.spawn({ x: 180, y: 530, platformId: contact.id }, 0)).toBeTruthy();
  for (let now = 0; now <= 3000; now += 16) model.tick(now);
  expect(model.available()).toHaveLength(1);
  return model;
}
function entry(director: ReturnType<typeof createCompanionPersonalityDirector>, scene: PersonalitySceneInput) {
  const offered = director.next(scene)!; expect(offered.meta.id).toBe(`entry-${scene.preferences.personality}`);
  scene.now += offered.action!.duration; director.complete(offered.meta);
}
function afterRelease(mode: "toss" | "play" = "toss", kind: CompanionToyKind = "ball",
  ack: "success" | "failed" | "stale" | "foreign-serial" | "foreign-item" = "success") {
  // The play fixture begins on the already reached floor and retains B08's
  // unmodified required play/return tail. Real gravity owns the release.
  const recipe = mode === "play" ? { ...source("B08"), steps: source("B08").steps.slice(1) } : source("M01");
  const scene = input(recipe.personality), model = actualToy(kind), id = model.ids()[0];
  scene.toys = accessibleCompanionToys(model.available(), scene.world.platforms);
  const director = createCompanionPersonalityDirector([recipe]); entry(director, scene);
  const toss = director.next(scene)!; expect(toss.meta).toMatchObject({ id: recipe.id, beat: 0, itemId: id });
  expect(toss.delegate).toMatchObject({ kind: "toy", mode });
  // A box emission lands at its real ballistic destination, away from the
  // requested opening. Consume the proved approach before claiming pickup.
  const actual = scene.toys.find(toy => toy.id === id)!, point = actual.stance ?? actual;
  const route = findCompanionToyRoute(scene.world, point, scene.world.platforms, scene.preferences.jump, true);
  expect(route).toBeTruthy(); expect(route!.length).toBeGreaterThan(0);
  for (const step of route!) {
    expect(step.kind).toBe("walk"); expect(step.target.platformId).toBe(floor.id);
    expect(step.target.y).toBe(floor.y); expect(step.target.x).toBeGreaterThanOrEqual(floor.x);
    expect(step.target.x).toBeLessThanOrEqual(floor.x + floor.width);
    scene.now += Math.max(220, Math.abs(step.target.x-scene.world.x) / 100 * 1000);
    scene.world = { ...scene.world, ...step.target };
    director.observeProgress({ now: scene.now, active: true, point: scene.world });
  }
  expect(Math.hypot(actual.x-scene.world.x, actual.y-scene.world.y)).toBeLessThanOrEqual(48);
  expect(model.pick(id, scene.world)).toBe(true);
  scene.now += companionToyPlayDuration(kind);
  expect(model.put(id, { ...scene.world, y: 578 }, scene.now, true)).toBe(true);
  director.observeProgress({ now: scene.now + (ack === "stale" ? 1 : 0), active: true, point: scene.world });
  director.resolve(ack === "foreign-serial" ? { ...toss.meta, serial: toss.meta.serial + 1 } : toss.meta,
    ack !== "failed", ack === "foreign-item" ? "unrelated-toy" : id, scene.now);
  scene.now += 220; model.tick(scene.now);
  scene.toys = accessibleCompanionToys(model.available(), scene.world.platforms); scene.flyingToyIds = model.flyingIds();
  expect(scene.toys).toEqual([]); expect(scene.flyingToyIds).toEqual([id]);
  return { scene, model, id, director };
}

describe("156 authored object and observation continuity", () => {
  it.each(["ball", "hoop"] as const)("keeps the actual %s play release reserved until the same object lands for its required return", kind => {
    const { scene, model, id, director } = afterRelease("play", kind);
    const planner = createCompanionToyPlanner(), jobs = createCompanionPersonalityJobs(director, createCompanionHousehold(() => 0), planner);
    const nextJob = () => {
      const proposal = director.next(scene)!;
      expect(proposal.meta).toMatchObject({ id: "B08", beat: 1, itemId: id });
      return jobs.next(proposal, { world: scene.world, brain: scene.brain, preferences: scene.preferences, now: scene.now,
        home: {}, box: scene.home.box, toys: scene.toys, toyIds: model.ids(), carriedToy: model.carried(), toyCount: model.count(), foodCount: 0 })!;
    };
    const before = model.items();
    expect(director.routineOwnership(scene)).toBe("work");
    const wait = nextJob();
    expect(wait).toMatchObject({ kind: "look", duration: 250, personalityScene: { id: "B08", beat: 1, itemId: id, travel: true } });
    director.complete(wait.personalityScene);
    expect(director.current()?.beat).toBe(1);
    expect(model.items()).toEqual(before);
    expect(director.completed()).toEqual([]);
    scene.now += 500; model.tick(scene.now);
    scene.toys = accessibleCompanionToys(model.available(), scene.world.platforms); scene.flyingToyIds = model.flyingIds();
    expect(scene.flyingToyIds).toEqual([]); expect(scene.toys.map(toy => toy.id)).toEqual([id]);
    let retrieve = nextJob();
    // The unchanged object planner can finish its existing1000ms empty-target
    // admission delay after landing. Keep those finite real wait actions.
    for (let pending = 0; pending < 3 && retrieve.kind === "look"; pending++) {
      expect(retrieve.duration).toBe(250); director.complete(retrieve.personalityScene);
      scene.now += retrieve.duration; model.tick(scene.now);
      scene.toys = accessibleCompanionToys(model.available(), scene.world.platforms); scene.flyingToyIds = model.flyingIds();
      retrieve = nextJob();
    }
    expect(retrieve.kind).toBe("walk");
    expect(retrieve.target.x).toBe((scene.toys[0].stance ?? scene.toys[0]).x);
    const effects: string[] = [];
    let action = retrieve;
    for (let step = 0; step < 30 && !director.completed().includes("B08"); step++) {
      for (let at = scene.now + 16; at <= scene.now + action.duration; at += 16) model.tick(at);
      scene.now += action.duration;
      if (action.kind === "walk" || action.kind === "jump") {
        scene.world = { ...scene.world, ...action.target };
        if (model.carried()) expect(model.carry(id, { x: scene.world.x, y: scene.world.y - 30 })).toBe(true);
      }
      if (action.toy?.effect) {
        const beat = action.toy; expect(beat.toyId).toBe(id); let success = false;
        if (beat.effect === "pick") success = model.pick(id, scene.world);
        if (beat.effect === "stash") {
          const target = companionToyReturnTarget({ left: 620, top: 525, width: 60, height: 25 })!;
          const actual = model.items().find(toy => toy.id === id)!;
          expect(actual.carried).toBe(true); expect(Math.abs(scene.world.x - scene.home.box!.x)).toBeLessThan(55);
          expect(model.carry(id, sampleCompanionToyReturn(actual, target, 1))).toBe(true);
          expect(companionToyReturnDelivered(model.items().find(toy => toy.id === id), target)).toBe(true);
          success = model.stash(id);
        }
        expect(success).toBe(true); effects.push(beat.effect!); planner.resolve(beat, success, scene.now);
        if (beat.effect !== "pick") director.resolve(action.personalityScene, success, id, scene.now);
      }
      director.complete(action.personalityScene); scene.now += 220; model.tick(scene.now);
      scene.toys = accessibleCompanionToys(model.available(), scene.world.platforms); scene.flyingToyIds = model.flyingIds(); scene.carriedToyId = model.carried();
      if (!director.completed().includes("B08")) action = nextJob();
    }
    expect(effects).toEqual(["pick", "stash"]);
    expect(director.completed()).toEqual(["B08"]); expect(model.ids()).toEqual([]);
  });

  it.each(["failed", "stale", "foreign-serial", "foreign-item"] as const)("does not reserve a play release after a %s ACK", ack => {
    const { scene, model, director } = afterRelease("play", "hoop", ack), before = model.items();
    expect(director.routineReserved(scene)).toBe(false);
    expect(director.completed()).toEqual([]); expect(model.items()).toEqual(before);
  });

  it.each(["removed", "held", "other-id", "expired", "cancelled", "enabled-off", "roam-off"] as const)("does not retain the play release owner for %s", reason => {
    const { scene, model, id, director } = afterRelease("play", "hoop");
    if (reason === "removed") { expect(model.grab(id)).toBe(true); expect(model.returnHeld(id)).toBe(true); }
    if (reason === "held") expect(model.grab(id)).toBe(true);
    scene.flyingToyIds = reason === "other-id" ? ["unrelated-flight"] : model.flyingIds();
    if (reason === "expired") scene.now += 1280; // ACK+1500ms, without extending the lease.
    if (reason === "cancelled") director.cancel();
    if (reason === "enabled-off") scene.preferences.enabled = false;
    if (reason === "roam-off") scene.preferences.roam = false;
    const before = model.items();
    expect(director.routineReserved(scene)).toBe(false);
    expect(director.completed()).toEqual([]); expect(model.items()).toEqual(before);
  });

  it.each(["meal", "exhausted-rest"] as const)("keeps real urgent %s replacement available during play gravity", need => {
    const { scene, director } = afterRelease("play", "hoop");
    const recipe: PersonalitySceneRecipe = { id: need === "meal" ? "routine-meal" : "routine-nap", label: "actual urgent care", personality: "balanced",
      major: true, triggers: [], steps: need === "meal" ? [{ kind: "food", mode: "eat" }] : [{ kind: "sleep", ms: 2500 }] };
    if (need === "meal") {
      scene.brain.hunger = .85;
      scene.world.foods = [{ id: "actual-urgent-carrot", kind: "carrot", x: scene.world.x, y: scene.world.y, platformId: scene.world.platformId }];
      expect(director.routineReserved(scene)).toBe(false);
    } else scene.brain.energy = .1;
    expect(director.startRoutine(recipe, scene.now, need === "meal" ? "actual-urgent-carrot" : undefined)).toBe(true);
    expect(director.current()?.id).toBe(recipe.id);
    expect(director.completed()).toEqual([]);
  });

  it("keeps the same real toss owner while its actual gravity finishes, without advancing or inventing a floor", () => {
    const { scene, model, id, director } = afterRelease();
    const before = model.items().find(toy => toy.id === id)!;
    expect(before.platformId).toBeUndefined(); expect(director.routineOwnership(scene)).toBe("work");
    const wait = director.next(scene)!;
    expect(wait.meta).toMatchObject({ id: "M01", beat: 1, itemId: id, travel: true });
    expect(wait.action).toMatchObject({ kind: "look", duration: 250, target: { x: scene.world.x, y: scene.world.y, platformId: scene.world.platformId } });
    director.complete(wait.meta); expect(director.current()?.beat).toBe(1);
    expect(model.items().find(toy => toy.id === id)).toEqual(before); expect(director.completed()).toEqual([]);
    scene.now += 500; model.tick(scene.now); scene.toys = accessibleCompanionToys(model.available(), scene.world.platforms); scene.flyingToyIds = model.flyingIds();
    expect(scene.flyingToyIds).toEqual([]); expect(scene.toys[0].id).toBe(id);
    const follow = director.next(scene)!;
    expect(follow.meta).toMatchObject({ id: "M01", beat: 1, itemId: id, travel: true });
    expect(follow.action?.kind).toBe("walk"); expect(follow.action?.target.platformId).toBe(floor.id);
    expect(follow.action?.target.x).toBe((scene.toys[0].stance ?? scene.toys[0]).x);
  });

  it.each(["removed", "held", "other-id", "expired"] as const)("does not wait for a %s object or replace the reserved ID", reason => {
    const { scene, model, id, director } = afterRelease();
    if (reason === "removed") { expect(model.grab(id)).toBe(true); expect(model.returnHeld(id)).toBe(true); }
    if (reason === "held") expect(model.grab(id)).toBe(true);
    scene.flyingToyIds = reason === "other-id" ? ["unrelated-flight"] : model.flyingIds();
    if (reason === "expired") scene.now += 1500;
    const snapshot = model.items();
    expect(director.routineReserved(scene)).toBe(false);
    expect(director.next(scene)).toBeUndefined(); expect(director.current()).toBeUndefined();
    expect(director.completed()).toEqual([]); expect(model.items()).toEqual(snapshot);
  });

  it.each(["enabled", "roam"] as const)("respects %s OFF while an actual same-ID toss is settling", flag => {
    const { scene, director } = afterRelease(); scene.preferences[flag] = false;
    expect(director.routineReserved(scene)).toBe(false); expect(director.next(scene)).toBeUndefined();
    expect(director.completed()).toEqual([]);
  });

  it("completes M01 with two actual end-of-use tosses and a same-ID box delivery on the real model", () => {
    const scene = input("mischievous"), model = actualToy(), id = model.ids()[0], planner = createCompanionToyPlanner();
    const director = createCompanionPersonalityDirector([source("M01")]);
    const jobs = createCompanionPersonalityJobs(director, createCompanionHousehold(() => 0), planner);
    entry(director, scene);
    const effects: { kind: string; id?: string }[] = [], waitingAt: number[] = [];
    for (let count = 0; count < 70 && !director.completed().includes("M01"); count++) {
      scene.toys = accessibleCompanionToys(model.available(), scene.world.platforms); scene.carriedToyId = model.carried(); scene.flyingToyIds = model.flyingIds();
      const offer = director.next(scene)!; expect(offer?.meta.id).toBe("M01");
      const action = jobs.next(offer, { world: scene.world, brain: scene.brain, preferences: scene.preferences, now: scene.now,
        home: {}, box: scene.home.box, toys: scene.toys, toyIds: model.ids(), carriedToy: model.carried(), toyCount: model.count(), foodCount: 0 })!;
      expect(action).toBeTruthy();
      if (action.kind === "look" && offer.meta.travel) waitingAt.push(scene.now);
      const duration = action.kind === "play" && action.toy?.effect === "toss" ? companionToyPlayDuration("ball") : action.duration;
      for (let at = scene.now + 16; at <= scene.now + duration; at += 16) model.tick(at);
      scene.now += duration;
      if (action.kind === "walk" || action.kind === "jump") {
        scene.world = { ...scene.world, ...action.target };
        if (model.carried()) expect(model.carry(id, { x: scene.world.x, y: scene.world.y - 30 })).toBe(true);
      }
      if (action.toy?.effect) {
        const beat = action.toy; expect(beat.toyId).toBe(id); let success = false;
        if (beat.effect === "pick") success = model.pick(id, scene.world);
        if (beat.effect === "toss") success = model.put(id, { ...scene.world, y: scene.world.y - 22 }, scene.now, true);
        if (beat.effect === "stash") {
          const actual = model.items().find(toy => toy.id === id)!, target = companionToyReturnTarget({ left: 620, top: 525, width: 60, height: 25 })!;
          expect(actual.carried).toBe(true); expect(Math.abs(scene.world.x - scene.home.box!.x)).toBeLessThan(55);
          expect(model.carry(id, sampleCompanionToyReturn(actual, target, 1))).toBe(true);
          expect(companionToyReturnDelivered(model.items().find(toy => toy.id === id), target)).toBe(true); success = model.stash(id);
        }
        expect(success).toBe(true); effects.push({ kind: beat.effect!, id }); planner.resolve(beat, success, scene.now);
        if (beat.effect !== "pick") director.resolve(action.personalityScene, success, id, scene.now);
      }
      if (action.personalityJobEnd) director.resolve(action.personalityScene, true, id, scene.now);
      director.complete(action.personalityScene); scene.now += 220; model.tick(scene.now);
    }
    expect(director.completed()).toContain("M01"); expect(model.count()).toBe(0);
    expect(effects.filter(effect => effect.kind === "toss")).toEqual([{ kind: "toss", id }, { kind: "toss", id }]);
    expect(effects.filter(effect => effect.kind === "stash")).toEqual([{ kind: "stash", id }]);
    expect(waitingAt.length).toBeGreaterThanOrEqual(2);
  });

  it("offers the current far inspection's proved first leg before its later stationary sniff would exceed8s", () => {
    const scene = input("sleepy"); scene.world.x = 86; scene.toys = [{ id: "same-fish", kind: "plush-fish", x: 234, y: 600, platformId: floor.id, angle: 0, held: false, carried: false }];
    const recipe: PersonalitySceneRecipe = { ...source("S10"), triggers: ["free"] };
    const director = createCompanionPersonalityDirector([recipe]); entry(director, scene);
    scene.world.x += 8; director.observeProgress({ now: scene.now, active: true, point: scene.world });
    scene.now += 6200;
    const stretch = director.next(scene)!; expect(stretch.action?.kind).toBe("stretch");
    scene.now += stretch.action!.duration + 220; director.complete(stretch.meta);
    const approach = director.next(scene)!;
    expect(approach.meta).toMatchObject({ id: "S10", beat: 1, itemId: "same-fish", travel: true });
    expect(approach.action?.kind).toBe("walk"); expect(Math.abs(approach.action!.target.x-scene.world.x)).toBeGreaterThanOrEqual(24);
    expect(director.completed()).toEqual([]); director.complete(approach.meta); expect(director.current()?.beat).toBe(1);
    scene.world = { ...scene.world, ...approach.action!.target }; scene.now += approach.action!.duration;
    const inspect = director.next(scene)!; expect(inspect.delegate).toMatchObject({ kind: "toy", mode: "inspect" });
    expect(inspect.meta.itemId).toBe("same-fish");
  });
});
