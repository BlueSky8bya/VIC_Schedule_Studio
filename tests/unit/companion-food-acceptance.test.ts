import { describe, expect, it, vi } from "vitest";
import { COMPANION_FOOD_KINDS, type CompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_FOOD_FAMILIES, COMPANION_FOOD_FAMILY, companionConsumedFoodExperience } from "@/lib/ui/viewer-companion/food-family";
import { companionFoodAcceptance, createCompanionFoodCuriosity } from "@/lib/ui/viewer-companion/novel-food";
import { DEFAULT_COMPANION_PREFERENCES as prefs } from "@/lib/ui/viewer-companion/preferences";
import { createBrain, getFoodAction, type CompanionAction, type CompanionFood, type CompanionWorld } from "@/lib/ui/viewer-companion/brain";

const food: CompanionFood = Object.freeze({ id: "bread-one", kind: "bagel", x: 150, y: 400, platformId: "card" });
const meal: CompanionAction = Object.freeze({ kind: "eat", foodId: food.id, effectPoint: { x: 150, y: 400 }, target: { x: 145, y: 400, platformId: "card" }, duration: 2200 });

describe("actual consumed food family acceptance", () => {
  it("assigns every one of252 snacks to exactly one explicit culinary family", () => {
    const assigned = Object.values(COMPANION_FOOD_FAMILIES).flat();
    expect(assigned).toHaveLength(252); expect(new Set(assigned).size).toBe(252);
    expect([...assigned].sort()).toEqual([...COMPANION_FOOD_KINDS].sort());
    for (const [family, members] of Object.entries(COMPANION_FOOD_FAMILIES)) for (const kind of members) expect(COMPANION_FOOD_FAMILY[kind]).toBe(family);
    expect(COMPANION_FOOD_FAMILY.bread).toBe(COMPANION_FOOD_FAMILY.croissant);
    expect(COMPANION_FOOD_FAMILY.apple).toBe(COMPANION_FOOD_FAMILY.mango);
    expect(COMPANION_FOOD_FAMILY.bread).not.toBe(COMPANION_FOOD_FAMILY.pudding);
    expect(COMPANION_FOOD_FAMILY.pasta).not.toBe(COMPANION_FOOD_FAMILY.sushi);
  });

  it("makes a genuinely consumed family more welcoming for all252 foods, below exact-food trust", () => {
    for (const kind of COMPANION_FOOD_KINDS) {
      const related = COMPANION_FOOD_FAMILIES[COMPANION_FOOD_FAMILY[kind]].find(other => other !== kind)!;
      const first = companionFoodAcceptance(kind, .1, prefs), family = companionFoodAcceptance(kind, .1, prefs, [related]), exact = companionFoodAcceptance(kind, .1, prefs, [kind]);
      expect(family.chance, kind).toBeGreaterThan(first.chance); expect(family.chance, kind).toBeLessThan(exact.chance);
      expect(family.maxEncounters, kind).toBeLessThanOrEqual(first.maxEncounters);
      expect(exact).toEqual({ chance: 1, maxEncounters: 0, experience: "food" });
    }
  });

  it("uses unique consumed records rather than a sighting, accident familiarity or random favourite", () => {
    expect(companionConsumedFoodExperience("bagel")).toEqual({ exact: false, related: 0 });
    expect(companionConsumedFoodExperience("bagel", ["bread", "bread", "private-canary" as "bread"])).toEqual({ exact: false, related: 1 });
    expect(companionFoodAcceptance("bagel", .1, prefs, ["apple"])).toEqual(companionFoodAcceptance("bagel", .1, prefs));
    for (const notConsumed of [undefined, null, { favoriteFood: "bagel", foodScores: { bagel: .9 }, familiarity: { bagel: 1 } }]) expect(companionConsumedFoodExperience("bagel", notConsumed as unknown as CompanionFoodKind[])).toEqual({ exact: false, related: 0 });
    expect(companionFoodAcceptance("bagel", .1, prefs, ["bread", "bread"])).toEqual(companionFoodAcceptance("bagel", .1, prefs, ["bread"]));
    const varied = companionFoodAcceptance("bagel", .1, prefs, ["bread", "croissant", "baguette"]);
    expect(varied.chance).toBeGreaterThan(companionFoodAcceptance("bagel", .1, prefs, ["bread"]).chance);
  });

  it("raises hunger willingness strongly and continuously while retaining species/personality caution and finite limits", () => {
    for (const animalMode of ["default", "cat", "dog"] as const) for (const personality of ["curious", "affectionate", "sleepy"] as const) {
      const settings = { ...prefs, animalMode, personality }, full = companionFoodAcceptance("bagel", .1, settings), hungry = companionFoodAcceptance("bagel", .95, settings);
      expect(hungry.chance).toBeCloseTo(Math.min(.96, full.chance + .52)); expect(hungry.chance).toBeLessThan(1);
      if (animalMode === "dog") expect([full.maxEncounters, hungry.maxEncounters]).toEqual([1, 1]);
      else expect(hungry.maxEncounters).toBeLessThan(full.maxEncounters);
      let previous = 0;
      for (let level = 0; level <= 100; level++) { const chance = companionFoodAcceptance("bagel", level / 100, settings).chance; expect(chance).toBeGreaterThanOrEqual(previous); previous = chance; }
    }
    const cat = companionFoodAcceptance("bagel", .95, { ...prefs, animalMode: "cat" }), dog = companionFoodAcceptance("bagel", .95, { ...prefs, animalMode: "dog" });
    expect(cat.chance).toBeLessThan(dog.chance);
    expect(companionFoodAcceptance("bagel", .95, { ...prefs, personality: "sleepy" }).chance).toBeLessThan(companionFoodAcceptance("bagel", .95, prefs).chance);
    expect(companionFoodAcceptance("bagel", NaN, prefs)).toEqual(companionFoodAcceptance("bagel", 0, prefs));
  });

  it("matches first-encounter probability density without a statistical test or forced first inspection", () => {
    const samples = 2000;
    const accepts = (hunger: number, consumed: CompanionFoodKind[]) => Array.from({ length: samples }, (_, index) => createCompanionFoodCuriosity(() => index / samples).consider(meal, food, false, hunger, prefs, consumed)).filter(action => action === meal).length;
    const unknown = accepts(.1, []), related = accepts(.1, ["bread"]), hungry = accepts(.95, []), exact = accepts(.1, ["bagel"]);
    expect(unknown).toBeGreaterThan(0); expect(unknown).toBeLessThan(related); expect(related).toBeLessThan(hungry); expect(hungry).toBeLessThan(exact); expect(exact).toBe(samples);
    for (const [hunger, consumed, result] of [[.1, [], unknown], [.1, ["bread"], related], [.95, [], hungry]] as [number, CompanionFoodKind[], number][]) expect(Math.abs(result / samples - companionFoodAcceptance("bagel", hunger, prefs, consumed).chance)).toBeLessThanOrEqual(1 / samples);
  });

  it("keeps family transfer OFF with learning disabled while hunger and exact known-food behavior remain", () => {
    const off = { ...prefs, learnFromYou: false };
    expect(companionFoodAcceptance("bagel", .1, off, ["bread"])).toEqual(companionFoodAcceptance("bagel", .1, off));
    expect(companionFoodAcceptance("bagel", .95, off).chance).toBeGreaterThan(companionFoodAcceptance("bagel", .1, off).chance + .5);
    expect(companionFoodAcceptance("bagel", .1, off, ["bagel"]).chance).toBe(1);
    expect(createCompanionFoodCuriosity(() => 0).consider(meal, food, true, .1, off)).toBe(meal);
  });

  it("bounds even invalid/unlucky draws, preserves the same real meal and never writes consumption", () => {
    const consumed = Object.freeze(["bread"] as CompanionFoodKind[]), random = vi.fn(() => NaN), curiosity = createCompanionFoodCuriosity(random);
    const episodeMeal = { ...meal, episode: { kind: "meal" as const, phase: "meal" as const, variant: "careful" as const, remaining: 4, foodId: food.id, mishapUsed: false, legs: 1 } };
    const steps = Array.from({ length: 8 }, () => curiosity.consider(episodeMeal, food, false, .95, { ...prefs, animalMode: "cat" }, consumed));
    expect(steps[0].kind).toBe("sniff"); expect(steps[0].episode?.phase).toBe("approach"); expect(steps[1]).toBe(episodeMeal);
    for (const step of steps) { expect(step.foodId).toBe(food.id); expect(step.target).toBe(meal.target); expect(step.effectPoint).toBe(meal.effectPoint); }
    expect(consumed).toEqual(["bread"]); expect(random).toHaveBeenCalledTimes(1);
    expect(episodeMeal.episode.phase).toBe("meal");
  });

  it("only modifies a proved mouth-range eating action, preserving unreachable, satiated and route decisions", () => {
    const world: CompanionWorld = { x: 145, y: 400, platformId: "card", width: 800, height: 600, platforms: [{ id: "card", x: 20, y: 400, width: 500, kind: "card" }], foods: [food] };
    const brain = { ...createBrain(0), hunger: .95 }, chosen = getFoodAction(brain, world, prefs, 0)!;
    expect(chosen.kind).toBe("eat"); expect(createCompanionFoodCuriosity(() => .5).consider(chosen, food, false, brain.hunger, prefs)).toBe(chosen);
    expect(getFoodAction({ ...brain, hunger: .1 }, world, prefs, 0)).toBeUndefined();
    const inaccessible: CompanionFood = { ...food, x: 700, y: 0, platformId: "absent" };
    expect(getFoodAction(brain, { ...world, foods: [inaccessible] }, prefs, 0)).toBeUndefined();
    const walk: CompanionAction = { ...meal, kind: "walk" };
    expect(createCompanionFoodCuriosity(() => 0).consider(walk, food, false, 1, prefs, ["bagel"])).toBe(walk);
    expect(createCompanionFoodCuriosity(() => 0).consider(meal, { ...food, id: "another" }, false, 1, prefs)).toBe(meal);
  });
});
