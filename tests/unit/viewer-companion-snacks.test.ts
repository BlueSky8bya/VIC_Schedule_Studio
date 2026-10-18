import { describe, expect, it } from "vitest";
import { COMPANION_FOOD_CATEGORY, COMPANION_FOOD_KINDS, COMPANION_FOOD_NAMES, COMPANION_FOOD_RARITY, COMPANION_FOOD_WEIGHTS, LEGACY_COMPANION_FOOD_KINDS, companionFoodChance, isCompanionFoodKind, randomCompanionFood } from "@/lib/ui/viewer-companion/snacks";

describe("companion snack catalogue", () => {
  it("preserves the original60 IDs and adds120 distinct local foods including prepared meals", () => {
    expect(COMPANION_FOOD_KINDS.slice(0, 13)).toEqual(LEGACY_COMPANION_FOOD_KINDS);
    expect(COMPANION_FOOD_KINDS.slice(13, 36)).toEqual(["banana", "grape", "cherry", "blueberry", "mango", "kiwi", "pineapple", "coconut", "fig", "dragon-fruit", "melon", "carrot", "cucumber", "broccoli", "pumpkin", "corn", "sweet-potato", "potato", "cabbage", "eggplant", "bell-pepper", "radish", "peas"]);
    expect(COMPANION_FOOD_KINDS).toHaveLength(180);
    expect(new Set(COMPANION_FOOD_KINDS).size).toBe(180);
    expect(COMPANION_FOOD_KINDS.slice(36, 60)).toEqual(["bread", "croissant", "baguette", "bagel", "pretzel", "sandwich", "toast", "pancake", "waffle", "doughnut", "muffin", "cupcake", "rice-ball", "rice-cake", "dumpling", "pizza", "pasta", "omelet", "soup", "curry", "sushi", "pudding", "cookie", "macaron"]);
    expect(Object.keys(COMPANION_FOOD_NAMES)).toEqual([...COMPANION_FOOD_KINDS]);
    expect(new Set(Object.values(COMPANION_FOOD_NAMES)).size).toBe(180);
    expect(Object.values(COMPANION_FOOD_CATEGORY).filter(category => category === "vegetable")).toHaveLength(52);
    expect(Object.values(COMPANION_FOOD_CATEGORY).filter(category => category === "prepared")).toHaveLength(85);
    expect(Object.values(COMPANION_FOOD_CATEGORY).filter(category => category === "fruit")).toHaveLength(43);
    for (const kind of COMPANION_FOOD_KINDS) { expect(isCompanionFoodKind(kind)).toBe(true); expect(COMPANION_FOOD_NAMES[kind]).toMatch(/^[가-힣 ]+$/); }
    expect(COMPANION_FOOD_NAMES["rice-ball"]).toBe("삼각김밥");
    for (const kind of [null, 1, {}, "", "unknown-food", "Apple", "__proto__"]) expect(isCompanionFoodKind(kind)).toBe(false);
  });
  it("draws the exact8:3:1 weighted distribution and renormalizes every previous-food exclusion", () => {
    expect(Object.values(COMPANION_FOOD_RARITY).filter(rarity => rarity === "common")).toHaveLength(71);
    expect(Object.values(COMPANION_FOOD_RARITY).filter(rarity => rarity === "uncommon")).toHaveLength(71);
    expect(Object.values(COMPANION_FOOD_RARITY).filter(rarity => rarity === "rare")).toHaveLength(38);
    expect(Object.values(COMPANION_FOOD_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(819);
    for (const previous of [undefined, ...COMPANION_FOOD_KINDS]) {
      const total = 819 - (previous ? COMPANION_FOOD_WEIGHTS[previous] : 0);
      const samples = Array.from({ length: total }, (_, i) => randomCompanionFood(previous, () => (i + .5) / total));
      const counts = new Map<string, number>(); for (const sample of samples) counts.set(sample, (counts.get(sample) ?? 0) + 1);
      for (const kind of COMPANION_FOOD_KINDS) {
        const expected = kind === previous ? 0 : COMPANION_FOOD_WEIGHTS[kind];
        expect(counts.get(kind) ?? 0).toBe(expected);
        expect(companionFoodChance(kind, previous)).toBeCloseTo(expected / total, 12);
      }
    }
  });
  it("bounds injected RNG errors to a valid fruit", () => {
    for (const sample of [-9, 1, 9, Infinity, NaN]) expect(isCompanionFoodKind(randomCompanionFood("apple", () => sample))).toBe(true);
  });
});
