import { describe, expect, it } from "vitest";
import { advanceBrain, commitAction, createBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { createCompanionToys, createCompanionToyPlanner } from "@/lib/ui/viewer-companion/toys";

const floor: Platform = { id: "companion-home-floor", x: 0, y: 600, width: 450, kind: "floor", manualOnly: true };
const box = { x: 340, y: 600, platformId: floor.id };
function fixture() {
  const model = createCompanionToys(() => 0), planner = createCompanionToyPlanner();
  model.sync([floor], { width: 1000, height: 800 }, 0);
  const id = model.spawn({ x: 215.828, y: 500, platformId: floor.id }, 0)!;
  for (let now = 16; now <= 3000; now += 16) model.tick(now);
  const toy = model.available()[0];
  const preferences = { ...DEFAULT_COMPANION_PREFERENCES, personality: "tidy" as const, feeding: false };
  let world: CompanionWorld = { ...toy, platforms: [floor], width: 1000, height: 800, animated: true };
  let brain = { ...createBrain(0, () => .5), energy: .2502, hunger: .05 };
  let now = 4000;
  const input = () => ({ world, brain, preferences, now, toys: model.available(), existingIds: model.ids(), carriedId: model.carried(), count: model.count(), box,
    intent: { mode: "return" as const, targetId: id } });
  const pick = planner.next(input())!;
  expect(pick.toy?.effect).toBe("pick");
  expect(model.pick(id, world)).toBe(true); planner.resolve(pick.toy!, true, now+pick.duration);
  brain = advanceBrain(commitAction(brain, pick, now), pick.duration, false, preferences); now += pick.duration;
  expect(brain.energy).toBeLessThan(.25); expect(brain.energy).toBeGreaterThan(.18);
  return { model, planner, id, input, advance(action: NonNullable<ReturnType<typeof planner.next>>) {
    brain = advanceBrain(commitAction(brain, action, now), action.duration, false, preferences); now += action.duration; world = { ...world, ...action.target };
  } };
}

describe("same physical owned return survives the admission-energy boundary", () => {
  it("finishes its existing same-ID delivery after natural600ms fatigue crosses.25", () => {
    const h = fixture();
    const walk = h.planner.next(h.input())!;
    expect(walk.kind).toBe("walk"); expect(walk.target).toEqual(box); h.advance(walk);
    const stash = h.planner.next(h.input())!;
    expect(stash.toy).toMatchObject({ kind: "tidy", effect: "stash", toyId: h.id });
    expect(h.model.stash(h.id)).toBe(true); h.planner.resolve(stash.toy!, true, h.input().now+stash.duration);
    expect(h.model.count()).toBe(0);
    expect(h.planner.next(h.input())).toBeUndefined(); // No new pickup at low energy.
  });

  it.each(["OFF", "roamOFF", "pause", "exhausted", "wrong-owner", "removed", "hungry", "deadline"])("does not preserve the return through %s", condition => {
    const h = fixture(), input = h.input();
    if (condition === "OFF") input.preferences = { ...input.preferences, enabled: false };
    if (condition === "roamOFF") input.preferences = { ...input.preferences, roam: false };
    if (condition === "pause") input.world = { ...input.world, paused: true };
    if (condition === "exhausted") input.brain = { ...input.brain, energy: .18 };
    if (condition === "wrong-owner") input.carriedId = "different-real-toy";
    if (condition === "removed") input.existingIds = [];
    if (condition === "hungry") input.brain = { ...input.brain, hunger: .8 };
    if (condition === "deadline") input.now += 61000;
    expect(h.planner.next(input)).toBeUndefined(); expect(h.planner.active()).toBe(false);
  });

  it("keeps low energy from admitting another toy or play even if a caller reports a carried object", () => {
    const h = fixture(), input = h.input();
    for (const personality of ["tidy", "curious", "mischievous"] as const)
      expect(createCompanionToyPlanner().next({ ...input, preferences: { ...input.preferences, personality } })).toBeUndefined();
    h.planner.cancel(input.now); expect(h.planner.next(input)).toBeUndefined();
  });
});
