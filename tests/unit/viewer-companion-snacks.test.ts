import { describe, expect, it } from "vitest";
import { COMPANION_FOOD_KINDS, COMPANION_FOOD_NAMES, isCompanionFoodKind, randomCompanionFood } from "@/lib/ui/viewer-companion/snacks";

describe("companion snack catalogue", () => {
  it("defines thirteen unique local fruit kinds and Korean names", () => {
    expect(COMPANION_FOOD_KINDS).toHaveLength(13);
    expect(new Set(COMPANION_FOOD_KINDS).size).toBe(13);
    expect(Object.keys(COMPANION_FOOD_NAMES)).toEqual([...COMPANION_FOOD_KINDS]);
    expect(new Set(Object.values(COMPANION_FOOD_NAMES)).size).toBe(13);
    for (const kind of COMPANION_FOOD_KINDS) { expect(isCompanionFoodKind(kind)).toBe(true); expect(COMPANION_FOOD_NAMES[kind]).toMatch(/^[가-힣]+$/); }
    for (const kind of [null, 1, {}, "", "banana", "Apple", "__proto__"]) expect(isCompanionFoodKind(kind)).toBe(false);
  });
  it("reaches each fruit with deterministic samples and never immediately repeats", () => {
    expect(COMPANION_FOOD_KINDS.map((_, i) => randomCompanionFood(undefined, () => i / 13))).toEqual([...COMPANION_FOOD_KINDS]);
    for (const previous of COMPANION_FOOD_KINDS) {
      const next = Array.from({ length: 12 }, (_, i) => randomCompanionFood(previous, () => i / 12));
      expect(new Set(next).size).toBe(12); expect(next).not.toContain(previous);
    }
  });
  it("bounds injected RNG errors to a valid fruit", () => {
    for (const sample of [-9, 1, 9, Infinity, NaN]) expect(isCompanionFoodKind(randomCompanionFood("apple", () => sample))).toBe(true);
  });
});
