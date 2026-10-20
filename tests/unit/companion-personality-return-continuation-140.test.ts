import { describe, expect, it } from "vitest";
import { createBrain, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionHousehold } from "@/lib/ui/viewer-companion/household";
import { createCompanionPersonalityDirector, nextCompanionPersonalityScene, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { createCompanionPersonalityJobs, type PersonalityJobAction } from "@/lib/ui/viewer-companion/personality-jobs";
import { COMPANION_PERSONALITY_SCENES, type PersonalitySceneRecipe } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { accessibleCompanionToys, createCompanionToyPlanner, createCompanionToys, type CompanionToy } from "@/lib/ui/viewer-companion/toys";
import { companionToyReturnDelivered, companionToyReturnTarget, sampleCompanionToyReturn } from "@/lib/ui/viewer-companion/toy-return";

const floor: Platform = { id: "companion-home-floor", x: 50, y: 600, width: 740, kind: "floor", manualOnly: true };
const contact: Platform = { ...floor, id: "companion-home-floor-food", x: 30, width: 780 };
const pad: Platform = { id: "companion-home-floor-400", x: 580, y: 600, width: 40, kind: "floor", manualOnly: true, bodyOnly: true };
const loft: Platform = { id: "isolated-high-date", x: 50, y: 100, width: 80, kind: "date" };
const source = (id: string) => COMPANION_PERSONALITY_SCENES.find(recipe => recipe.id === id)!;

/** Actual toy storage/planner/ID ownership. The unit host consumes real route
 * endpoints and acknowledges stash only after same-ID box delivery. Washing
 * uses an explicit protocol ACK on the real pad point, not a DOM/brush claim. */
function fixture(count = 4, recipes: readonly PersonalitySceneRecipe[] = COMPANION_PERSONALITY_SCENES, personality = recipes[0].personality) {
  const model = createCompanionToys(() => 0); model.sync([floor, loft], { width: 900, height: 720 }, 0, [contact]);
  for (let n = 0; n < count; n++) expect(model.spawn({ x: 340 + n * 45, y: 530, platformId: contact.id }, 0)).toBeTruthy();
  for (let now = 16; now <= 3000; now += 16) model.tick(now);
  expect(model.available()).toHaveLength(count);
  const director = createCompanionPersonalityDirector(recipes), planner = createCompanionToyPlanner(), household = createCompanionHousehold(() => 0);
  const jobs = createCompanionPersonalityJobs(director, household, planner), box = { x: 680, y: floor.y, platformId: floor.id };
  const scene: PersonalitySceneInput = {
    world: { x: 120, y: floor.y, platformId: floor.id, platforms: [floor, loft, pad], width: 900, height: 720, animated: true, foods: [] },
    brain: { ...createBrain(0, () => .5), energy: .9, hunger: .5 },
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality, sleep: false, learnFromYou: false }, now: 3000,
    home: { box, floor: { x: 280, y: floor.y, platformId: floor.id }, pad: { x: 600, y: pad.y, platformId: pad.id }, sofa: { x: 180, y: floor.y, platformId: floor.id } },
    toys: [], tv: "off",
  };
  const originalIds = model.ids(), trace: { scene: string; effect: string; id?: string; count: number }[] = [];
  let project: (toys: CompanionToy[]) => CompanionToy[] = toys => toys;
  const refresh = () => {
    scene.toys = project(accessibleCompanionToys(model.available(), scene.world.platforms)); scene.toyCount = model.count();
    scene.carriedToyId = model.carried(); scene.brain.activeMs = scene.now;
  };
  const offer = () => {
    refresh(); const proposal = nextCompanionPersonalityScene(director, scene);
    return proposal && jobs.next(proposal, { world: scene.world, brain: scene.brain, preferences: scene.preferences, now: scene.now,
      home: {}, box: scene.home.box, toys: scene.toys, toyIds: model.ids(), carriedToy: model.carried(), toyCount: model.count(), foodCount: 0 });
  };
  const apply = (action: PersonalityJobAction) => {
    const meta = action.personalityScene;
    if (["walk", "jump"].includes(action.kind)) {
      const support = scene.world.platforms.find(plane => plane.id === action.target.platformId)!;
      expect(support).toBeTruthy(); expect(action.target.y).toBe(support.y);
      expect(action.target.x).toBeGreaterThanOrEqual(support.x); expect(action.target.x).toBeLessThanOrEqual(support.x + support.width);
      scene.world = { ...scene.world, ...action.target };
      if (model.carried()) expect(model.carry(model.carried()!, { x: scene.world.x, y: scene.world.y - 30 })).toBe(true);
    }
    scene.now += action.duration;
    if (action.toy?.effect) {
      const toy = action.toy; let ok: boolean | string = false;
      if (toy.effect === "pick" && toy.toyId) ok = model.pick(toy.toyId, scene.world);
      if (toy.effect === "spawn") {
        ok = model.spawn({ x: box.x, y: floor.y - 70, platformId: contact.id }, scene.now - action.duration / 2) ?? false;
        for (let now = scene.now - action.duration / 2 + 16; now <= scene.now; now += 16) model.tick(now);
      }
      if (toy.effect === "stash" && toy.toyId) {
        const actual = model.items().find(item => item.id === toy.toyId), target = companionToyReturnTarget({ left: 650, top: 525, width: 60, height: 25 })!;
        expect(actual?.carried).toBe(true); expect(scene.world.platformId).toBe(floor.id); expect(Math.abs(scene.world.x - box.x)).toBeLessThan(55);
        expect(model.carry(toy.toyId, sampleCompanionToyReturn(actual!, target, 1))).toBe(true);
        expect(companionToyReturnDelivered(model.items().find(item => item.id === toy.toyId), target)).toBe(true); ok = model.stash(toy.toyId);
      }
      expect(ok, `actual ${toy.effect} owner accepts the fixed object`).toBeTruthy();
      trace.push({ scene: meta.id, effect: toy.effect!, id: typeof ok === "string" ? ok : toy.toyId, count: model.count() }); planner.resolve(toy, ok, scene.now);
      if (toy.effect !== "pick") {
        director.resolve(meta, Boolean(ok), typeof ok === "string" ? ok : toy.toyId);
        if (!director.current() || director.current()!.beat !== meta.beat) planner.cancel(scene.now);
      }
      if (toy.effect === "stash") director.event("toy-returned", scene.now);
    }
    if (meta.command.kind === "wash" && !meta.travel) {
      expect(model.count()).toBe(0); expect(scene.world.platformId).toBe(scene.home.pad!.platformId);
      expect(Math.hypot(scene.world.x - scene.home.pad!.x, scene.world.y - scene.home.pad!.y)).toBeLessThan(24);
      director.resolve(meta, true); // Unit contact ACK; native500ms is separate.
    } else director.complete(meta);
    trace.push({ scene: meta.id, effect: meta.command.kind, id: meta.itemId, count: model.count() }); model.tick(scene.now);
    // Ordinary runtime decisions have the existing220ms gap after a finite
    // action. In-flight object gravity consumes it too, without a new clock.
    scene.now += 220; model.tick(scene.now);
  };
  const until = (done: () => boolean, limit = 180) => {
    for (let n = 0; n < limit && !done(); n++) { const action = offer(); if (action) apply(action); else { scene.now += 250; model.tick(scene.now); } }
    expect(done(), JSON.stringify({ current: director.current(), completed: director.completed(), items: model.items(), first: trace.slice(0, 18), trace: trace.slice(-12) })).toBe(true);
  };
  refresh(); const entry = director.next(scene)!; director.complete(entry.meta); scene.now += entry.action!.duration;
  return { scene, model, director, trace, originalIds, offer, apply, until, project: (fn: typeof project) => { project = fn; } };
}

