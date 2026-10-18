import { describe, expect, it } from "vitest";
import { createBrain, type CompanionAction, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { createCompanionPersonalityActivity, preflightCompanionPersonalityActivity } from "@/lib/ui/viewer-companion/personality-activity";
import { accessibleCompanionToys, companionToyMotivation, createCompanionToyPlanner, createCompanionToys, findCompanionToyRoute, type CompanionToy } from "@/lib/ui/viewer-companion/toys";
import { normalizeCompanionTastes } from "@/lib/ui/viewer-companion/toy-tastes";
import { createCompanionLife, experienceCompanionLife, getCompanionFoodPreference } from "@/lib/ui/viewer-companion/life";

const floor: Platform = { id: "floor", x: 0, y: 600, width: 1000, kind: "floor" };
const world: CompanionWorld = { x: 100, y: 600, platformId: floor.id, platforms: [floor], width: 1000, height: 700, animated: true };
const brain = { ...createBrain(0, () => .5), hunger: .05, energy: .9 };
const toy: CompanionToy = { id: "actual-toy", kind: "ball", x: 400, y: 600, platformId: floor.id, angle: 0, held: false, carried: false };
function context(personality: CompanionPreferences["personality"] = "tidy") {
  return { world, brain, preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality }, now: 2000, toys: [toy], existingIds: [toy.id], count: 1, box: { x: 100, y: 600, platformId: floor.id } };
}
const idle: CompanionAction = { kind: "idle", target: { x: 100, y: 600, platformId: floor.id }, duration: 500 };

