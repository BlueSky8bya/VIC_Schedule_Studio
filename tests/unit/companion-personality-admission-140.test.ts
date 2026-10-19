import { describe, expect, it, vi } from "vitest";
import * as routing from "@/lib/ui/viewer-companion/brain";
import { createBrain, type CompanionBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES, type CompanionPersonality } from "@/lib/ui/viewer-companion/preferences";
import { accessibleCompanionToys, companionToyFoodPriority, createCompanionToyPlanner, createCompanionToys, findCompanionToyRoute, type CompanionToy } from "@/lib/ui/viewer-companion/toys";
import { createCompanionPersonalityDirector, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITY_SCENES } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { createCompanionPersonalityActivity } from "@/lib/ui/viewer-companion/personality-activity";
import { createCompanionHousehold } from "@/lib/ui/viewer-companion/household";
import { createCompanionPersonalityJobs, type PersonalityJobAction } from "@/lib/ui/viewer-companion/personality-jobs";
import { companionToyReturnDelivered, companionToyReturnTarget, sampleCompanionToyReturn } from "@/lib/ui/viewer-companion/toy-return";

const ground: Platform = { id: "outside-panel-ground", x: 0, y: 600, width: 1000, kind: "floor" };
const loft: Platform = { id: "unreachable-loft", x: 100, y: 100, width: 100, kind: "date" };
const world = (): CompanionWorld => ({ x: 100, y: ground.y, platformId: ground.id, platforms: [ground, loft], width: 1000, height: 700, animated: true, foods: [] });
const brain = (hunger = .5): CompanionBrain => ({ ...createBrain(0, () => .5), hunger, energy: .9 });
const toy = (id: string, x: number, platform = ground): CompanionToy => ({ id, kind: "ball", x, y: platform.y, platformId: platform.id, angle: 0, held: false, carried: false });
const preferences = (personality: CompanionPersonality = "tidy") => ({ ...DEFAULT_COMPANION_PREFERENCES, personality });
const box = { x: 900, y: ground.y, platformId: ground.id };

/** Physical toy owner + ordinary planners. Unit movement consumes only their
 * returned endpoints. A return ACK requires the same carried object to reach
 * the box opening; this host never implements spawn or synthetic success. */
function b04Host(count: number) {
  const floor: Platform = { id: "companion-home-floor", x: 0, y: 600, width: 1000, kind: "floor", manualOnly: true };
  const contact = { ...floor, id: "companion-home-floor-food" }, boxPoint = { x: 850, y: floor.y, platformId: floor.id };
  const model = createCompanionToys(() => 0), recipe = COMPANION_PERSONALITY_SCENES.find(scene => scene.id === "B04")!;
  model.sync([floor], { width: 1000, height: 700 }, 0, [contact]);
  for (let i = 0; i < count; i++) expect(model.spawn({ x: 300 + i * 90, y: 540, platformId: contact.id }, 0)).toBeTruthy();
  for (let at = 0; at <= 3000; at += 16) model.tick(at);
  const director = createCompanionPersonalityDirector([recipe]), planner = createCompanionToyPlanner(), household = createCompanionHousehold(() => 0);
  const jobs = createCompanionPersonalityJobs(director, household, planner);
  const scene: PersonalitySceneInput = {
    world: { ...world(), platformId: floor.id, platforms: [floor] }, brain: brain(.5), preferences: preferences("balanced"), now: 3000,
    home: { box: boxPoint, window: { x: 500, y: floor.y, platformId: floor.id }, contacts: { curtain: { x: 500, y: floor.y - 45 } } }, toys: [], tv: "off", curtainPhase: "closed",
  };
  const trace: { effect: string; id?: string; beat: number }[] = [], originalIds = model.ids();
  const offer = () => {
    scene.toys = accessibleCompanionToys(model.available(), scene.world.platforms); scene.carriedToyId = model.carried(); scene.brain.activeMs = scene.now;
    const proposal = director.next(scene);
    return proposal?.meta.id === "B04" ? jobs.next(proposal, {
      world: scene.world, brain: scene.brain, preferences: scene.preferences, now: scene.now, home: {}, box: boxPoint,
      toys: scene.toys, toyIds: model.ids(), carriedToy: model.carried(), toyCount: model.count(), foodCount: 0,
    }) : undefined;
  };
  const apply = (action: PersonalityJobAction) => {
    const meta = action.personalityScene;
    if (action.kind === "walk" || action.kind === "jump") {
      const support = scene.world.platforms.find(plane => plane.id === action.target.platformId)!;
      expect(action.target.y).toBe(support.y); scene.world = { ...scene.world, ...action.target };
      if (model.carried()) expect(model.carry(model.carried()!, { x: scene.world.x, y: scene.world.y - 30 })).toBe(true);
    }
    scene.now += action.duration;
    if (action.toy?.effect) {
      const toy = action.toy; let ok = false;
      if (toy.effect === "pick" && toy.toyId) ok = model.pick(toy.toyId, scene.world);
      if (toy.effect === "stash" && toy.toyId) {
        const actual = model.items().find(item => item.id === toy.toyId), target = companionToyReturnTarget({ left: 820, top: 525, width: 60, height: 25 })!;
        expect(actual?.carried).toBe(true); expect(scene.world.platformId).toBe(floor.id); expect(Math.abs(scene.world.x - boxPoint.x)).toBeLessThan(55);
        expect(model.carry(toy.toyId, sampleCompanionToyReturn(actual!, target, 1))).toBe(true);
        expect(companionToyReturnDelivered(model.items().find(item => item.id === toy.toyId), target)).toBe(true); ok = model.stash(toy.toyId);
      }
      expect(["pick", "stash"]).toContain(toy.effect); expect(ok).toBe(true);
      expect(toy.toyId).toBeTruthy();
      trace.push({ effect: toy.effect!, id: toy.toyId!, beat: meta.beat }); planner.resolve(toy, ok, scene.now);
      if (toy.effect !== "pick") {
        director.resolve(meta, ok, toy.toyId);
        if (!director.current() || director.current()!.beat !== meta.beat) planner.cancel(scene.now);
      }
    }
    if (meta.command.kind === "curtain") { scene.curtainPhase = meta.command.phase; director.resolve(meta, true); }
    else director.complete(meta);
    trace.push({ effect: action.kind, id: model.carried(), beat: meta.beat }); model.tick(scene.now);
  };
  const entry = director.next(scene)!; director.complete(entry.meta); scene.now += entry.action!.duration;
  return { model, scene, director, trace, originalIds, offer, apply };
}