describe("140 anti-repeat preserves unfinished physical returns", () => {
  it("continues four actual returns without another grooming/bow interval between the remaining objects", () => {
    const host = fixture(4, [source("T01")], "tidy");
    host.until(() => host.model.count() === 0);
    const firstReturn = host.trace.findIndex(row => row.effect === "stash");
    const remaining = host.trace.slice(firstReturn + 1).filter(row => row.count > 0);
    expect(remaining.some(row => row.effect === "pose")).toBe(false);
    expect(host.trace.filter(row => row.effect === "stash").map(row => row.id).sort()).toEqual([...host.originalIds].sort());
  });
  it("returns all four actual IDs after arrival plus repeated T01, then reaches washing and no-work T07", () => {
    const host = fixture(4, COMPANION_PERSONALITY_SCENES, "tidy"); host.director.event("arrival", host.scene.now);
    host.until(() => host.director.completed().includes("T05") && host.director.completed().includes("T07"));
    expect(host.trace.filter(row => row.effect === "stash").map(row => row.id).sort()).toEqual([...host.originalIds].sort());
    expect(host.trace.filter(row => row.effect === "pick").map(row => row.id).sort()).toEqual([...host.originalIds].sort());
    expect(host.model.ids()).toEqual([]); expect(host.model.carried()).toBeUndefined();
    expect(host.director.completed().filter(id => id === "T01")).toHaveLength(3);
    expect(host.director.completed()).toContain("X-T-return-time");
    expect(host.trace.some(row => row.scene === "ready-tidy" && row.count > 0)).toBe(false);
    expect(host.trace.some(row => row.scene === "T07" && row.count > 0)).toBe(false);
    expect(host.trace.some(row => row.effect === "spawn")).toBe(false);
  });

  it.each(["held", "removed", "hidden", "unreachable-toy", "unreachable-box", "urgent-hunger", "low-energy", "feeding-owner", "roam-off"] as const)("does not use %s work to bypass anti-repeat", condition => {
    const host = fixture(2, [source("T01")]); host.until(() => host.director.completed().includes("T01"));
    const id = host.model.ids()[0];
    if (condition === "held" || condition === "removed") { expect(host.model.grab(id)).toBe(true); if (condition === "removed") expect(host.model.returnHeld(id)).toBe(true); }
    if (condition === "hidden") host.project(toys => toys.map(toy => ({ ...toy, hidden: true })));
    if (condition === "unreachable-toy") host.project(toys => toys.map(toy => ({ ...toy, y: loft.y, platformId: loft.id, stance: undefined })));
    if (condition === "unreachable-box") host.scene.home.box = { x: 70, y: loft.y, platformId: loft.id };
    if (condition === "urgent-hunger") host.scene.brain.hunger = .8;
    if (condition === "low-energy") host.scene.brain.energy = .24;
    if (condition === "feeding-owner") host.scene.brain.foodGoal = { foodId: "actual-owned-meal", remaining: 3, retryAfter: 0 };
    if (condition === "roam-off") host.scene.preferences.roam = false;
    const before = host.model.ids(), returned = host.trace.filter(row => row.effect === "stash").length;
    expect(host.offer()?.personalityScene.id).not.toBe("T01"); expect(host.model.ids()).toEqual(before);
    expect(host.trace.filter(row => row.effect === "stash")).toHaveLength(returned);
  });

  it("preserves the actual required kind when only another real kind remains", () => {
    const recipe: PersonalitySceneRecipe = { ...source("T01"), steps: [{ kind: "toy", mode: "return", kinds: ["ball"] }, { kind: "pose", pose: "bow" }] };
    const host = fixture(2, [recipe]); host.until(() => host.director.completed().includes("T01"));
    expect(host.model.available().every(toy => toy.kind !== "ball")).toBe(true);
    expect(host.offer()?.personalityScene.id).not.toBe("T01");
  });

  it("keeps the failure TTL even when another genuine return was previously completed", () => {
    const host = fixture(2, [source("T01")]); host.until(() => host.director.completed().includes("T01"));
    const restarted = host.offer()!; expect(restarted.personalityScene.id).toBe("T01"); host.apply(restarted);
    const failed = host.offer()!; host.director.resolve(failed.personalityScene, false);
    host.scene.now += 7000;
    expect(host.offer()?.personalityScene.id).not.toBe("T01");
    expect(host.trace.filter(row => row.effect === "stash")).toHaveLength(1);
  });

  it.each(["P11", "T07"])("does not repeat pure expression %s just because nothing else is available", id => {
    const host = fixture(0, [source(id)]); if(id==="P11") {const publicFloor={...floor,id:"actual-outside-floor",manualOnly:false};host.scene.world.platforms=[...host.scene.world.platforms,publicFloor];host.scene.world.platformId=publicFloor.id;} host.until(() => host.director.completed().includes(id));
    expect(host.offer()?.personalityScene.id).not.toBe(id);
  });

  it("does not turn an optional return into a repeating mandatory chore", () => {
    const recipe: PersonalitySceneRecipe = { ...source("T01"), steps: [{ kind: "toy", mode: "return", optional: true }, { kind: "pose", pose: "bow" }] };
    const host = fixture(2, [recipe]); host.until(() => host.director.completed().includes("T01"));
    expect(host.model.count()).toBe(1); expect(host.offer()?.personalityScene.id).not.toBe("T01");
  });

  it("does not repeat a spawn-first scene to dispose of another preexisting object", () => {
    const recipe: PersonalitySceneRecipe = { ...source("T01"), triggers: ["free"], steps: [{ kind: "toy", mode: "spawn" }, { kind: "toy", mode: "return" }] };
    const host = fixture(1, [recipe]); host.until(() => host.director.completed().includes("T01"));
    expect(host.model.ids()).toEqual(host.originalIds); expect(host.trace.filter(row => row.effect === "spawn")).toHaveLength(1);
    expect(host.offer()?.personalityScene.id).not.toBe("T01");
  });
});
