import { describe, expect, it } from "vitest";
import { createCompanionLife } from "@/lib/ui/viewer-companion/life";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_TOY_KINDS } from "@/lib/ui/viewer-companion/toy-catalog";
import { companionInnateFoodReason, companionToyTasteReason, evaluateCompanionFoodTaste, isCompanionFoodTasteOutcome, isCompanionToyTasteReason, isPositiveCompanionTasteReason } from "@/lib/ui/viewer-companion/taste-reasons";
import { companionProfileTasteReason, createCompanionTastesStore, normalizeCompanionTastes } from "@/lib/ui/viewer-companion/toy-tastes";

describe("131 contextual, truthful profile reasons", () => {
  it("validates varied meal outcomes for every food without inventing ordinary-food aversions", () => {
    const life = createCompanionLife(() => 0), reasons = new Set<string>();
    const polarizing = new Set(["durian", "lemon", "grapefruit", "yuzu", "kumquat", "kiwi", "pineapple", "broccoli", "bell-pepper", "eggplant", "cabbage", "curry", "coconut"]);
    for (const food of COMPANION_FOOD_KINDS) for (let step = 0; step <= 100; step++) {
      const result = evaluateCompanionFoodTaste(food, life, step / 100);
      expect(isCompanionFoodTasteOutcome(result)).toBe(true);
      expect(isPositiveCompanionTasteReason(result.reason)).toBe(result.reaction !== "disliked");
      if (!polarizing.has(food)) expect(result.reaction).not.toBe("disliked");
      reasons.add(result.reason);
    }
    expect(reasons.size).toBeGreaterThanOrEqual(35);
  });

  it("rejects another food's sensory detail, wrong valence and arbitrary text", () => {
    expect(isCompanionFoodTasteOutcome({ food: "apple", reaction: "liked", reason: "buttery-bite" })).toBe(false);
    expect(isCompanionFoodTasteOutcome({ food: "bread", reaction: "disliked", reason: "durian-socks" })).toBe(false);
    expect(isCompanionFoodTasteOutcome({ food: "durian", reaction: "delighted", reason: "durian-lingers" })).toBe(false);
    expect(isCompanionFoodTasteOutcome({ food: "durian", reaction: "disliked", reason: "private-canary" })).toBe(false);
    expect(isCompanionFoodTasteOutcome({ food: "croissant", reaction: "liked", reason: "buttery-bite" })).toBe(true);
    expect(isCompanionFoodTasteOutcome({ food: "carrot", reaction: "liked", reason: "crisp-bite" })).toBe(true);
  });

  it("keeps each toy reason bound to its actual shape and completed play or mishap", () => {
    for (const kind of COMPANION_TOY_KINDS) for (let count = 1; count <= 8; count++) {
      const play = companionToyTasteReason(kind, "played", count), trip = companionToyTasteReason(kind, "tripped", count);
      expect(isCompanionToyTasteReason(kind, play)).toBe(true); expect(isCompanionToyTasteReason(kind, trip)).toBe(true);
      expect(isPositiveCompanionTasteReason(play)).toBe(true); expect(isPositiveCompanionTasteReason(trip)).toBe(false);
    }
    expect(isCompanionToyTasteReason("ball", "toy-wheels")).toBe(false);
    expect(isCompanionToyTasteReason("kaleidoscope", "toy-spin")).toBe(false);
    expect(isCompanionToyTasteReason("duck", "toy-trip-tangle")).toBe(false);
    expect(companionToyTasteReason("toy-car", "played", 2)).toBe("toy-wheels");
    expect(companionToyTasteReason("feather", "tripped", 2)).toBe("toy-trip-tangle");
  });

  it("explains an innate or legacy favorite without fabricating a meal or a discovery", () => {
    const store = createCompanionTastesStore(), life = createCompanionLife(() => 0), before = store.load();
    const lifeBefore = JSON.stringify(life);
    expect(companionProfileTasteReason(before, "food", life.seedFood, "positive", life)).toBe(companionInnateFoodReason(life.seedFood));
    const legacy = { ...life, seedFood: "apple" as const, favoriteFood: "peach" as const, tastedFoods: [] };
    expect(companionProfileTasteReason(before, "food", "peach", "positive", legacy)).toBe("예전부터 좋아하던 간식이에요");
    expect(companionProfileTasteReason(before, "food", "durian", "negative", legacy)).toBeUndefined();
    expect(store.load()).toEqual(before); expect(JSON.stringify(life)).toBe(lifeBefore);
    expect(store.load().reasons).toEqual([]); expect(life.tastedFoods).toEqual([]);
  });

  it("distinguishes a single remembered game from repeated games and requires a real trip", () => {
    const prior = (accepted: number, tripped = 0) => normalizeCompanionTastes({ version: 1, toys: ["ball"], toyTastes: { ball: { accepted, declined: 0, tripped, score: .5 } } });
    expect(companionProfileTasteReason(prior(1), "toy", "ball", "positive")).toBe("같이 놀아 보니 마음에 들어요");
    expect(companionProfileTasteReason(prior(2), "toy", "ball", "positive")).toBe("같이 놀아 보니 마음에 들어요");
    expect(companionProfileTasteReason(prior(3), "toy", "ball", "positive")).toBe("여러 번 놀아서 정들었어요");
    expect(companionProfileTasteReason(prior(1), "toy", "ball", "negative")).toBeUndefined();
    expect(companionProfileTasteReason(prior(1, 1), "toy", "ball", "negative")).toBe("전에 걸려 넘어져 조심해요");
  });

  it("records a new contextual reason only on actual completed experience and preserves learning OFF", () => {
    const store = createCompanionTastesStore();
    store.recordToy("feather", "taken-out"); store.recordToy("feather", "tidied");
    expect(store.load().toys).toEqual([]);
    expect(store.load().reasons).toEqual([]);
    store.recordToy("feather", "played"); store.recordToy("feather", "played");
    expect(companionProfileTasteReason(store.load(), "toy", "feather", "positive")).toBe("가볍게 살랑이는 게 좋아요");
    store.recordToy("feather", "tripped", false);
    expect(companionProfileTasteReason(store.load(), "toy", "feather", "negative")).toBeUndefined();
    store.recordToy("feather", "tripped"); store.recordToy("feather", "tripped");
    expect(companionProfileTasteReason(store.load(), "toy", "feather", "negative")).toBe("길쭉한 장난감에 걸려 넘어졌어요");
    const before = store.load();
    expect(store.recordFoodOutcome(evaluateCompanionFoodTaste("croissant", undefined, .72), false)).toBe(false);
    expect(store.load()).toEqual(before);
  });

  it("bounds reason history and clears preferences without losing discoveries", () => {
    const store = createCompanionTastesStore();
    for (const kind of COMPANION_TOY_KINDS) { store.recordToy(kind, "taken-out"); store.recordToy(kind, "played"); }
    for (const food of COMPANION_FOOD_KINDS) store.recordFoodOutcome(evaluateCompanionFoodTaste(food, undefined, .82));
    expect(store.load().reasons).toHaveLength(8); expect(JSON.stringify(store.load()).length).toBeLessThan(16384);
    const toys = store.load().toys; store.resetPreferences();
    expect(store.load().reasons).toEqual([]); expect(store.load().toys).toEqual(toys);
  });
});