describe("140 real task admission before personality fallback", () => {
  it("B04 returns its single actual toy then opens the curtain and reaches its window observation", () => {
    const host = b04Host(1);
    for (let turn = 0; turn < 40 && !host.director.completed().includes("B04"); turn++) {
      const action = host.offer(); if (action) host.apply(action); else host.scene.now += 250;
    }
    expect(host.trace.filter(event => event.effect === "stash").map(event => event.id)).toEqual(host.originalIds);
    expect(host.model.count()).toBe(0); expect(host.model.carried()).toBeUndefined();
    expect(host.scene.curtainPhase).toBe("open");
    expect(host.trace.some(event => event.beat === 3 && event.effect === "look")).toBe(true);
    expect(host.director.completed()).toContain("B04");
  });

  it.each(["held", "removed"] as const)("B04 does not count its %s reserved second toy as a successful return", takeover => {
    const host = b04Host(2);
    for (let turn = 0; turn < 25 && !host.trace.some(event => event.effect === "stash"); turn++) {
      const action = host.offer(); expect(action).toBeTruthy(); host.apply(action!);
    }
    expect(host.trace.filter(event => event.effect === "stash")).toHaveLength(1);
    const second = host.offer()!; expect(second.personalityScene.itemId).toBeTruthy();
    const reserved = second.personalityScene.itemId!; expect(host.model.grab(reserved)).toBe(true);
    if (takeover === "removed") expect(host.model.returnHeld(reserved)).toBe(true);
    const retainedIds = host.model.ids(), takenAt = host.scene.now;
    for (let turn = 0; turn < 40 && host.director.active(); turn++) {
      const action = host.offer(); if (action) host.apply(action); else host.scene.now += 250;
    }
    expect(host.director.active()).toBe(false); expect(host.director.completed()).not.toContain("B04");
    expect(host.model.ids()).toEqual(retainedIds); expect(host.trace.filter(event => event.effect === "stash")).toHaveLength(1);
    expect(host.trace.some(event => event.beat > 0)).toBe(false); expect(host.scene.curtainPhase).toBe("closed");
    expect(host.scene.now - takenAt).toBeLessThan(8000);
  });
  it.each([.35, .4, .5, .64, .79])("allows tidy cleanup at hunger %s when no real meal owns the actor", hunger => {
    const planner = createCompanionToyPlanner();
    const action = planner.next({ world: world(), brain: brain(hunger), preferences: preferences(), now: 2000, toys: [toy("real-ball", 300)], count: 1, box });
    expect(action).toMatchObject({ kind: "walk", target: { x: 300 }, toy: { kind: "tidy" } });
  });

  it("lets unreachable food yield to a reachable toy, while reachable food and urgent hunger retain priority", () => {
    const w = world(), b = brain(), p = preferences();
    w.foods = [{ id: "unreachable-food", kind: "apple", x: 150, y: loft.y, platformId: loft.id }];
    expect(companionToyFoodPriority(b, w, p)).toBe(false);
    expect(createCompanionToyPlanner().next({ world: w, brain: b, preferences: p, now: 2000, toys: [toy("real-ball", 300)], count: 1, box })?.toy.kind).toBe("tidy");
    const reachable = { ...w, foods: [{ id: "reachable-food", kind: "apple" as const, x: 400, y: ground.y, platformId: ground.id }] };
    expect(companionToyFoodPriority(b, reachable, p)).toBe(true);
    for (const change of [{ preferences: { ...p, enabled: false } }, { preferences: { ...p, roam: false } }, { brain: brain(.8) }, { world: { ...w, paused: true } }, { world: { ...w, animated: false } }, { world: reachable }])
      expect(createCompanionToyPlanner().next({ world: w, brain: b, preferences: p, now: 2000, toys: [toy("real-ball", 300)], count: 1, box, ...change })).toBeUndefined();
    expect(companionToyFoodPriority(b, reachable, { ...p, feeding: false })).toBe(false);
  });

  it("keeps live care owners but releases exhausted meal or intention budgets", () => {
    const w = world(), p = preferences(), b = brain();
    expect(companionToyFoodPriority({ ...b, foodGoal: { foodId: "missing", remaining: 2, retryAfter: 0 } }, w, p)).toBe(true);
    expect(companionToyFoodPriority({ ...b, foodGoal: { foodId: "missing", remaining: 0, retryAfter: 99999 } }, w, p)).toBe(false);
    const intention = { kind: "feed" as const, targetId: ground.id, foodId: "missing", offset: .5, remaining: 0, stage: "travel" as const };
    expect(companionToyFoodPriority({ ...b, intention }, w, p)).toBe(false);
    expect(companionToyFoodPriority({ ...b, intention: { ...intention, remaining: 1 } }, w, p)).toBe(true);
  });

  it("reuses bounded route facts across new wrappers but invalidates food/source/geometry/flags immediately", () => {
    const proof = vi.spyOn(routing, "findPlatformRoute"), p = preferences(), b = brain(), w = world();
    w.foods = [{ id: "cache-isolated-snack", kind: "apple", x: 150, y: loft.y, platformId: loft.id }];
    try {
      expect(companionToyFoodPriority(b, w, p)).toBe(false); const first = proof.mock.calls.length;
      expect(first).toBeGreaterThan(0);
      expect(companionToyFoodPriority(b, { ...w, platforms: w.platforms.map(plane => ({ ...plane })), foods: w.foods.map(food => ({ ...food })) }, p)).toBe(false);
      expect(proof).toHaveBeenCalledTimes(first);
      const moved = { ...w, platforms: [ground, { ...loft, y: 550 }], foods: w.foods.map(food => ({ ...food, y: 550 })) };
      expect(companionToyFoodPriority(b, moved, p)).toBe(true); expect(proof.mock.calls.length).toBeGreaterThan(first);
      expect(companionToyFoodPriority(b, moved, { ...p, jump: false })).toBe(false);
      expect(companionToyFoodPriority(b, { ...w, x: 150, y: loft.y, platformId: loft.id }, p)).toBe(true);
      expect(companionToyFoodPriority(b, { ...w, foods: [{ ...w.foods[0], id: "moved-snack", y: ground.y, platformId: ground.id }] }, p)).toBe(true);
      const beforeExpiry = proof.mock.calls.length;
      expect(companionToyFoodPriority({ ...b, activeMs: 6001 }, w, p)).toBe(false); expect(proof.mock.calls.length).toBeGreaterThan(beforeExpiry);
      expect(companionToyFoodPriority({ ...b, hunger: .1 }, moved, p)).toBe(false);
      expect(companionToyFoodPriority(b, moved, { ...p, feeding: false })).toBe(false);
      const beforeOverflow = proof.mock.calls.length;
      for (let i = 0; i < 9; i++) companionToyFoodPriority(b, { ...w, foods: [{ ...w.foods[0], id: "bounded-snack-" + i }] }, p);
      expect(proof.mock.calls.length).toBe(beforeOverflow + 9);
      companionToyFoodPriority(b, w, p); expect(proof.mock.calls.length).toBe(beforeOverflow + 10);
    } finally { proof.mockRestore(); }
  });

  const start = (id: string, patch: Partial<PersonalitySceneInput> = {}) => {
    const recipe = COMPANION_PERSONALITY_SCENES.find(scene => scene.id === id)!, director = createCompanionPersonalityDirector([recipe]);
    const scene: PersonalitySceneInput = { world: world(), brain: brain(.1), preferences: preferences(recipe.personality), now: 0, home: { box }, toys: [toy("unreachable-nearest", 150, loft), toy("reachable-farther", 800)], tv: "off", ...patch };
    director.next(scene);
    const offer = () => {
      for (let step = 0; step < 12; step++) {
        const proposal = director.next(scene); if (!proposal) return;
        if (proposal.delegate) return proposal;
        if (proposal.action && ["walk", "jump"].includes(proposal.action.kind)) scene.world = { ...scene.world, ...proposal.action.target };
        else director.complete(proposal.meta);
        scene.now += proposal.action?.duration ?? 1;
      }
    };
    return { director, scene, offer };
  };

  it("proves actual approach and return before reserving a farther reachable ID", () => {
    const { scene, offer } = start("T01");
    expect(findCompanionToyRoute(scene.world, scene.toys[0], scene.world.platforms, true)).toBeNull();
    expect(findCompanionToyRoute(scene.world, scene.toys[1], scene.world.platforms, true)).not.toBeNull();
    expect(offer()?.meta.itemId).toBe("reachable-farther");
  });

  it("does not start an impossible return or substitute a new ID when a reserved object is taken", () => {
    const blocked = start("T01", { home: { box: { x: 150, y: loft.y, platformId: loft.id } } });
    expect(blocked.offer()).toBeUndefined(); expect(blocked.director.completed()).toEqual([]);
    const active = start("M01"), first = active.offer()!;
    expect(first.meta.itemId).toBe("reachable-farther"); active.director.resolve(first.meta, true, first.meta.itemId);
    active.scene.toys = [toy("new-different-ball", 400)]; active.scene.now += 100;
    expect(active.offer()?.meta.itemId).not.toBe("new-different-ball"); expect(active.director.completed()).toEqual([]);
  });

  it("retains novelty and homebody outside-only semantics while skipping blocked candidates", () => {
    const novel = start("C01", { toyPlayCounts: { ball: 4 }, toys: [toy("known", 140), { ...toy("unreachable-new", 150, loft), kind: "feather" }] });
    novel.director.event("toy-settled", 0); expect(novel.offer()).toBeUndefined(); expect(novel.director.completed()).toEqual([]);
    const room: Platform = { ...ground, id: "companion-home-floor", manualOnly: true };
    const homebody = start("H02", { world: { ...world(), platforms: [ground, room] }, favoriteToy: "ball", hasExperience: true,
      toys: [toy("favorite-inside", 140, room), toy("favorite-outside", 800)], home: { box } });
    expect(homebody.offer()?.meta.itemId).toBe("favorite-outside");
  });

  it("reserves T07 grooming for no actionable cleanup instead of competing with a real toy errand", () => {
    const recipe = COMPANION_PERSONALITY_SCENES.find(scene => scene.id === "T07")!;
    const candidate = (toys: readonly CompanionToy[], home: PersonalitySceneInput["home"] = { box }) => {
      const director = createCompanionPersonalityDirector([recipe]);
      const scene: PersonalitySceneInput = { world: world(), brain: brain(.5), preferences: preferences(), now: 0, home, toys, tv: "off" };
      director.next(scene); return director.next(scene);
    };
    expect(candidate([toy("reachable", 300)])?.meta.id).not.toBe("T07");
    expect(candidate([toy("blocked-only", 150, loft)])?.meta.id).toBe("T07");
    expect(candidate([])?.meta.id).toBe("T07");
    expect(candidate([toy("reachable-without-box", 300)], {})?.meta.id).toBe("T07");
  });

  it("also excludes T07 while a real outside food has a free reachable indoor storage destination", () => {
    const recipe = COMPANION_PERSONALITY_SCENES.find(scene => scene.id === "T07")!, room: Platform = { ...ground, id: "companion-home-floor", x: 650, width: 300, manualOnly: true };
    const make = (feeding: boolean) => {
      const director = createCompanionPersonalityDirector([recipe]), scene: PersonalitySceneInput = {
        world: { ...world(), platforms: [ground, room], foods: [{ id: "outside-snack", kind: "apple", x: 200, y: ground.y, platformId: ground.id }] },
        brain: brain(.1), preferences: { ...preferences(), feeding }, now: 0, home: { floor: { x: 800, y: room.y, platformId: room.id } }, toys: [], tv: "off",
      };
      director.next(scene); return director.next(scene);
    };
    expect(make(true)?.meta.id).not.toBe("T07"); expect(make(false)?.meta.id).toBe("T07");
  });

  it.each(COMPANION_PERSONALITY_SCENES.filter(scene => scene.steps.some(step => step.kind === "go" && step.target === "pointer")))("$id requires an allowed stable pointer before starting its human approach", recipe => {
      const scene: PersonalitySceneInput = {
        world: { ...world(), foods: [{ id: "real-apple", kind: "apple", x: 500, y: ground.y, platformId: ground.id }], pointer: { x: 700, y: 600, stableMs: 1000 } },
        brain: brain(recipe.steps.some(step => step.kind === "food" && step.mode === "eat" && !step.optional) ? .5 : .1), preferences: preferences(recipe.personality), now: 0, home: { box, floor: box, sofa: box, tv: box }, toys: [{ ...toy("real-duck", 300), kind: "duck" }],
        tv: "nature", canTv: true, learnedSocial: true, hasExperience: true, music: { mood: "calm", familiar: true },
        environment: { date: { y: 2026, m: 10, d: 20 }, season: "autumn", hour: 22, band: "night", night: true, weather: "clear", sunlight: 0 },
      };
      const firstAfterEntry = (input: PersonalitySceneInput) => {
        const director = createCompanionPersonalityDirector([recipe]); director.next(input);
        for (const event of recipe.triggers) director.event(event, input.now);
        return director.next(input)?.meta.id;
      };
      expect(firstAfterEntry(scene)).toBe(recipe.id);
      expect(firstAfterEntry({ ...scene, preferences: { ...scene.preferences, petting: false } })).not.toBe(recipe.id);
      expect(firstAfterEntry({ ...scene, world: { ...scene.world, pointer: undefined } })).not.toBe(recipe.id);
      expect(firstAfterEntry({ ...scene, world: { ...scene.world, pointer: { x: 700, y: 600, stableMs: 199 } } })).not.toBe(recipe.id);
    });

  it.each(["A07", "B07"])("%s keeps one safe approach endpoint when the pointer moves, and follows that support's layout", id => {
    const recipe = COMPANION_PERSONALITY_SCENES.find(scene => scene.id === id)!, director = createCompanionPersonalityDirector([recipe]);
    const scene: PersonalitySceneInput = { world: { ...world(), pointer: { x: 750, y: 600, stableMs: 1000 } }, brain: brain(.1), preferences: preferences(recipe.personality), now: 0, home: {}, toys: [], tv: "off" };
    director.next(scene); const first = director.next(scene)!;
    expect(first.meta.travel).toBe(true); const fixed = first.action!.target.x;
    scene.world.pointer = { x: 250, y: 600, stableMs: 0 }; scene.now = 100;
    expect(director.next(scene)?.action?.target.x).toBe(fixed);
    scene.world = { ...scene.world, x: scene.world.x + 80, platforms: scene.world.platforms.map(plane => ({ ...plane, x: plane.x + 80 })) };
    expect(director.next(scene)?.action?.target.x).toBeCloseTo(fixed + 80);
    expect(director.completed()).toEqual([]);
  });

  it("A01 retains its intentionally different live mouse-following destination", () => {
    const recipe = COMPANION_PERSONALITY_SCENES.find(scene => scene.id === "A01")!, director = createCompanionPersonalityDirector([recipe]);
    const scene: PersonalitySceneInput = { world: { ...world(), pointer: { x: 750, y: 600, stableMs: 1000 } }, brain: brain(.1), preferences: preferences("affectionate"), now: 0, home: {}, toys: [], tv: "off" };
    director.next(scene); const first = director.next(scene)!.action!.target.x;
    scene.world.pointer = { x: 250, y: 600, stableMs: 1000 }; scene.now = 100;
    expect(director.next(scene)?.action?.target.x).not.toBe(first);
  });

  it.each(COMPANION_PERSONALITIES)("keeps %s fallback travel real and honors petting/jump OFF on repeated decisions", personality => {
    const activity = createCompanionPersonalityActivity(() => .999), p = { ...preferences(personality), petting: false, jump: false };
    for (let now = 10000; now < 100000; now += 9000) {
      const action = activity.choose(brain(.1), world(), p, now)!;
      expect(action.kind).toBe("walk"); expect(action.play).toBeUndefined();
      expect(Math.abs(action.target.x-world().x)).toBeGreaterThanOrEqual(48);
      expect(action.target.platformId).toBe(ground.id);
      activity.record(action, world(), now, personality);
    }
  });
});
