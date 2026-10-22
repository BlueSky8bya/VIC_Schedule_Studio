import { describe, expect, it, vi } from "vitest";
import * as routing from "@/lib/ui/viewer-companion/brain";
import { createBrain, type CompanionBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES, type CompanionPersonality } from "@/lib/ui/viewer-companion/preferences";
import { accessibleCompanionToys, companionToyFoodPriority, createCompanionToyPlanner, createCompanionToys, findCompanionToyRoute, type CompanionToy } from "@/lib/ui/viewer-companion/toys";
import { createCompanionPersonalityDirector, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITY_SCENES, type PersonalitySceneRecipe } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { createCompanionPersonalityActivity } from "@/lib/ui/viewer-companion/personality-activity";
import { createCompanionHousehold } from "@/lib/ui/viewer-companion/household";
import { createCompanionPersonalityJobs, type PersonalityJobAction } from "@/lib/ui/viewer-companion/personality-jobs";
import { companionToyReturnDelivered, companionToyReturnTarget, sampleCompanionToyReturn } from "@/lib/ui/viewer-companion/toy-return";
import { getCompanionBehaviorProfile } from "@/lib/ui/viewer-companion/behavior-profile";

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
function b04Host(count: number, recipe = COMPANION_PERSONALITY_SCENES.find(scene => scene.id === "B04")!, extraRecipes: readonly PersonalitySceneRecipe[] = []) {
  const floor: Platform = { id: "companion-home-floor", x: 0, y: 600, width: 1000, kind: "floor", manualOnly: true };
  const contact = { ...floor, id: "companion-home-floor-food" }, boxPoint = { x: 850, y: floor.y, platformId: floor.id };
  const model = createCompanionToys(() => 0);
  model.sync([floor], { width: 1000, height: 700 }, 0, [contact]);
  for (let i = 0; i < count; i++) expect(model.spawn({ x: 300 + i * 90, y: 540, platformId: contact.id }, 0)).toBeTruthy();
  for (let at = 0; at <= 3000; at += 16) model.tick(at);
  const director = createCompanionPersonalityDirector([recipe, ...extraRecipes]), planner = createCompanionToyPlanner(), household = createCompanionHousehold(() => 0);
  const jobs = createCompanionPersonalityJobs(director, household, planner);
  const scene: PersonalitySceneInput = {
    world: { ...world(), platformId: floor.id, platforms: [floor] }, brain: brain(.5), preferences: preferences(recipe.personality), now: 3000,
    home: { box: boxPoint, window: { x: 500, y: floor.y, platformId: floor.id }, contacts: { curtain: { x: 500, y: floor.y - 45 } } }, toys: [], tv: "off", curtainPhase: "closed",
  };
  const trace: { effect: string; id?: string; beat: number }[] = [], originalIds = model.ids();
  const offer = () => {
    scene.toys = accessibleCompanionToys(model.available(), scene.world.platforms); scene.carriedToyId = model.carried(); scene.brain.activeMs = scene.now;
    const proposal = director.next(scene);
    return proposal?.meta.id === recipe.id ? jobs.next(proposal, {
      world: scene.world, brain: scene.brain, preferences: scene.preferences, now: scene.now, home: {}, box: boxPoint,
      toys: scene.toys, toyIds: model.ids(), carriedToy: model.carried(), toyCount: model.count(), foodCount: 0,
    }, scene.now) : undefined;
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
        director.resolve(meta, ok, toy.toyId, scene.now);
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
      if(recipe.id==="D143-A") { scene.brain.episode=undefined;scene.brain.foodGoal=undefined;scene.world.platforms=[...scene.world.platforms,{id:"another-public-support",x:600,y:600,width:200,kind:"date"}]; }
      const firstAfterEntry = (input: PersonalitySceneInput) => {
        const director = createCompanionPersonalityDirector([recipe]); director.next(input);
        for (const event of recipe.triggers) director.event(event, input.now);
        return director.next(input)?.meta.id;
      };
      // This TV-to-person recipe starts from actual indoor viewing, then
      // approaches the pointer. Its outside admission is checked separately.
      if (recipe.id === "A11" || recipe.id === "X-A-house") {
        const room = { ...ground, id: "companion-home-floor", manualOnly: true };
        scene.world = { ...scene.world, platformId: room.id, platforms: [room, ground, loft] };
        scene.home = { ...scene.home, sofa: { ...box, platformId: room.id }, tv: { ...box, platformId: room.id } };
      }
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

describe("146 optional TV viewing starts from its real occupied place", () => {
  const room: Platform = { id: "companion-home-floor", x: 0, y: 600, width: 350, kind: "floor", manualOnly: true };
  const sofa: Platform = { id: "companion-home", x: 0, y: 560, width: 160, kind: "floor" };
  const outside: Platform = { id: "actual-public-date", x: 400, y: 580, width: 180, kind: "date" };
  const source = (id: string) => COMPANION_PERSONALITY_SCENES.find(recipe => recipe.id === id)!;
  function host(recipe: PersonalitySceneRecipe, indoor = false, energy = .86) {
    const director = createCompanionPersonalityDirector([recipe]);
    const scene: PersonalitySceneInput = {
      world: { ...world(), x: indoor ? 80 : 490, y: indoor ? sofa.y : outside.y, platformId: indoor ? sofa.id : outside.id,
        platforms: [room, sofa, outside], pointer: { x: 520, y: outside.y, stableMs: 1000 } },
      brain: { ...brain(.08), energy, foodGoal: undefined, intention: undefined, episode: undefined },
      preferences: preferences(recipe.personality), now: 0, toys: [], tv: recipe.id === "X-P-house" ? "music" : "nature", canTv: true,
      home: { sofa: { x: 80, y: sofa.y, platformId: sofa.id }, tv: { x: 180, y: room.y, platformId: room.id },
        contacts: { tv: { x: 180, y: room.y - 30 } } },
    };
    const entry = director.next(scene)!; expect(entry.meta.id).toBe(`entry-${recipe.personality}`); director.complete(entry.meta);
    scene.now += entry.action!.duration;
    return { director, scene, offer: () => director.next(scene) };
  }

  it.each(["A11", "X-A-house", "X-P-house", "X-M-house", "X-B-house", "C04", "X-C-house"])("%s does not pull an awake outside visitor back for a new TV prelude", id => {
    const h = host(source(id));
    expect(h.offer()).toBeUndefined(); expect(h.director.active()).toBe(false); expect(h.director.completed()).toEqual([]);
    expect(h.scene.world.platformId).toBe(outside.id);
  });

  it.each(["A11", "X-A-house", "X-P-house", "X-M-house", "X-B-house", "C04", "X-C-house"])("%s may choose its real TV journey after the existing outside cadence", id => {
    const h = host(source(id)), cadence = getCompanionBehaviorProfile(h.scene.preferences, h.scene.brain.habits).outsideCadenceMs;
    // A real outside visit has moved; waiting motionless past the independent
    // physical-progress deadline cannot authorize a new stationary watch.
    h.scene.world.x += 10; h.scene.now = cadence-1; expect(h.offer()).toBeUndefined();
    h.scene.now = cadence; expect(h.offer()?.meta.id).toBe(id);
    expect(h.director.completed()).toEqual([]); expect(h.scene.world.platformId).toBe(outside.id);
  });

  it("keeps one actual public visit across public supports and unsupported flight samples", () => {
    const h = host(source("C04")), other = { ...outside, id: "another-public-date", x: 610 };
    h.scene.world.platforms = [...h.scene.world.platforms, other];
    h.scene.now = 10000; h.scene.world = { ...h.scene.world, x: 700, platformId: other.id }; expect(h.offer()).toBeUndefined();
    h.scene.now = 17000; h.scene.world.y -= 20; expect(h.offer()).toBeUndefined();
    h.scene.now = 24000; h.scene.world.y = other.y; expect(h.offer()?.meta.id).toBe("C04");
    expect(h.director.completed()).toEqual([]);
  });

  it.each([NaN, Infinity, -Infinity])("invalid input time %s cannot age a newly supported public visit", invalidTime => {
    const h = host(source("C04")); h.scene.now = invalidTime;
    expect(h.offer()).toBeUndefined(); expect(h.director.active()).toBe(false);
    expect(h.director.completed()).toEqual([]); expect(h.scene.world.platformId).toBe(outside.id);
  });

  it("starts a new bounded visit after actual home return and after personality replacement", () => {
    const h = host(source("C04")); h.scene.now = 20000;
    h.scene.world = { ...h.scene.world, x: 80, y: sofa.y, platformId: sofa.id }; h.scene.canTv = false;
    expect(h.offer()).toBeUndefined(); h.scene.canTv = true;
    h.scene.now = 21000; h.scene.world = { ...h.scene.world, x: 490, y: outside.y, platformId: outside.id }; expect(h.offer()).toBeUndefined();
    h.scene.now = 24000; expect(h.offer()).toBeUndefined();
    h.scene.now = 44999; expect(h.offer()).toBeUndefined(); h.scene.now = 45000; expect(h.offer()?.meta.id).toBe("C04");
    h.scene.preferences.personality = "tidy"; h.scene.now += 50; expect(h.offer()?.meta.id).toBe("entry-tidy");
    h.scene.preferences.personality = "curious"; h.scene.now += 50;
    const entry = h.offer()!; expect(entry.meta.id).toBe("entry-curious"); h.director.complete(entry.meta);
    h.scene.now += entry.action!.duration; expect(h.offer()).toBeUndefined();
  });

  // Uses the same physical toy owner/planners and exact box delivery checks
  // as B04 above; only the one required return fixture has no decorative tail.
  function returnedRoom(personality: CompanionPersonality, acknowledgement = "success") {
    const viewing = { ...source("C04"), personality };
    const chore: PersonalitySceneRecipe = { id: "one-real-room-return", label: "actual single physical return", personality, major: true, triggers: ["toy"], steps: [{ kind: "toy", mode: "return" }] };
    const h = b04Host(1, chore, [viewing]), room = h.scene.world.platforms[0];
    h.scene.world = { ...h.scene.world, width: 1400, platforms: [...h.scene.world.platforms, { ...outside, x: 1000, y: 580, width: 240 }] };
    h.scene.home = { ...h.scene.home, sofa: { x: 100, y: room.y, platformId: room.id }, tv: { x: 180, y: room.y, platformId: room.id }, contacts: { tv: { x: 180, y: room.y-30 } } };
    h.scene.tv = "nature"; h.scene.canTv = true; h.scene.brain.hunger = .1; h.scene.now = 60000;
    const original = h.director.resolve.bind(h.director);
    vi.spyOn(h.director, "resolve").mockImplementation((meta, ok, itemId, at) => {
      if (acknowledgement === "failed") return original(meta, false, itemId, at);
      if (acknowledgement === "stale") return original(meta, ok, itemId, -1);
      if (acknowledgement === "foreign-serial") return original({ ...meta, serial: meta.serial+1 }, ok, itemId, at);
      if (acknowledgement === "travel") return original({ ...meta, travel: true }, ok, itemId, at);
      return original(meta, ok, itemId, at);
    });
    for (let turn = 0; turn < 40 && !h.trace.some(event => event.effect === "stash"); turn++) {
      const action = h.offer(); if (!action) throw Error("Real required return lost admission"); h.apply(action);
    }
    expect(h.trace.filter(event => event.effect === "stash").map(event => event.id)).toEqual(h.originalIds);
    expect(h.model.count()).toBe(0); expect(h.model.carried()).toBeUndefined();
    const at = h.scene.now;
    if (acknowledgement !== "success") h.director.cancel();
    h.scene.toys = []; h.scene.carriedToyId = undefined;
    return { ...h, at, choose: () => h.director.next(h.scene) };
  }

  it.each(["balanced", "sleepy"] as const)("reopens only the existing %s indoor opportunity after a real return", personality => {
    const h = returnedRoom(personality), window = personality === "sleepy" ? 45000 : 8000;
    h.scene.now = h.at+window-1;
    expect(h.choose()?.meta.id).toBe("C04"); expect(h.director.completed()).toEqual(["one-real-room-return"]);
  });
  it.each(["balanced", "sleepy"] as const)("expires the %s real-return opportunity at its original boundary", personality => {
    const h = returnedRoom(personality); h.scene.now = h.at+(personality === "sleepy" ? 45000 : 8000);
    expect(h.choose()).toBeUndefined(); expect(h.director.completed()).toEqual(["one-real-room-return"]);
  });
  it.each(["failed", "stale", "foreign-serial", "travel"])("a %s return ACK cannot reopen room leisure", acknowledgement => {
    const h = returnedRoom("balanced", acknowledgement); h.scene.now += 50;
    expect(h.choose()).toBeUndefined(); expect(h.director.completed()).not.toContain("C04");
  });
  it("a toy-returned cue or repeated admission queries alone cannot reopen room leisure", () => {
    const h = host(source("C04"), true); h.scene.now = 60000;
    h.director.event("toy-returned", h.scene.now);
    for (let i = 0; i < 8; i++) { expect(h.offer()).toBeUndefined(); h.scene.now += 50; }
    expect(h.director.completed()).toEqual([]);
  });

  it.each(["A11", "X-A-house", "X-P-house", "X-M-house", "X-B-house", "C04", "X-C-house"])("%s still starts from actual indoor TV viewing", id => {
    const h = host(source(id), true), proposal = h.offer();
    expect(proposal?.meta.id).toBe(id); expect(h.director.active()).toBe(true); expect(h.director.completed()).toEqual([]);
  });

  it.each([
    ["affectionate", .4, false], ["affectionate", .399, true], ["sleepy", .62, false], ["sleepy", .619, true], ["homebody", .9, true],
  ] as const)("preserves %s energy %s admission boundary", (personality, energy, admitted) => {
    const h = host({ ...source("X-A-house"), personality }, false, energy);
    expect(Boolean(h.offer())).toBe(admitted); expect(h.director.completed()).toEqual([]);
  });

  it("preserves a direct pet event and an already owned TV scene instead of cancelling them as new leisure", () => {
    const petRecipe: PersonalitySceneRecipe = { ...source("X-A-house"), triggers: ["pet", "tv"] };
    const pet = host(petRecipe); pet.director.event("pet", pet.scene.now); expect(pet.offer()?.meta.id).toBe(petRecipe.id);
    const owned = host(source("X-A-house"), true), first = owned.offer()!;
    expect(first.action?.kind).toBe("look");
    owned.scene.world = { ...owned.scene.world, x: 490, y: outside.y, platformId: outside.id };
    owned.scene.now += 100;
    expect(owned.offer()?.meta.serial).toBe(first.meta.serial); expect(owned.director.completed()).toEqual([]);
  });

  it("keeps a real required meal eligible and does not invent a successful TV watch", () => {
    const recipe: PersonalitySceneRecipe = { ...source("X-A-house"), steps: [{ kind: "food", mode: "eat" }, ...source("X-A-house").steps] };
    const h = host(recipe); h.scene.brain.hunger = .5;
    h.scene.world.foods = [{ id: "actual-snack", kind: "apple", x: 520, y: outside.y, platformId: outside.id }];
    expect(h.offer()?.delegate).toMatchObject({ kind: "food", mode: "eat" }); expect(h.director.completed()).toEqual([]);
  });

  it("retains a watch after a real audience departure without resetting its subject to the TV", () => {
    const recipe: PersonalitySceneRecipe = { ...source("X-A-house"), steps: [{ kind: "go", target: "pointer" }, { kind: "watch", ms: 1100 }] };
    const h = host(recipe);
    for (let turn = 0; turn < 8; turn++) {
      const proposal = h.offer()!; expect(proposal).toBeTruthy();
      expect(proposal.action?.target.platformId).toBe(outside.id);
      if (proposal.meta.command.kind === "watch") { expect(proposal.action?.kind).toBe("look"); return; }
      h.scene.world = { ...h.scene.world, ...proposal.action!.target }; h.scene.now += proposal.action!.duration; h.director.complete(proposal.meta);
    }
    throw new Error("Actual outside approach did not reach its watch");
  });
});
