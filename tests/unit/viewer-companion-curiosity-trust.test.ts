import { describe, expect, it } from "vitest";
import { createCompanionFoodCuriosity } from "@/lib/ui/viewer-companion/novel-food";
import { DEFAULT_COMPANION_PREFERENCES as prefs } from "@/lib/ui/viewer-companion/preferences";
import { createBrain, type CompanionAction, type CompanionFood } from "@/lib/ui/viewer-companion/brain";
import { DEFAULT_COMPANION_HABITS, learnCompanionHabits } from "@/lib/ui/viewer-companion/habits";
import { getLivingAction } from "@/lib/ui/viewer-companion/living";
import { companionSofaFlightMs, sampleCompanionSofaTravel } from "@/lib/ui/viewer-companion/sofa-travel";

const food: CompanionFood = { id: "one", kind: "apple", x: 150, y: 400, platformId: "date" };
const meal: CompanionAction = { kind: "eat", foodId: food.id, effectPoint: { x: 150, y: 400 }, target: { x: 145, y: 400, platformId: "date" }, duration: 2200 };
describe("unknown snack encounters and contextual trust", () => {
  it("inspects, tosses and teases a real unknown snack before eventually tasting the same food", () => {
    let draws = 0;
    const curiosity = createCompanionFoodCuriosity(() => [0, .1, .6][draws++ % 3]);
    const settings = { ...prefs, enabled: true };
    const steps = Array.from({ length: 8 }, () => curiosity.consider(meal, food, false, .6, settings));
    expect(steps.slice(0, 3).map(step => step.foodCuriosity)).toEqual(["inspect", "toss", "tease"]);
    expect(steps.slice(0, 6).every(step => step.kind !== "eat" && step.foodId === food.id)).toBe(true);
    expect(steps[6]).toBe(meal);
    expect(curiosity.consider(meal, food, true, .6, settings)).toBe(meal);
    expect(curiosity.consider({ ...meal, kind: "walk" }, food, false, .6, settings).kind).toBe("walk");
    expect(curiosity.consider(meal, undefined, false, .6, settings)).toBe(meal);
  });
  it("shortens suspicion when very hungry, while cats take more encounters than dogs", () => {
    const count = (animalMode: typeof prefs.animalMode, hunger: number) => {
      const curiosity = createCompanionFoodCuriosity(() => 0);
      return Array.from({ length: 10 }, () => curiosity.consider(meal, food, false, hunger, { ...prefs, animalMode })).filter(step => step.kind !== "eat").length;
    };
    expect(count("cat", .6)).toBeGreaterThan(count("dog", .6));
    expect(count("cat", .96)).toBe(2);
  });
  it("learns caution after rough input, respects disabled learning and cannot spend the same credit twice", () => {
    const learned = learnCompanionHabits({ ...DEFAULT_COMPANION_HABITS }, "rough-play");
    expect(learned.confidence).toBeLessThan(-.12);
    expect(learnCompanionHabits(learned, "rough-play")).toBe(learned);
    expect(learnCompanionHabits(learned, "reassured", false)).toBe(learned);
    const betrayed = learnCompanionHabits({ ...DEFAULT_COMPANION_HABITS }, "betrayed");
    expect(betrayed.confidence).toBeLessThan(learned.confidence);
    const reassured = learnCompanionHabits({ ...learned, credit: 1 }, "reassured");
    expect(reassured.confidence).toBeGreaterThan(learned.confidence);
  });
  it("steps away on its real safe span after rough handling, without fleeing a meal or overriding learning OFF", () => {
    const settings = { ...prefs, enabled: true, learnFromYou: true }, brain = { ...createBrain(0), activeMs: 50000, hunger: .1, habits: learnCompanionHabits({ ...DEFAULT_COMPANION_HABITS }, "rough-play") };
    const world = { x: 180, y: 400, width: 800, height: 600, platformId: "date", platforms: [{ id: "date", x: 20, y: 400, width: 500, kind: "date" as const }], pointer: { x: 230, y: 390, stableMs: 1000 }, animated: true };
    const action = getLivingAction(brain, world, settings, 50000)!;
    expect(action.kind).toBe("walk"); expect(action.target.x).toBeLessThan(world.x); expect(action.living).toBeUndefined();
    expect(getLivingAction({ ...brain, foodGoal: { foodId: "one", remaining: 4, retryAfter: 0 } }, world, settings, 50000)).toBeUndefined();
    expect(getLivingAction(brain, world, { ...settings, learnFromYou: false }, 50000)?.living).toBe("social");
  });
  it("times the measured sofa curve within the same peak-speed envelope, including a snug sidewall crossing", () => {
    const from = { x: 115.5, y: 420 }, to = { x: 400, y: 500 };
    const shape = sampleCompanionSofaTravel(from, to, .5, 353, { left: 52, right: 179, bodyHalfWidth: 92 * .38 + 3, ceiling: 100 });
    expect(shape.safe).toBe(true);
    const seconds = companionSofaFlightMs(from, to, shape) / 1000;
    expect(2 * Math.abs(to.x - from.x) / seconds).toBeLessThanOrEqual(330 + 1e-8);
    expect((Math.abs(to.y - from.y) + shape.coefficient) / seconds).toBeLessThanOrEqual(650 + 1e-8);
    expect(companionSofaFlightMs(from, to, { ...shape, coefficient: shape.coefficient * 1.5 })).toBeGreaterThanOrEqual(seconds * 1000);
  });
});
