//157 shared-floor regressions. Pure hosts acknowledge explicit endpoints;
// these are not rendered landing, ownership or daily-adoption evidence.
import { describe, expect, it, vi } from "vitest";
import { createBrain, type CompanionAction, type CompanionBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityActivity, preflightCompanionPersonalityActivity } from "@/lib/ui/viewer-companion/personality-activity";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES, type CompanionPersonality } from "@/lib/ui/viewer-companion/preferences";
import { findCompanionToyRoute } from "@/lib/ui/viewer-companion/toys";

const ids = ["companion-home-floor", "companion-home-floor-1", "companion-home-floor-2", "companion-home-floor-42"];
const p = (personality: CompanionPersonality = "balanced") => ({ ...DEFAULT_COMPANION_PREFERENCES, personality, enabled: true, roam: true, jump: false, sleep: false, feeding: false, petting: false, learnFromYou: false });
const plane = (id = "companion-home-floor-1", changes: Partial<Platform> = {}): Platform => ({ id, kind: "floor", manualOnly: true, x: 40, y: 600, width: 520, ...changes });
function host(id = "companion-home-floor-1", changes: Partial<Platform> = {}) {
  const support = plane(id, changes), world: CompanionWorld = { x: 160, y: 600, platformId: id, platforms: [support], width: 1200, height: 850, animated: true, foods: [] };
  const brain: CompanionBrain = { ...createBrain(0, () => .5), hunger: .05, energy: .95, activeMs: 10000, heading: 1, visited: [id] };
  return { support, world, brain, activity: createCompanionPersonalityActivity(() => .5) };
}
function walk(id: string, x: number): CompanionAction { return { kind: "walk", target: { x, y: 600, platformId: id }, duration: 1200, direction: 1 }; }

describe("156 actual fallback admits every measured ordinary room-floor segment", () => {
  it.each(COMPANION_PERSONALITIES.flatMap(personality => ids.map(id => ({ personality, id }))))("$personality can walk on $id with jumping/petting OFF", ({ personality, id }) => {
    const h = host(id), preferences = p(personality), action = h.activity.choose(h.brain, h.world, preferences, 10000);
    expect(action).toMatchObject({ kind: "walk", personalitySignature: personality, target: { platformId: id, y: h.support.y } });
    expect(action!.play).toBeUndefined(); expect(action!.target.x - h.world.x).toBeGreaterThanOrEqual(48);
    expect(action!.target.x).toBeGreaterThanOrEqual(h.support.x + 12); expect(action!.target.x).toBeLessThanOrEqual(h.support.x + h.support.width - 12);
    expect(findCompanionToyRoute(h.world, action!.target, h.world.platforms, false)?.[0]?.target).toEqual(action!.target);
    expect(action!.duration).toBeGreaterThan(0); expect(Number.isFinite(action!.duration)).toBe(true);
  });

  it.each(ids)("records a real completed same-span walk on %s", id => {
    const h = host(id), from = { x: h.world.x, y: h.world.y, platformId: id }, action = walk(id, 260);
    // Before the endpoint is reached there is still no arrival or memory.
    expect(h.activity.recordArrival(action, from, h.world, p(), 11000)).toBe(false);
    Object.assign(h.world, action.target);
    expect(h.activity.recordArrival(action, from, h.world, p(), 12000)).toBe(true);
  });

  it.each(ids)("uses actual %s arrivals to choose C instead of the same B-to-A reverse", id => {
    const h = host(id), preferences = p(), from = { ...h.world }, first = walk(id, 260);
    h.activity.record(first, h.world, 10000, preferences.personality); Object.assign(h.world, first.target);
    expect(h.activity.recordArrival(first, from, h.world, preferences, 11200)).toBe(true);
    h.brain.heading = -1; const reverse = walk(id, 160), draw = vi.fn(() => h.activity.choose(h.brain, h.world, preferences, 20000, { deadline: 20000, nextDuration: 1 }));
    const selected = h.activity.diversifyTravel(reverse, h.brain, h.world, preferences, 20000, draw);
    expect(draw).toHaveBeenCalledOnce(); expect(selected.kind).toBe("walk"); expect(selected.target.platformId).toBe(id);
    expect(selected.target.x).toBeGreaterThanOrEqual(h.world.x + 48);
    expect(findCompanionToyRoute(h.world, selected.target, h.world.platforms, false)?.[0]?.target).toEqual(selected.target);
  });

  it("a proposal/launch on a numbered span cannot forge an arrived reverse-memory", () => {
    const h = host(), preferences = p(), from = { ...h.world }, first = walk(h.support.id, 260);
    h.activity.record(first, h.world, 10000, preferences.personality);
    expect(h.activity.recordArrival(first, from, h.world, preferences, 11200)).toBe(false);
    Object.assign(h.world, first.target); const reverse = walk(h.support.id, 160), draw = vi.fn(() => undefined);
    expect(h.activity.diversifyTravel(reverse, h.brain, h.world, preferences, 12000, draw)).toBe(reverse); expect(draw).not.toHaveBeenCalled();
  });

  it("expires actual numbered-span reverse memory after20active seconds", () => {
    const h = host(), preferences = p(), from = { ...h.world }, first = walk(h.support.id, 260);
    Object.assign(h.world, first.target); expect(h.activity.recordArrival(first, from, h.world, preferences, 11200)).toBe(true);
    const reverse = walk(h.support.id, 160), draw = vi.fn(() => undefined);
    expect(h.activity.diversifyTravel(reverse, h.brain, h.world, preferences, 31200, draw)).toBe(reverse); expect(draw).not.toHaveBeenCalled();
  });

  it("can route to a numbered floor destination without broadening arbitrary manual supports", () => {
    const h = host("companion-home-floor", { x: 40, width: 240 }); h.world.x = 268;
    const next = plane("companion-home-floor-1", { x: 320, width: 260 }); h.world.platforms = [h.support, next];
    const action = h.activity.choose(h.brain, h.world, { ...p(), jump: true }, 10000)!;
    expect(action).toMatchObject({ kind: "jump", target: { platformId: next.id, y: next.y } });
    expect(findCompanionToyRoute(h.world, action.target, h.world.platforms, true)?.[0]?.target).toEqual(action.target);
  });

  it.each(COMPANION_PERSONALITIES)("%s does not lose a visited numbered escape behind eight unreachable calendar goals", personality => {
    const h = host("companion-home-floor-2", { x: 100, width: 320 });
    const sofa: Platform = { id: "companion-home", kind: "date", x: 200, y: 550, width: 12 };
    const far: Platform[] = Array.from({ length: 12 }, (_, n) => ({ id: `distant-${n}`, kind: "date", x: 900 + n * 140, y: 600, width: 20 }));
    Object.assign(h.world, { x: 206, y: sofa.y, platformId: sofa.id, platforms: [sofa, ...far, h.support] });
    h.brain.visited = [h.support.id, sofa.id];
    const action = h.activity.choose(h.brain, h.world, { ...p(personality), jump: true }, 10000)!;
    expect(action).toMatchObject({ kind: "jump", target: { platformId: h.support.id } });
    expect(findCompanionToyRoute(h.world, action.target, h.world.platforms, true)?.[0]?.target).toEqual(action.target);
  });
});

