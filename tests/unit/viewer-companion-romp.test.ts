import { describe, expect, it } from "vitest";
import { companionRunTripContact, planCompanionRomp, sampleCompanionRunUp, validCompanionRunHop } from "@/lib/ui/viewer-companion/romp";
import { DEFAULT_COMPANION_PREFERENCES as prefs } from "@/lib/ui/viewer-companion/preferences";
import { commitAction, createBrain, type CompanionAction, type Platform } from "@/lib/ui/viewer-companion/brain";

const floor: Platform = { id: "floor", kind: "floor", x: 40, y: 800, width: 1000 };
const action: CompanionAction = { kind: "walk", pace: "scoot", target: { x: 550, y: 800, platformId: floor.id }, duration: 2400, direction: 1 };
const input = { action, from: { x: 250, y: 800 }, platform: floor, foods: [], energy: .9, cooldownReady: true };
const snack = { id: "fruit", kind: "apple" as const, x: 430, y: 800, platformId: "floor-food" };
const sequence = (...values: number[]) => { let i = 0; return () => values[i++] ?? .9; };

describe("one bounded romp on an actual run", () => {
  it("trips at the first actual settled snack on the same physical plane, without modifying it", () => {
    const foods = [{ ...snack, id: "later", x: 500 }, snack], before = JSON.stringify(foods);
    const plan = planCompanionRomp({ ...input, foods }, prefs, () => .5);
    expect(plan.trip).toEqual({ x: 420, play: "tumble", cause: "food", foodId: "fruit" });
    expect(JSON.stringify(foods)).toBe(before); expect(plan.hop).toBeUndefined();
    expect(companionRunTripContact(plan.trip!, input.from, action.target, floor, foods)).toBe(420);
    expect(companionRunTripContact(plan.trip!, input.from, action.target, floor, [])).toBeNull();
    expect(companionRunTripContact(plan.trip!, input.from, action.target, floor, [{ ...snack, x: 900 }])).toBeNull();
    expect(companionRunTripContact(plan.trip!, input.from, action.target, floor, [{ ...snack, y: 600 }])).toBeNull();
  });
  it("never calls a remote, above, behind or out-of-path snack a collision", () => {
    for (const food of [{ ...snack, x: 200 }, { ...snack, x: 700 }, { ...snack, y: 700 }, { ...snack, x: NaN }]) {
      expect(planCompanionRomp({ ...input, foods: [food] }, prefs, () => .5).trip).toBeUndefined();
    }
  });
  it("accepts a nearby real approach and autonomous exploration without interrupting feed/rest", () => {
    const explore = { kind: "explore" as const, targetId: "other-ledge", offset: .5, remaining: 8, stage: "travel" as const };
    const observed = { ...input, from: { x: 909.313, y: 800 }, action: { ...action, target: { ...action.target, x: 1041.476 }, intention: explore }, platform: { ...floor, width: 1400 }, foods: [{ ...snack, x: 950 }] };
    expect(planCompanionRomp(observed, prefs, () => .5).trip).toMatchObject({ x: 940, cause: "food", play: "tumble" });
    for (const kind of ["feed", "rest"] as const) expect(planCompanionRomp({ ...observed, action: { ...observed.action, intention: { ...explore, kind } } }, prefs, () => 0)).toEqual({});
    expect(observed.action.intention).toEqual(explore);
  });
  it("uses a single per-run stumble draw, independent from idle repetitions", () => {
    let draws = 0;
    const plan = planCompanionRomp(input, prefs, () => { draws++; return 0; });
    expect(plan.trip).toMatchObject({ x: 355, cause: "stumble", play: "tumble" }); expect(draws).toBe(2);
    expect(planCompanionRomp({ ...input, action: { ...action, kind: "idle" } }, prefs, () => 0)).toEqual({});
    expect(planCompanionRomp({ ...input, cooldownReady: false }, { ...prefs, jump: false }, () => 0)).toEqual({});
  });
  it("uses a small bump near an edge or when jumping is disabled", () => {
    const edge: Platform = { ...floor, x: 0, width: 64 };
    const edgeInput = { ...input, from: { x: 8, y: 800 }, platform: edge, action: { ...action, target: { x: 56, y: 800, platformId: edge.id } } };
    expect(planCompanionRomp(edgeInput, prefs, () => 0).trip?.play).toBe("bump");
    expect(planCompanionRomp(input, { ...prefs, jump: false }, () => 0).trip?.play).toBe("bump");
  });
  it("retains species differences at a real snack encounter", () => {
    expect(planCompanionRomp({ ...input, foods: [snack] }, prefs, () => .5).trip?.cause).toBe("food");
    for (const animalMode of ["dog", "cat"] as const) expect(planCompanionRomp({ ...input, foods: [snack] }, { ...prefs, animalMode }, () => .5).trip).toBeUndefined();
  });
  it("proves a higher, longer same-support run-up with the actual impulse", () => {
    const hop = planCompanionRomp({ ...input, cooldownReady: false }, prefs, sequence(0, .8)).hop!;
    expect(hop).toMatchObject({ kind: "jump", runUp: 125, target: { platformId: floor.id, y: 800 } });
    expect(hop.jumpHeight).toBeGreaterThan(60); expect(hop.target.x - action.target.x).toBeGreaterThan(80);
    expect(validCompanionRunHop(hop, action.target, floor)).toBe(true);
    const flight = 2 * Math.sqrt(2 * 1100 * hop.jumpHeight!) / 1100;
    expect((hop.target.x - action.target.x) / flight).toBeCloseTo(hop.runUp!, 7);
    expect(validCompanionRunHop(hop, action.target, { ...floor, width: 500 })).toBe(false);
    expect(validCompanionRunHop({ ...hop, target: { ...hop.target, x: 1000 } }, action.target, floor)).toBe(false);
  });
  it("keeps a same-span hop inside its retained final goal and spends both finite action slots", () => {
    const intention = { kind: "explore" as const, targetId: floor.id, offset: .86, remaining: 8, stage: "travel" as const };
    const chosen = { ...action, target: { ...action.target, x: 900 }, duration: 5200, intention }, before = JSON.stringify(chosen);
    const plan = planCompanionRomp({ ...input, action: chosen, cooldownReady: false }, prefs, sequence(0, .8));
    expect(plan.walk).toBeDefined(); expect(plan.hop).toBeDefined();
    expect(plan.walk!.intention).toEqual(intention); expect(plan.walk!.target.x).toBeGreaterThan(input.from.x + 48);
    expect(plan.walk!.target.x).toBeLessThan(plan.hop!.target.x); expect(plan.hop!.target.x).toBeCloseTo(836);
    expect(plan.hop!.intention).toEqual({ ...intention, remaining: 7 });
    expect(plan.hop!.runUp).toBeCloseTo((plan.walk!.target.x - input.from.x) / plan.walk!.duration * 1000);
    expect(validCompanionRunHop(plan.hop!, plan.walk!.target, floor)).toBe(true);
    const walked = commitAction(createBrain(), plan.walk!, 100000), landed = commitAction(walked, plan.hop!, 100000 + plan.walk!.duration);
    expect(walked.intention?.remaining).toBe(7); expect(landed.intention?.remaining).toBe(6); expect(landed.intention?.targetId).toBe(floor.id);
    expect(JSON.stringify(chosen)).toBe(before);
    for (const patch of [{ remaining: 1 }, { offset: NaN }]) expect(planCompanionRomp({ ...input, action: { ...chosen, intention: { ...intention, ...patch } }, cooldownReady: false }, prefs, sequence(0, .8))).toEqual({});
    const short = { ...chosen, target: { ...chosen.target, x: 310 }, duration: 480, intention: { ...intention, offset: .27 } };
    expect(planCompanionRomp({ ...input, action: short, cooldownReady: false }, prefs, sequence(0, .8))).toEqual({});
  });
  it("carries a different-platform expedition through a proved intermediate hop without renewing its budget", () => {
    const intention = { kind: "explore" as const, targetId: "next-ledge", offset: .6, remaining: 6, stage: "travel" as const };
    const plan = planCompanionRomp({ ...input, action: { ...action, intention }, cooldownReady: false }, prefs, sequence(0, .8));
    expect(plan.walk).toBeUndefined(); expect(plan.hop?.intention).toEqual({ ...intention, remaining: 5 });
    expect(validCompanionRunHop(plan.hop!, action.target, floor)).toBe(true);
  });
  it("does not invent a run-up at the edge or exceed ballistic bounds", () => {
    const edgeAction = { ...action, target: { ...action.target, x: 1020 } };
    expect(planCompanionRomp({ ...input, action: edgeAction, cooldownReady: false }, prefs, () => 0).hop).toBeUndefined();
    for (const bad of [{ runUp: Infinity }, { runUp: 999 }, { jumpHeight: 500 }]) {
      const hop = planCompanionRomp({ ...input, cooldownReady: false }, prefs, () => 0).hop!;
      expect(validCompanionRunHop({ ...hop, ...bad }, action.target, floor)).toBe(false);
    }
  });
  it("rejects a still-long but clamped landing that would abruptly lose run-up speed", () => {
    const edgeAction = { ...action, target: { ...action.target, x: 970 }, duration: 5760 };
    expect(planCompanionRomp({ ...input, action: edgeAction, cooldownReady: false }, prefs, sequence(0, .8)).hop).toBeUndefined();
  });
  it("yields to explicit work, feeding, home, quiet controls and unsafe coordinates", () => {
    for (const patch of [{ action: { ...action, foodId: "fruit" } }, { action: { ...action, intention: { kind: "feed" as const, targetId: floor.id, offset: .5, remaining: 5, stage: "travel" as const } } }, { action: { ...action, pace: "amble" as const } }, { energy: .1 }, { platform: { ...floor, manualOnly: true } }, { platform: { ...floor, id: "companion-home", kind: "date" as const } }, { platform: { ...floor, kind: "control" as const } }, { from: { x: NaN, y: 800 } }]) expect(planCompanionRomp({ ...input, ...patch }, prefs, () => 0)).toEqual({});
    for (const patch of [{ enabled: false }, { roam: false }]) expect(planCompanionRomp(input, { ...prefs, ...patch }, () => 0)).toEqual({});
  });
  it("keeps takeoff speed nonzero while remaining monotone and exactly bounded", () => {
    let previous = 0;
    for (let i = 0; i <= 1000; i++) { const sample = sampleCompanionRunUp(i / 1000); expect(sample).toBeGreaterThanOrEqual(previous); expect(sample).toBeLessThanOrEqual(1); previous = sample; }
    expect(sampleCompanionRunUp(0)).toBe(0); expect(sampleCompanionRunUp(1)).toBe(1);
    expect((sampleCompanionRunUp(1) - sampleCompanionRunUp(.999)) / .001).toBeCloseTo(1, 2);
    expect(sampleCompanionRunUp(.001) / .001).toBeLessThan(.01);
  });
});
