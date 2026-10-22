import { describe, expect, it } from "vitest";
import { commitAction, createBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector } from "@/lib/ui/viewer-companion/personality-director";
import { createCompanionPersonalityJobs, getCompanionPersonalityMeal } from "@/lib/ui/viewer-companion/personality-jobs";
import { createCompanionHousehold } from "@/lib/ui/viewer-companion/household";
import { createCompanionToyPlanner } from "@/lib/ui/viewer-companion/toys";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

const floor: Platform = { id: "actual-floor", x: 0, y: 600, width: 1000, kind: "floor" };
const preferences = { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: true };
function fixture() {
  const world: CompanionWorld = { x: 200, y: 600, platformId: floor.id, platforms: [floor], width: 1000, height: 720, animated: true,
    foods: [{ id: "meal-a", kind: "apple", x: 200, y: 600, platformId: floor.id }, { id: "meal-b", kind: "bread", x: 500, y: 600, platformId: floor.id }] };
  // An actual earlier eat committed on the renderer clock, after which the
  // visible-active clock can lag (e.g. a long pause). No DOM/movement proof.
  const brain = commitAction({ ...createBrain(0), activeMs: 190000, hunger: .6 },
    { kind: "eat", target: world, foodId: "meal-a", duration: 2200 }, 600000);
  return { world, brain, preferences, now: brain.activeMs };
}

describe("dense meals keep action cooldowns on the renderer clock", () => {
  it("eats a reached meal after cooldown rather than repeatedly switching to a distant food", () => {
    const input = fixture(), director = createCompanionPersonalityDirector([]), before = JSON.stringify(input);
    const meal = getCompanionPersonalityMeal(director, undefined, input, 780000);
    expect(meal).toMatchObject({ kind: "eat", foodId: "meal-a" });
    expect(JSON.stringify(input)).toBe(before);
  });
  it("keeps the real future cooldown even when active time is ahead", () => {
    const input = fixture(); input.brain.activeMs = input.now = 900000;
    const meal = getCompanionPersonalityMeal(createCompanionPersonalityDirector([]), undefined, input, 600100);
    expect(meal?.kind).not.toBe("eat");
  });
  it("uses the same clock for an authored bound-food eat without changing the scene clock", () => {
    const input = fixture(), director = createCompanionPersonalityDirector([]);
    const jobs = createCompanionPersonalityJobs(director, createCompanionHousehold(), createCompanionToyPlanner());
    const action = jobs.next({ meta: { id: "actual-meal", serial: 1, beat: 0, itemId: "meal-a", command: { kind: "food", mode: "eat" } }, delegate: { kind: "food", mode: "eat" } },
      { ...input, home: {}, toys: [], toyCount: 0, foodCount: 2 }, 780000);
    expect(action).toMatchObject({ kind: "eat", foodId: "meal-a" });
    expect(input.brain.activeMs).toBe(190000);
  });
  it("still honors active-time retry exhaustion and real object ownership", () => {
    const input = fixture(); input.world.foods = input.world.foods!.slice(0, 1);
    input.brain.foodGoal = { foodId: "meal-a", remaining: 0, retryAfter: input.brain.activeMs + 10000 };
    const director = createCompanionPersonalityDirector([]);
    expect(getCompanionPersonalityMeal(director, undefined, input, 780000)).toBeUndefined();
    input.brain.foodGoal = undefined;
    expect(getCompanionPersonalityMeal(director, undefined, { ...input, carriedToy: "actual-toy" }, 780000)).toBeUndefined();
    expect(getCompanionPersonalityMeal(director, undefined, { ...input, ownedJob: true }, 780000)).toBeUndefined();
    expect(getCompanionPersonalityMeal(director, undefined, { ...input, preferences: { ...preferences, feeding: false } }, 780000)).toBeUndefined();
  });
});
