import { describe, expect, it } from "vitest";
import { COMPANION_FOOD_CATEGORY, COMPANION_FOOD_KINDS, COMPANION_FOOD_NAMES, COMPANION_FOOD_RARITY, COMPANION_FOOD_WEIGHTS, LEGACY_COMPANION_FOOD_KINDS, companionFoodChance, isCompanionFoodKind, randomCompanionFood } from "@/lib/ui/viewer-companion/snacks";

describe("companion snack catalogue", () => {
  it("preserves the original180 identities and appends72 distinct local foods", () => {
    expect(COMPANION_FOOD_KINDS.slice(0, 13)).toEqual(LEGACY_COMPANION_FOOD_KINDS);
    expect(COMPANION_FOOD_KINDS.slice(13, 36)).toEqual(["banana", "grape", "cherry", "blueberry", "mango", "kiwi", "pineapple", "coconut", "fig", "dragon-fruit", "melon", "carrot", "cucumber", "broccoli", "pumpkin", "corn", "sweet-potato", "potato", "cabbage", "eggplant", "bell-pepper", "radish", "peas"]);
    expect(COMPANION_FOOD_KINDS).toHaveLength(252);
    expect(new Set(COMPANION_FOOD_KINDS).size).toBe(252);
    expect(COMPANION_FOOD_KINDS.slice(36, 60)).toEqual(["bread", "croissant", "baguette", "bagel", "pretzel", "sandwich", "toast", "pancake", "waffle", "doughnut", "muffin", "cupcake", "rice-ball", "rice-cake", "dumpling", "pizza", "pasta", "omelet", "soup", "curry", "sushi", "pudding", "cookie", "macaron"]);
    expect(Object.keys(COMPANION_FOOD_NAMES)).toEqual([...COMPANION_FOOD_KINDS]);
    expect(new Set(Object.values(COMPANION_FOOD_NAMES)).size).toBe(252);
    expect(Object.values(COMPANION_FOOD_CATEGORY).filter(category => category === "vegetable")).toHaveLength(60);
    expect(Object.values(COMPANION_FOOD_CATEGORY).filter(category => category === "prepared")).toHaveLength(147);
    expect(Object.values(COMPANION_FOOD_CATEGORY).filter(category => category === "fruit")).toHaveLength(45);
    for (const kind of COMPANION_FOOD_KINDS) { expect(isCompanionFoodKind(kind)).toBe(true); expect(COMPANION_FOOD_NAMES[kind]).toMatch(/^[가-힣 ]+$/); }
    expect(COMPANION_FOOD_NAMES["rice-ball"]).toBe("삼각김밥");
    for (const kind of [null, 1, {}, "", "unknown-food", "Apple", "__proto__"]) expect(isCompanionFoodKind(kind)).toBe(false);
  });
  it("draws exact integer tier masses and renormalizes every previous-food exclusion", () => {
    expect(Object.fromEntries(["common", "uncommon", "rare", "ultra-rare", "mythic"].map(tier => [tier, Object.values(COMPANION_FOOD_RARITY).filter(value => value === tier).length]))).toEqual({ common: 96, uncommon: 97, rare: 49, "ultra-rare": 6, mythic: 4 });
    const totalMass = Object.values(COMPANION_FOOD_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(totalMass).toBe(106169080);
    // Verify every remaining interval for all241 previous states. Do not
    // enumerate105 million mass units or substitute a statistical lottery.
    for (const previous of [undefined, ...COMPANION_FOOD_KINDS]) {
      const total = totalMass - (previous ? COMPANION_FOOD_WEIGHTS[previous] : 0);
      let offset = 0, residual = total, chanceSum = 0;
      for (const kind of COMPANION_FOOD_KINDS) {
        const mass = kind === previous ? 0 : COMPANION_FOOD_WEIGHTS[kind];
        expect(companionFoodChance(kind, previous)).toBeCloseTo(mass / total, 14);
        chanceSum += companionFoodChance(kind, previous); residual -= mass;
        if (mass) for (const point of [offset + .25, offset + mass / 2, offset + mass - .25]) expect(randomCompanionFood(previous, () => point / total)).toBe(kind);
        offset += mass;
      }
      expect(residual).toBe(0); expect(offset).toBe(total); expect(chanceSum).toBeCloseTo(1, 12);
    }
    expect(companionFoodChance("croquembouche")).toBe(5280 / 106169080);
  });
  it("bounds injected RNG errors to a valid fruit", () => {
    for (const sample of [-9, 1, 9, Infinity, NaN]) expect(isCompanionFoodKind(randomCompanionFood("apple", () => sample))).toBe(true);
  });
});