describe("122 actual toy admission and ownership", () => {
  it("ejects four real chest objects onto the existing small room packet and returns each from a body-safe stance", () => {
    // Native3 source opening/floor gap; the pet span ends before the small
    // object's measured span. No extra platform, rise or endpoint is invented.
    const home: Platform = { id: "companion-home-floor", x: 50, y: 571.188, width: 207.04, kind: "floor", manualOnly: true };
    const small: Platform = { id: "companion-home-floor-food", x: 57, y: home.y, width: 218, kind: "floor", manualOnly: true };
    const ground: Platform = { ...floor, id: "viewport-floor", y: 1030, width: 1900 };
    const model = createCompanionToys(), planner = createCompanionToyPlanner(); model.sync([ground, home], { width: 1920, height: 1100 }, 0, [small]);
    const ids = Array.from({ length: 4 }, () => model.spawn({ x: 315.969, y: 469.188, platformId: small.id }, 0)!);
    expect(model.items().every(toy => toy.x === 315.969 && toy.y === 469.188 && !toy.platformId)).toBe(true);
    for (let now = 16; now < 1800; now += 16) model.tick(now);
    expect(model.available()).toHaveLength(4); expect(model.available().every(toy => toy.platformId === small.id && toy.y === home.y)).toBe(true);
    let position = { ...world, x: 136.414, y: home.y, platformId: home.id, platforms: [ground, home] }, now = 2000;
    const picked: string[] = [], returned: string[] = [];
    for (let beat = 0; beat < 100 && model.count(); beat++) {
      const actual = model.available(), available = accessibleCompanionToys(actual, position.platforms);
      expect(available.every(toy => toy.platformId === small.id && toy.stance?.platformId === home.id && Math.abs(toy.x - toy.stance.x) <= 48)).toBe(true);
      const action = planner.next({ ...context(), world: position, now, toys: available, existingIds: model.ids(), carriedId: model.carried(), count: model.count(), box: { x: 245.04, y: home.y, platformId: home.id } });
      if (!action) { now += 250; continue; }
      if (["walk", "jump"].includes(action.kind)) { position = { ...position, ...action.target, platformId: action.target.platformId! }; const id = model.carried(); if (id) model.carry(id, { x: position.x, y: position.y - 30 }); }
      if (action.toy.effect === "pick") { const id = action.toy.toyId!, ok = model.pick(id, position); expect(ok).toBe(true); picked.push(id); planner.resolve(action.toy, ok, now); }
      if (action.toy.effect === "stash") { const id = action.toy.toyId!, ok = model.stash(id); expect(ok).toBe(true); returned.push(id); planner.resolve(action.toy, ok, now); }
      now += action.duration;
    }
    expect(picked.sort()).toEqual([...ids].sort()); expect(returned.sort()).toEqual([...ids].sort()); expect(now).toBeLessThan(30000);
    expect(accessibleCompanionToys([{ ...toy, x: 700, y: home.y, platformId: small.id }], [home])).toEqual([]);
  });
  it("keeps the real chest opening before the first physical contact even with a floor hint", () => {
    const model = createCompanionToys(); model.sync([floor], { width: 1000, height: 700 }, 0);
    model.spawn({ x: 400, y: 430, platformId: floor.id }, 0);
    expect(model.items()[0]).toMatchObject({ x: 400, y: 430, platformId: undefined });
    model.tick(100); expect(model.items()[0].y).toBeLessThan(430);
    for (let now = 116; now < 1800; now += 16) model.tick(now);
    expect(model.available()[0]).toMatchObject({ platformId: floor.id, y: floor.y });
  });
  it("retains measured home floors and actual toy anchors before the physics200-node cap", () => {
    const home = { ...floor, id: "companion-home-floor", x: 100, width: 400, y: 500, manualOnly: true };
    const fillers = Array.from({ length: 200 }, (_, i) => ({ ...floor, id: "dense-" + i, x: 1500, y: 900 }));
    const model = createCompanionToys(); model.sync([...fillers, home], { width: 1920, height: 1100 }, 0);
    model.spawn({ x: 300, y: 400 }, 0);
    for (let now = 16; now < 1800; now += 16) model.tick(now);
    expect(model.available()[0].platformId).toBe(home.id);
    model.sync([...fillers, { ...home, x: 150, width: 300 }], { width: 1920, height: 1100 }, 2000);
    expect(model.available()[0].platformId).toBe(home.id); expect(model.moving()).toBe(false);
  });
  it("uses a real room floor between the cushion and a toy-only manual support in a dense world", () => {
    const seat: Platform = { id: "companion-home", x: 90, y: 400, width: 50, kind: "date" };
    const home: Platform = { id: "companion-home-floor", x: 80, y: 440, width: 360, kind: "floor", manualOnly: true };
    const ledge: Platform = { id: "toy-only", x: 540, y: 540, width: 80, kind: "card", manualOnly: true };
    const dense = Array.from({ length: 200 }, (_, i) => ({ ...floor, id: "dense-" + i, x: 2000, y: 2000 }));
    const supports = [...dense, seat, home, ledge], from = { x: 110, y: 400, platformId: seat.id }, target = { x: 560, y: 540, platformId: ledge.id };
    const route = findCompanionToyRoute(from, target, supports, true)!;
    expect(route).not.toBeNull(); expect(route.some(step => step.target.platformId === home.id)).toBe(true);
    expect(route.at(-1)?.target.platformId).toBe(ledge.id);
    expect(findCompanionToyRoute(target, { x: 140, y: 440, platformId: home.id }, supports, true)).not.toBeNull();
    expect(findCompanionToyRoute(from, target, supports, false)).toBeNull();
    expect(home.manualOnly).toBe(true); expect(ledge.manualOnly).toBe(true);
  });
  it("admits cleanup despite ordinary host cancellation on every short idle", () => {
    const planner = createCompanionToyPlanner(), input = context();
    for (const now of [200, 700, 1100]) { planner.cancel(now); expect(planner.next({ ...input, now })).toBeUndefined(); }
    planner.cancel(1600);
    expect(planner.next({ ...input, now: 1600 })).toMatchObject({ kind: "walk", toy: { kind: "tidy" } });
  });
  it("wakes an ordinary walk for a real settled toy once per bounded cue; protected owners keep control", () => {
    const input = { ...context(), action: { ...idle, kind: "walk" as const }, active: true, grounded: true };
    const planner = createCompanionToyPlanner();
    expect(planner.notice(input)).toBe(true); expect(planner.notice({ ...input, now: 2250 })).toBe(false);
    for (const patch of [{ held: true }, { commanded: true }, { busy: true }, { active: false }, { grounded: false }, { action: { ...idle, scene: { id: 7 } } }, { action: { ...idle, household: {} } }, { brain: { ...brain, hunger: .8 } }])
      expect(createCompanionToyPlanner().notice({ ...input, ...patch })).toBe(false);
    expect(createCompanionToyPlanner().notice({ ...input, action: { ...idle, scene: { id: 35 } } })).toBe(true);
  });
  it("does not pick an accessible toy when the box cannot be reached from its real support", () => {
    const isolated = { ...floor, id: "isolated-box", x: 50, width: 80, y: 200, manualOnly: true };
    const input = context(); input.preferences.jump = false;
    expect(createCompanionToyPlanner().next({ ...input, world: { ...world, platforms: [floor, isolated] }, box: { x: 70, y: 200, platformId: isolated.id } })).toBeUndefined();
  });
  it("a failed nearest effect yields to another actual toy rather than selecting the failed one forever", () => {
    const planner = createCompanionToyPlanner(), input = context();
    const pick = planner.next({ ...input, world: { ...world, x: toy.x } })!;
    expect(pick.toy.effect).toBe("pick"); planner.resolve(pick.toy, false, input.now);
    const other = { ...toy, id: "other", x: 700 };
    expect(planner.next({ ...input, now: 2600, toys: [toy, other] })).toMatchObject({ target: { x: 700 }, toy: { kind: "tidy" } });
  });
  it("native grabbing immediately takes a carried object and cancels its pending autonomous delivery", () => {
    const model = createCompanionToys(); model.sync([floor], { width: 1000, height: 700 }, 0);
    const id = model.spawn({ x: 400, y: 500 }, 0)!;
    for (let now = 16; now < 1800; now += 16) model.tick(now);
    const actual = model.available()[0], planner = createCompanionToyPlanner(), input = context();
    const pick = planner.next({ ...input, world: { ...world, x: actual.x }, toys: [actual], existingIds: [id] })!;
    expect(model.pick(id, actual)).toBe(true); planner.resolve(pick.toy, true, input.now);
    expect(model.grab(id)).toBe(true); expect(model.carried()).toBeUndefined(); expect(model.items()[0].held).toBe(true);
    expect(planner.next({ ...input, now: 2100, carriedId: model.carried() })).toBeUndefined();
    expect(planner.active()).toBe(false); model.releaseCarry(2100); expect(model.items()[0].held).toBe(true);
  });
  it("gives the eight personalities different actual toy motivation instead of universal five-second spawning", () => {
    const motivations = COMPANION_PERSONALITIES.map(personality => companionToyMotivation({ ...DEFAULT_COMPANION_PREFERENCES, personality }, brain, world));
    expect(motivations.filter(item => item.spawn)).toHaveLength(3);
    expect(new Set(motivations.map(item => item.cooldown)).size).toBeGreaterThan(5);
    expect(companionToyMotivation({ ...DEFAULT_COMPANION_PREFERENCES, personality: "gourmet" }, { ...brain, hunger: .5 }, world).interested).toBe(false);
    expect(companionToyMotivation({ ...DEFAULT_COMPANION_PREFERENCES, personality: "affectionate" }, brain, { ...world, pointer: { x: 180, y: 550, stableMs: 1000 } }).interested).toBe(false);
    expect(companionToyMotivation({ ...DEFAULT_COMPANION_PREFERENCES, personality: "homebody" }, brain, world).interested).toBe(false);
    expect(companionToyMotivation({ ...DEFAULT_COMPANION_PREFERENCES, personality: "sleepy" }, { ...brain, energy: .3 }, world).interested).toBe(false);
  });
  it("returns all four real settled objects through individual successful pick and stash acknowledgements", () => {
    const model = createCompanionToys(), planner = createCompanionToyPlanner(); model.sync([floor], { width: 1000, height: 700 }, 0);
    const ids = [300, 450, 600, 750].map(x => model.spawn({ x, y: 500 }, 0)!);
    for (let now = 16; now < 1800; now += 16) model.tick(now);
    let position = { ...world }, now = 2000; const picked: string[] = [], returned: string[] = [];
    for (let beat = 0; beat < 100 && model.count(); beat++) {
      const input = { ...context(), world: position, now, toys: model.available(), existingIds: model.ids(), carriedId: model.carried(), count: model.count() };
      const action = planner.next(input);
      if (!action) { now += 250; continue; }
      if (action.kind === "walk" || action.kind === "jump") { position = { ...position, ...action.target }; const held = model.carried(); if (held) model.carry(held, { x: position.x, y: position.y - 30 }); }
      if (action.toy.effect === "pick") { const id = action.toy.toyId!; const ok = model.pick(id, position); expect(ok).toBe(true); picked.push(id); planner.resolve(action.toy, ok, now); }
      if (action.toy.effect === "stash") { const id = action.toy.toyId!; expect(model.carried()).toBe(id); const ok = model.stash(id); expect(ok).toBe(true); returned.push(id); planner.resolve(action.toy, ok, now); }
      now += action.duration;
    }
    expect(picked.sort()).toEqual([...ids].sort()); expect(returned.sort()).toEqual([...ids].sort()); expect(model.count()).toBe(0); expect(now).toBeLessThan(60000);
  });
  it("returns four physically scattered toys from manual and ordinary supports through the real room floor", () => {
    const home: Platform = { id: "companion-home-floor", x: 60, y: 600, width: 260, kind: "floor", manualOnly: true };
    const seat: Platform = { id: "companion-home", x: 100, y: 560, width: 80, kind: "date" };
    const bridge: Platform = { id: "bridge", x: 300, y: 710, width: 400, kind: "date" };
    const lower: Platform = { id: "lower", x: 330, y: 830, width: 400, kind: "date" };
    const ground: Platform = { id: "viewport-floor", x: 12, y: 960, width: 976, kind: "floor" };
    const manual: Platform = { id: "toy-only", x: 720, y: 710, width: 100, kind: "card", manualOnly: true };
    const supports = [seat, bridge, lower, ground, home, manual], model = createCompanionToys(), planner = createCompanionToyPlanner();
    model.sync(supports, { width: 1000, height: 1100 }, 0);
    const ids = [{ x: 210, y: 590 }, { x: 520, y: 800 }, { x: 700, y: 900 }, { x: 750, y: 690 }].map(point => model.spawn(point, 0)!);
    for (let now = 16; now < 1800; now += 16) model.tick(now);
    expect(model.available()).toHaveLength(4); expect(new Set(model.available().map(toy => toy.platformId)).size).toBeGreaterThanOrEqual(3);
    let position = { ...world, x: 140, y: seat.y, platformId: seat.id, platforms: supports }, now = 2000;
    const picked: string[] = [], returned: string[] = [];
    for (let beat = 0; beat < 160 && model.count(); beat++) {
      const action = planner.next({ ...context(), world: position, now, toys: model.available(), existingIds: model.ids(), carriedId: model.carried(), count: model.count(), box: { x: 250, y: home.y, platformId: home.id } });
      if (!action) { now += 250; continue; }
      if (["walk", "jump"].includes(action.kind)) { position = { ...position, ...action.target, platformId: action.target.platformId! }; const id = model.carried(); if (id) model.carry(id, { x: position.x, y: position.y - 30 }); }
      if (action.toy.effect === "pick") { const id = action.toy.toyId!, ok = model.pick(id, position); expect(ok).toBe(true); picked.push(id); planner.resolve(action.toy, ok, now); }
      if (action.toy.effect === "stash") { const id = action.toy.toyId!; expect(model.carried()).toBe(id); const ok = model.stash(id); expect(ok).toBe(true); returned.push(id); planner.resolve(action.toy, ok, now); }
      now += action.duration;
    }
    expect(picked.sort()).toEqual([...ids].sort()); expect(returned.sort()).toEqual([...ids].sort()); expect(model.count()).toBe(0);
  });
  it("uses bounded learned preferences only when learning is ON while tidy still chooses actual proximity", () => {
    const disliked = { ...toy, kind: "ball" as const, x: 400 }, favorite = { ...toy, id: "favorite", kind: "feather" as const, x: 450 };
    const tastes = normalizeCompanionTastes({ version: 1, toys: ["ball", "feather"], toyTastes: { ball: { accepted: 0, declined: 3, score: -.8 }, feather: { accepted: 3, declined: 0, score: .8 } } });
    const input = { ...context("affectionate"), toys: [disliked, favorite], tastes };
    expect(createCompanionToyPlanner().next(input)?.target.x).toBe(450);
    expect(createCompanionToyPlanner().next({ ...input, preferences: { ...input.preferences, learnFromYou: false } })?.target.x).toBe(400);
    expect(createCompanionToyPlanner().next({ ...input, preferences: { ...input.preferences, personality: "tidy" } })?.target.x).toBe(400);
    const veryFar = { ...favorite, x: 950 };
    expect(createCompanionToyPlanner().next({ ...input, toys: [disliked, veryFar] })?.target.x).toBe(400);
  });
  it("releases the creature's carried A when the human takes B while preserving B's native hold", () => {
    const model = createCompanionToys(); model.sync([floor], { width: 1000, height: 700 }, 0);
    const a = model.spawn({ x: 300, y: 500 }, 0)!, b = model.spawn({ x: 700, y: 500 }, 0)!;
    for (let at = 16; at < 1800; at += 16) model.tick(at);
    expect(model.pick(a, model.available().find(toy => toy.id === a)!)).toBe(true);
    expect(model.grab(b)).toBe(true); model.releaseCarry(2000);
    expect(model.carried()).toBeUndefined(); expect(model.items().find(toy => toy.id === a)?.carried).toBe(false);
    expect(model.items().find(toy => toy.id === b)?.held).toBe(true);
  });
});