describe("156 safe room-floor admission never opens manual controls or body stances", () => {
  const invalid: { name: string; id: string; change: Partial<Platform> }[] = [
    { name: "arbitrary manual floor", id: "manual-shelf", change: {} },
    { name: "food-only floor", id: "companion-home-floor-food-1", change: {} },
    { name: "nonnumeric suffix", id: "companion-home-floor-bad", change: {} },
    { name: "manual date top", id: "companion-home-floor-1", change: { kind: "date" } },
    { name: "control", id: "companion-home-floor-1", change: { kind: "control" } },
    { name: "hide", id: "companion-home-floor-1", change: { kind: "hide" } },
    { name: "body-only ordinary spelling", id: "companion-home-floor-1", change: { bodyOnly: true } },
    { name: "actual pad400", id: "companion-home-floor-400", change: { bodyOnly: true, width: 2 } },
    { name: "reserved pad400 even with missing body flag", id: "companion-home-floor-400", change: {} },
    { name: "nonfinite origin", id: "companion-home-floor-1", change: { x: NaN } },
    { name: "nonfinite height", id: "companion-home-floor-1", change: { y: Infinity } },
    { name: "nonfinite width", id: "companion-home-floor-1", change: { width: Infinity } },
    { name: "empty span", id: "companion-home-floor-1", change: { width: 0 } },
  ];
  it.each(invalid)("does not manufacture fallback or arrival on $name", ({ id, change }) => {
    const h = host(id, change), action = walk(id, 260), from = { x: 160, y: 600, platformId: id };
    expect(h.activity.choose(h.brain, h.world, p(), 10000)).toBeUndefined();
    Object.assign(h.world, action.target); expect(h.activity.recordArrival(action, from, h.world, p(), 11200)).toBe(false);
  });
  it.each(invalid.filter(x => Number.isFinite(x.change.x ?? 0) && Number.isFinite(x.change.y ?? 0) && Number.isFinite(x.change.width ?? 1) && (x.change.width ?? 1) > 2))("never targets $name from the ordinary main floor", ({ id, change }) => {
      const h = host("companion-home-floor"); const trap = plane(id, { x: 320, width: 260, ...change });
      h.world.platforms = [h.support, trap];
      const action = h.activity.choose(h.brain, h.world, { ...p(), jump: true }, 10000)!;
      expect(action).toBeDefined(); expect(action.target.platformId).toBe(h.support.id);
    });
  it.each(["enabled", "roam", "animated", "paused"] as const)("respects %sOFF/paused on a numbered floor", flag => {
    const h = host(), preferences = p();
    if (flag === "enabled") preferences.enabled = false; if (flag === "roam") preferences.roam = false;
    if (flag === "animated") h.world.animated = false; if (flag === "paused") h.world.paused = true;
    expect(h.activity.choose(h.brain, h.world, preferences, 10000)).toBeUndefined();
    const from = { ...h.world }, action = walk(h.support.id, 260); Object.assign(h.world, action.target);
    expect(h.activity.recordArrival(action, from, h.world, preferences, 11200)).toBe(false);
  });
  it("jumpOFF still prevents a false jump-arrival acknowledgement", () => {
    const h = host(), from = { ...h.world }, action: CompanionAction = { ...walk(h.support.id, 260), kind: "jump" };
    Object.assign(h.world, action.target); expect(h.activity.recordArrival(action, from, h.world, p(), 11200)).toBe(false);
  });
  it.each(["not-at-endpoint", "off-floor", "zero-distance", "old-time", "nonfinite-time", "missing-support"] as const)("rejects %s without manufacturing numbered-floor arrival memory", defect => {
    const h = host(), from = { x: h.world.x, y: h.world.y, platformId: h.support.id }, action = walk(h.support.id, 260);
    Object.assign(h.world, action.target); let at = 11200;
    if (defect === "not-at-endpoint") h.world.x += 8; if (defect === "off-floor") h.world.y += 8;
    if (defect === "zero-distance") from.x = h.world.x; if (defect === "missing-support") h.world.platforms = [];
    if (defect === "nonfinite-time") at = NaN;
    if (defect === "old-time") { expect(h.activity.recordArrival(action, from, h.world, p(), at)).toBe(true); at--; }
    expect(h.activity.recordArrival(action, from, h.world, p(), at)).toBe(false);
  });
  it("a reachable same-ID meal still owns the creature before room-floor fallback", () => {
    const h = host(), preferences = { ...p(), feeding: true }; h.brain.hunger = .75;
    h.world.foods = [{ id: "exact-meal", kind: "apple", x: 260, y: 600, platformId: h.support.id }];
    expect(h.activity.choose(h.brain, h.world, preferences, 10000)).toBeUndefined();
    expect(h.world.foods).toHaveLength(1); expect(h.world.foods[0].id).toBe("exact-meal");
  });
  it.each(["scene", "household", "toy", "home", "blocked"] as const)("preflight preserves an actual %s owner on a numbered floor", owner => {
    const h = host(), choose = vi.fn(() => h.activity.choose(h.brain, h.world, p(), 10000));
    const owners = { scene: false, household: false, toy: false, home: false, blocked: false, [owner]: true };
    expect(preflightCompanionPersonalityActivity({ due: () => true, choose }, h.brain, h.world, p(), 10000, owners)).toBeUndefined(); expect(choose).not.toHaveBeenCalled();
  });
  it.each(["food-goal", "episode", "rest-intent"] as const)("preflight preserves %s before an ordinary numbered-floor choice", owner => {
    const h = host();
    if (owner === "food-goal") h.brain.foodGoal = { foodId: "same-food", remaining: 5, retryAfter: 0 };
    if (owner === "episode") h.brain.episode = { kind: "wake", phase: "start", remaining: 1, variant: "careful", mishapUsed: true, legs: 0 };
    if (owner === "rest-intent") h.brain.intention = { kind: "rest", targetId: h.support.id, offset: .5, remaining: 5, stage: "travel" };
    const choose = vi.fn(() => h.activity.choose(h.brain, h.world, p(), 10000));
    expect(preflightCompanionPersonalityActivity({ due: () => true, choose }, h.brain, h.world, p(), 10000, { scene: false, household: false, toy: false, home: false, blocked: false })).toBeUndefined();
    expect(choose).not.toHaveBeenCalled();
  });
  it.each(["food", "authored", "toy", "household", "social", "rest", "owned"] as const)("does not diversify %s work merely because it crosses a numbered floor", owner => {
    const h = host(), preferences = p(), from = { ...h.world }, first = walk(h.support.id, 260);
    Object.assign(h.world, first.target); expect(h.activity.recordArrival(first, from, h.world, preferences, 11200)).toBe(true);
    const raw: CompanionAction & { personalityScene?: unknown; toy?: unknown; household?: unknown } = walk(h.support.id, 160);
    if (owner === "food") raw.foodId = "same-owned-meal"; if (owner === "authored") raw.personalityScene = { id: "same-owned-scene" };
    if (owner === "toy") raw.toy = { toyId: "same-owned-toy" }; if (owner === "household") raw.household = { foodId: "same-real-leftover" };
    if (owner === "social") raw.attention = { kind: "social", point: { x: 160, y: 600 } };
    if (owner === "rest") raw.intention = { kind: "rest", targetId: h.support.id, offset: .5, remaining: 4, stage: "travel" };
    const choose = vi.fn(() => undefined); expect(h.activity.diversifyTravel(raw, h.brain, h.world, preferences, 12000, choose, owner === "owned")).toBe(raw); expect(choose).not.toHaveBeenCalled();
  });
});
