import { describe, expect, it } from "vitest";
import { COMPANION_FOOD_CATEGORY, COMPANION_FOOD_KINDS, COMPANION_FOOD_NAMES, COMPANION_FOOD_RARITY, COMPANION_FOOD_WEIGHTS, LEGACY_COMPANION_FOOD_KINDS, companionFoodChance, isCompanionFoodKind, randomCompanionFood } from "@/lib/ui/viewer-companion/snacks";

describe("companion snack catalogue", () => {
  it("preserves the original36 IDs and defines60 unique local foods including prepared meals", () => {
    expect(COMPANION_FOOD_KINDS.slice(0, 13)).toEqual(LEGACY_COMPANION_FOOD_KINDS);
    expect(COMPANION_FOOD_KINDS.slice(13, 36)).toEqual(["banana", "grape", "cherry", "blueberry", "mango", "kiwi", "pineapple", "coconut", "fig", "dragon-fruit", "melon", "carrot", "cucumber", "broccoli", "pumpkin", "corn", "sweet-potato", "potato", "cabbage", "eggplant", "bell-pepper", "radish", "peas"]);
    expect(COMPANION_FOOD_KINDS).toHaveLength(60);
    expect(new Set(COMPANION_FOOD_KINDS).size).toBe(60);
    expect(Object.keys(COMPANION_FOOD_NAMES)).toEqual([...COMPANION_FOOD_KINDS]);
    expect(new Set(Object.values(COMPANION_FOOD_NAMES)).size).toBe(60);
    expect(Object.values(COMPANION_FOOD_CATEGORY).filter(category => category === "vegetable")).toHaveLength(13);
    expect(Object.values(COMPANION_FOOD_CATEGORY).filter(category => category === "prepared")).toHaveLength(24);
    for (const kind of COMPANION_FOOD_KINDS) { expect(isCompanionFoodKind(kind)).toBe(true); expect(COMPANION_FOOD_NAMES[kind]).toMatch(/^[가-힣]+$/); }
    for (const kind of [null, 1, {}, "", "unknown-food", "Apple", "__proto__"]) expect(isCompanionFoodKind(kind)).toBe(false);
  });
  it("draws the exact8:3:1 weighted distribution and renormalizes every previous-food exclusion", () => {
    expect(Object.values(COMPANION_FOOD_RARITY).filter(rarity => rarity === "common")).toHaveLength(30);
    expect(Object.values(COMPANION_FOOD_RARITY).filter(rarity => rarity === "uncommon")).toHaveLength(20);
    expect(Object.values(COMPANION_FOOD_RARITY).filter(rarity => rarity === "rare")).toHaveLength(10);
    expect(Object.values(COMPANION_FOOD_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(310);
    for (const previous of [undefined, ...COMPANION_FOOD_KINDS]) {
      const total = 310 - (previous ? COMPANION_FOOD_WEIGHTS[previous] : 0);
      const samples = Array.from({ length: total }, (_, i) => randomCompanionFood(previous, () => (i + .5) / total));
      for (const kind of COMPANION_FOOD_KINDS) {
        const expected = kind === previous ? 0 : COMPANION_FOOD_WEIGHTS[kind];
        expect(samples.filter(item => item === kind)).toHaveLength(expected);
        expect(companionFoodChance(kind, previous)).toBeCloseTo(expected / total, 12);
      }
    }
  });
  it("bounds injected RNG errors to a valid fruit", () => {
    for (const sample of [-9, 1, 9, Infinity, NaN]) expect(isCompanionFoodKind(randomCompanionFood("apple", () => sample))).toBe(true);
  });
});