describe("122 eight-personality meaningful activity budget", () => {
  it("reuses a cue-selected expression for the same decision with one draw and no pre-adoption budget reset", () => {
    let draws = 0; const activity = createCompanionPersonalityActivity(() => { draws++; return .5; });
    const prefs = { ...DEFAULT_COMPANION_PREFERENCES, personality: "curious" as const }, owners = { scene: false, household: false, toy: false, home: false, blocked: false };
    const cue = activity.choose(brain, world, prefs, 600)!;
    const decision = preflightCompanionPersonalityActivity(activity, brain, world, prefs, 600, owners, cue);
    expect(decision).toBe(cue); expect(draws).toBe(1); expect(activity.due(600)).toBe(true);
    expect(preflightCompanionPersonalityActivity(activity, brain, world, prefs, 600, { ...owners, household: true }, cue)).toBeUndefined();
    expect(draws).toBe(1); expect(activity.due(600)).toBe(true);
    activity.record(decision!, world, 600, prefs.personality); expect(activity.due(600)).toBe(false);
  });
  it("reserves a due fitting expression before a new secondary job without claiming it before launch", () => {
    let draws = 0; const activity = createCompanionPersonalityActivity(() => { draws++; return 0; });
    const prefs = { ...DEFAULT_COMPANION_PREFERENCES, personality: "curious" as const }, empty = { scene: false, household: false, toy: false, home: false, blocked: false };
    const candidate = preflightCompanionPersonalityActivity(activity, brain, world, prefs, 600, empty)!;
    expect(candidate.personalitySignature).toBe("curious"); expect(draws).toBe(1); expect(activity.due(600)).toBe(true);
    for (const owner of ["scene", "household", "toy", "home", "blocked"]) expect(preflightCompanionPersonalityActivity(activity, brain, world, prefs, 600, { ...empty, [owner]: true })).toBeUndefined();
    expect(preflightCompanionPersonalityActivity(activity, { ...brain, foodGoal: { foodId: "real-meal", remaining: 3, retryAfter: 0 } }, world, prefs, 600, empty)).toBeUndefined();
    expect(draws).toBe(1); activity.record(candidate, world, 600, "curious"); expect(preflightCompanionPersonalityActivity(activity, brain, world, prefs, 1000, empty)).toBeUndefined();
  });
  for (const personality of COMPANION_PERSONALITIES) it(personality + " admits its due first expression before a new job while every actual owner remains protected", () => {
    let draws = 0; const activity = createCompanionPersonalityActivity(() => { draws++; return 0; });
    const prefs = { ...DEFAULT_COMPANION_PREFERENCES, personality }, owners = { scene: false, household: false, toy: false, home: false, blocked: false };
    for (const owner of ["scene", "household", "toy", "home", "blocked"] as const) expect(preflightCompanionPersonalityActivity(activity, brain, world, prefs, 600, { ...owners, [owner]: true })).toBeUndefined();
    expect(preflightCompanionPersonalityActivity(activity, { ...brain, foodGoal: { foodId: "actual-meal", remaining: 3, retryAfter: 0 } }, world, prefs, 600, owners)).toBeUndefined();
    expect(draws).toBe(0);
    const candidate = preflightCompanionPersonalityActivity(activity, brain, world, prefs, 600, owners)!;
    expect(candidate.personalitySignature).toBe(personality); expect(draws).toBe(1); expect(activity.due(600)).toBe(true);
  });
  for (const personality of COMPANION_PERSONALITIES) it(personality + " starts a finite authored signature and empty idle/look cannot postpone the next one", () => {
    const activity = createCompanionPersonalityActivity(() => 0), prefs = { ...DEFAULT_COMPANION_PREFERENCES, personality, sleep: false };
    const first = activity.choose(brain, world, prefs, 600)!;
    expect(first).toMatchObject({ kind: "play", personalitySignature: personality });
    expect(first.duration).toBeGreaterThan(0); expect(first.duration).toBeLessThan(6000);
    activity.record(first, world, 600);
    for (let now = 1000; now < 8600; now += 500) { activity.record({ ...idle, kind: now % 1000 ? "look" : "idle" }, world, now); expect(activity.choose(brain, world, prefs, now)).toBeUndefined(); }
    const second = activity.choose(brain, world, prefs, 8600)!;
    expect(second.kind).toBe("play"); expect(second.play).not.toBe(first.play);
  });
  it("preserves real care goals and refuses hidden/reduced/disabled or unsupported worlds", () => {
    const activity = createCompanionPersonalityActivity(() => 0), prefs = { ...DEFAULT_COMPANION_PREFERENCES };
    for (const patch of [{ paused: true }, { animated: false }, { platforms: [] }, { y: 300 }]) expect(activity.choose(brain, { ...world, ...patch }, prefs, 9000)).toBeUndefined();
    expect(activity.choose(brain, world, { ...prefs, roam: false }, 9000)).toBeUndefined();
    expect(activity.choose(brain, world, { ...prefs, enabled: false }, 9000)).toBeUndefined();
    expect(activity.choose({ ...brain, foodGoal: { foodId: "meal", remaining: 4, retryAfter: 0 } }, world, prefs, 9000)).toBeUndefined();
    activity.record({ kind: "walk", foodId: "actual-food", target: { x: 700, y: 600, platformId: floor.id }, duration: 9000 }, world, 9000);
    expect(activity.choose(brain, world, prefs, 16000)).toBeUndefined();
  });
  it("purpose-free random walks never reset the personality deadline and stale goals eventually release it", () => {
    const activity = createCompanionPersonalityActivity(() => 0), prefs = { ...DEFAULT_COMPANION_PREFERENCES, personality: "tidy" as const };
    for (let now = 0; now < 20000; now += 500) activity.record({ kind: "walk", target: { x: 700, y: 600, platformId: floor.id }, duration: 1000 }, world, now, "tidy");
    expect(activity.choose(brain, world, prefs, 20000)?.personalitySignature).toBe("tidy");
    const stuck = { ...brain, foodGoal: { foodId: "gone", remaining: 4, retryAfter: 0 } };
    expect(activity.choose(stuck, world, prefs, 20000)).toBeUndefined();
    expect(activity.choose(stuck, world, prefs, 29000)?.kind).toBe("play");
    expect(activity.choose({ ...stuck, foodGoal: { ...stuck.foodGoal, remaining: 0 } }, world, prefs, 30000)?.kind).toBe("play");
  });
  it("generic play and low-priority scene clips cannot postpone fitting personality activity forever", () => {
    const activity = createCompanionPersonalityActivity(() => 0), prefs = { ...DEFAULT_COMPANION_PREFERENCES, personality: "tidy" as const };
    for (let now = 0; now <= 15000; now += 1000) activity.record({ ...idle, kind: "play", play: "celebrate", ...(now % 2000 ? { scene: { id: 35 } } : {}) }, world, now, "tidy");
    expect(activity.choose(brain, world, prefs, 15000)?.personalitySignature).toBe("tidy");
    activity.record({ ...idle, kind: "play", play: "groom", personalitySignature: "tidy" }, world, 15000, "tidy");
    expect(activity.choose(brain, world, prefs, 22000)).toBeUndefined();
    activity.record({ ...idle, kind: "play", play: "bow", living: "social" }, world, 22000, "tidy");
    expect(activity.choose(brain, world, prefs, 29000)).toBeUndefined();
  });
  it("plans a shorter empty ground walk within the deadline but preserves actual owned travel", () => {
    const activity = createCompanionPersonalityActivity(() => 0), prefs = { ...DEFAULT_COMPANION_PREFERENCES, personality: "tidy" as const };
    activity.record(activity.choose(brain, world, prefs, 0)!, world, 0, "tidy");
    const offered = { kind: "walk" as const, target: { x: 900, y: 600, platformId: floor.id }, duration: 12000 };
    const bounded = activity.boundWander(offered, world, prefs, 2000);
    expect(bounded.duration).toBe(5700); expect(bounded.target.x).toBe(480); expect(bounded.target.platformId).toBe(floor.id);
    expect(activity.boundWander({ ...offered, foodId: "real-meal" }, world, prefs, 2000).duration).toBe(12000);
    expect(activity.boundWander({ ...offered, household: {} }, world, prefs, 2000).duration).toBe(12000);
  });
  it("jump OFF excludes pounce signatures for every personality and draw", () => {
    for (const personality of COMPANION_PERSONALITIES) for (const draw of [0, .4, .99]) {
      const action = createCompanionPersonalityActivity(() => draw).choose(brain, world, { ...DEFAULT_COMPANION_PREFERENCES, personality, jump: false }, 2000)!;
      expect(action.kind).toBe("play"); expect(action.play).not.toBe("pounce");
    }
  });
  it("an unreachable offered food cannot block personality forever while a proved meal still takes priority", () => {
    const upper = { ...floor, id: "upper", y: 480 }, hungry = { ...brain, hunger: .7, foodGoal: { foodId: "unreachable", remaining: 0, retryAfter: 99999 } };
    const food = { id: "unreachable", kind: "apple" as const, x: 400, y: 480, platformId: upper.id };
    const p = { ...DEFAULT_COMPANION_PREFERENCES, personality: "affectionate" as const, jump: false };
    const activity = createCompanionPersonalityActivity(() => 0), actual = { ...world, platforms: [floor, upper], foods: [food] };
    expect(activity.choose(hungry, actual, p, 1000)?.personalitySignature).toBe("affectionate");
    expect(activity.choose(hungry, actual, { ...p, jump: true }, 1250)).toBeUndefined();
    const sameFloor = { ...actual, foods: [{ ...food, y: 600, platformId: floor.id }] };
    expect(activity.choose(hungry, sameFloor, p, 1500)).toBeUndefined();
    const blockedEight = { ...actual, foods: Array.from({ length: 8 }, (_, index) => ({ ...food, id: "upper-" + index })) };
    const bounded = createCompanionPersonalityActivity(() => 0);
    expect(bounded.choose(hungry, blockedEight, p, 1000)).toBeUndefined();
    expect(bounded.choose(hungry, blockedEight, p, 1250)?.kind).toBe("play");
  });
  it("only a familiar nonfavorite refusal context creates a finite real food approach and expression", () => {
    const life = createCompanionLife(() => 0); life.favoriteFood = "apple"; life.familiarity.peach = .8;
    const full = { ...brain, curiosity: .2, life }, preferences = { ...DEFAULT_COMPANION_PREFERENCES };
    const tastes = normalizeCompanionTastes({ version: 1, foodTastes: { peach: { accepted: 5, declined: 0, score: .6 } } });
    const offered = { ...world, foods: [{ id: "familiar", kind: "peach" as const, x: 200, y: 600, platformId: floor.id }] };
    const activity = createCompanionPersonalityActivity(() => 0);
    const approach = activity.refuseFood(full, offered, preferences, tastes, ["peach"], 2000)!;
    expect(approach).toMatchObject({ kind: "walk", foodRefusal: { foodId: "familiar", kind: "peach" } }); expect(approach.foodId).toBeUndefined();
    const reaction = activity.refuseFood(full, { ...offered, x: 200 }, preferences, tastes, ["peach"], 4000)!;
    expect(reaction).toMatchObject({ kind: "play", play: "bonk-sad", foodRefusal: { foodId: "familiar" } });
    expect(activity.refuseFood(full, { ...offered, x: 200 }, preferences, tastes, ["peach"], 5000)).toBeUndefined();
    for (const patch of [{ brain: { ...full, hunger: .8 }, preferences, known: ["peach" as const] }, { brain: full, preferences: { ...preferences, learnFromYou: false }, known: ["peach" as const] }, { brain: full, preferences, known: [] }])
      expect(createCompanionPersonalityActivity().refuseFood(patch.brain, offered, patch.preferences, tastes, patch.known, 2000)).toBeUndefined();
    const before = getCompanionFoodPreference(life, "peach"), learned = experienceCompanionLife(life, { kind: "food-declined", food: "peach" });
    expect(getCompanionFoodPreference(learned, "peach")).toBeLessThan(before);
    expect(experienceCompanionLife(life, { kind: "food-declined", food: "peach" }, false)).toBe(life);
    expect(experienceCompanionLife(life, { kind: "food-declined", food: "apple" })).toBe(life);
    expect(learned.foodScores.peach).toBeGreaterThanOrEqual(.15);
  });
});
