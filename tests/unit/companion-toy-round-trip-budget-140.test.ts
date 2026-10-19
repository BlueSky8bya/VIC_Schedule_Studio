import { describe, expect, it } from "vitest";
import { COMPANION_ROUTE_LIMITS, createBrain, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionHousehold } from "@/lib/ui/viewer-companion/household";
import { createCompanionPersonalityDirector, nextCompanionPersonalityScene, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { createCompanionPersonalityJobs, type PersonalityJobAction } from "@/lib/ui/viewer-companion/personality-jobs";
import { COMPANION_PERSONALITY_SCENES } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_TIMING } from "@/lib/ui/viewer-companion/timing";
import { createCompanionToyPlanner, createCompanionToys, findCompanionToyRoute } from "@/lib/ui/viewer-companion/toys";
import { companionToyReturnDelivered, companionToyReturnTarget, sampleCompanionToyReturn } from "@/lib/ui/viewer-companion/toy-return";

/** Real object/planner/director ownership with an ordinary finite unit host.
 * No browser clock or renderer claim: only returned physical endpoints and
 * successful actual model effects acknowledge a step. */
function fixture(segments = 8) {
  const platforms: Platform[] = Array.from({ length: segments }, (_, index) => ({
    id: index ? `viewport-floor-${index}` : "companion-home-floor", x: 80 + index * 220, y: 600, width: 130, kind: "floor", ...(index ? {} : { manualOnly: true }),
  }));
  const box = { x: 130, y: 600, platformId: platforms[0].id }, far = platforms.at(-1)!;
  const model = createCompanionToys(() => 0); model.sync(platforms, { width: segments * 220 + 200, height: 720 }, 0);
  const id = model.spawn({ x: far.x + 70, y: 570 }, 0)!;
  for (let now = 16; now <= 3000; now += 16) model.tick(now);
  expect(model.available()).toHaveLength(1); expect(model.available()[0].platformId).toBe(far.id);
  const recipe = COMPANION_PERSONALITY_SCENES.find(scene => scene.id === "T01")!;
  const director = createCompanionPersonalityDirector([recipe]), planner = createCompanionToyPlanner();
  const jobs = createCompanionPersonalityJobs(director, createCompanionHousehold(() => 0), planner);
  const input: PersonalitySceneInput = {
    world: { ...box, platforms, width: segments * 220 + 200, height: 720, animated: true, foods: [] },
    brain: { ...createBrain(0, () => .5), energy: .95, hunger: .5 },
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "tidy", sleep: false, learnFromYou: false },
    now: 3000, toys: [], toyCount: 1, home: { box, floor: box, sofa: box }, tv: "off",
  };
  const actions: PersonalityJobAction[] = [], effects: { effect: string; id?: string; at: number }[] = [];
  const refresh = () => { input.toys = model.available(); input.carriedToyId = model.carried(); input.toyCount = model.count(); input.brain.activeMs = input.now; };
  const offer = () => {
    refresh(); const proposal = nextCompanionPersonalityScene(director, input);
    return proposal && jobs.next(proposal, { world: input.world, brain: input.brain, preferences: input.preferences, now: input.now, home: {}, box,
      toys: input.toys, toyIds: model.ids(), carriedToy: model.carried(), toyCount: model.count(), foodCount: 0 });
  };
  const apply = (action: PersonalityJobAction) => {
    actions.push(action); const from = input.world;
    if (action.kind === "walk" || action.kind === "jump") {
      const support = input.world.platforms.find(platform => platform.id === action.target.platformId)!;
      expect(support).toBeTruthy(); expect(action.target.y).toBe(support.y);
      expect(action.target.x).toBeGreaterThanOrEqual(support.x); expect(action.target.x).toBeLessThanOrEqual(support.x + support.width);
      input.world = { ...input.world, ...action.target };
      if (model.carried()) expect(model.carry(id, { x: input.world.x, y: input.world.y - 30 })).toBe(true);
    }
    const impulse = Math.sqrt(2 * 1100 * 140), dy = action.target.y - from.y;
    input.now += action.kind === "jump" ? COMPANION_TIMING.jumpAnticipation + COMPANION_TIMING.jumpLanding
      + (impulse + Math.sqrt(impulse * impulse + 2 * 1100 * dy)) / 1100 * 1000 : action.duration;
    const beat = action.toy;
    if (beat?.effect) {
      expect(beat.toyId).toBe(id); let ok = false;
      if (beat.effect === "pick") ok = model.pick(id, input.world);
      if (beat.effect === "stash") {
        const opening = companionToyReturnTarget({ left: 105, top: 530, width: 50, height: 25 })!;
        expect(model.carried()).toBe(id); expect(input.world.platformId).toBe(box.platformId);
        expect(model.carry(id, sampleCompanionToyReturn(model.items()[0], opening, 1))).toBe(true);
        expect(companionToyReturnDelivered(model.items()[0], opening)).toBe(true); ok = model.stash(id);
      }
      expect(ok).toBe(true); effects.push({ effect: beat.effect, id: beat.toyId, at: input.now }); planner.resolve(beat, ok, input.now);
      if (beat.effect !== "pick") director.resolve(action.personalityScene, ok, id);
    }
    director.complete(action.personalityScene); input.now += 220; model.tick(input.now);
  };
  refresh(); const entry = director.next(input)!; director.complete(entry.meta); input.now += entry.action!.duration;
  return { input, model, id, director, planner, actions, effects, offer, apply, refresh };
}

describe("140 toy work budgets follow the proved complete round trip", () => {
  it("carries one actual far-away ID home over more than18 route steps without a drop, ready loop or retry", () => {
    const host = fixture(), actual = host.model.available()[0], started = host.input.now;
    const approach = findCompanionToyRoute(host.input.world, actual, host.input.world.platforms, true)!;
    const back = findCompanionToyRoute(actual, host.input.home.box!, host.input.world.platforms, true)!;
    expect(approach.length + back.length).toBeGreaterThan(18);
    expect(approach.filter(step => step.kind === "jump").length).toBeLessThanOrEqual(COMPANION_ROUTE_LIMITS.maxHops);
    expect(back.filter(step => step.kind === "jump").length).toBeLessThanOrEqual(COMPANION_ROUTE_LIMITS.maxHops);
    for (let n = 0; n < 70 && !host.director.completed().includes("T01"); n++) {
      const action = host.offer(); expect(action, `real job disappeared at ${host.input.now}`).toBeDefined();
      expect(action!.personalityScene.id).toBe("T01"); host.apply(action!);
      if (host.effects.some(effect => effect.effect === "pick") && !host.effects.some(effect => effect.effect === "stash")) expect(host.model.carried()).toBe(host.id);
    }
    expect(host.director.completed()).toEqual(["T01"]); expect(host.model.ids()).toEqual([]);
    expect(host.actions.filter(action => ["walk", "jump"].includes(action.kind)).length).toBeGreaterThan(18);
    expect(host.effects.map(effect => [effect.effect, effect.id])).toEqual([["pick", host.id], ["stash", host.id]]);
    expect(host.effects.at(-1)!.at - started).toBeGreaterThan(30000);
    expect(host.effects.at(-1)!.at - started).toBeLessThan(60000);
  });

  it.each(["missing-return", "held", "roam-off", "jump-off", "disabled", "paused"] as const)("does not spend a longer budget across %s", change => {
    const host = fixture(); let action: PersonalityJobAction | undefined;
    for (let n = 0; n < 25 && !host.model.carried(); n++) { action = host.offer(); expect(action).toBeDefined(); host.apply(action!); }
    expect(host.model.carried()).toBe(host.id);
    if (change === "missing-return") host.input.world.platforms = host.input.world.platforms.filter(platform => platform.id !== host.input.home.box!.platformId);
    if (change === "held") expect(host.model.grab(host.id)).toBe(true);
    if (change === "roam-off") host.input.preferences.roam = false;
    if (change === "jump-off") host.input.preferences.jump = false;
    if (change === "disabled") host.input.preferences.enabled = false;
    if (change === "paused") host.input.world.paused = true;
    for (let n = 0; n < 6; n++) { const next = host.offer(); expect(next?.toy?.effect).not.toBe("stash"); host.input.now += 250; }
    expect(host.model.ids()).toEqual([host.id]); expect(host.effects.filter(effect => effect.effect === "stash")).toEqual([]);
    expect(host.director.completed()).toEqual([]);
  });

  it("keeps the12-hop graph limit and never admits an unproved round trip", () => {
    const host = fixture(15);
    expect(findCompanionToyRoute(host.input.world, host.model.available()[0], host.input.world.platforms, true)).toBeNull();
    // The authored grooming introduction may play before its required real
    // object is reserved. It cannot create or finish the invalid toy job.
    host.apply(host.offer()!); expect(host.offer()?.personalityScene.id).not.toBe("T01");
    expect(host.planner.active()).toBe(false); expect(host.model.ids()).toEqual([host.id]);
  });

  it("does not replenish the proved finite movement budget on repeated unchanged replans", () => {
    const host = fixture(); host.refresh(); const input = { world: host.input.world, brain: host.input.brain, preferences: host.input.preferences,
      now: host.input.now, toys: host.input.toys, existingIds: host.model.ids(), carriedId: host.model.carried(), count: 1, box: host.input.home.box };
    host.planner.wake(input.now, true); let offered = 0;
    for (; offered < 60; offered++) { if (!host.planner.next(input)) break; }
    expect(offered).toBeGreaterThan(18); expect(offered).toBeLessThanOrEqual((COMPANION_ROUTE_LIMITS.maxHops * 2 + 1) * 2 + 4);
    expect(host.planner.active()).toBe(false); expect(host.model.ids()).toEqual([host.id]);
  });

  it("retains the director's7.5-second no-progress bound and its failure cooldown", () => {
    const host = fixture(), first = host.offer()!; expect(first.personalityScene.id).toBe("T01"); host.apply(first);
    const start = host.input.now;
    for (let n = 0; n < 17; n++) { host.offer(); host.input.now += 500; }
    expect(host.input.now - start).toBe(8500); expect(host.director.current()).toBeUndefined();
    expect(host.offer()?.personalityScene.id).not.toBe("T01"); expect(host.model.ids()).toEqual([host.id]);
    expect(host.effects).toEqual([]);
  });
});
