import { describe, expect, it } from "vitest";
import { COMPANION_SNACK_EXPANSION_146 } from "@/lib/ui/viewer-companion/snack-expansion-146";
import { COMPANION_TOY_EXPANSION_146 } from "@/lib/ui/viewer-companion/toy-expansion-146";
import { COMPANION_FOOD_KINDS, COMPANION_FOOD_NAMES, COMPANION_FOOD_WEIGHTS, companionFoodChance } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_FOOD_FACTS } from "@/lib/ui/viewer-companion/food-facts";
import { COMPANION_FOOD_FAMILY, COMPANION_FOOD_FAMILIES } from "@/lib/ui/viewer-companion/food-family";
import { COMPANION_TOY_KINDS, COMPANION_TOY_HINTS, COMPANION_TOY_WEIGHTS, getCompanionToyArt, companionToyChance } from "@/lib/ui/viewer-companion/toy-catalog";
import { companionProfileTasteReason, createCompanionTastesStore } from "@/lib/ui/viewer-companion/toy-tastes";
import { evaluateCompanionFoodTaste, isCompanionFoodTasteOutcome, isPositiveCompanionTasteReason } from "@/lib/ui/viewer-companion/taste-reasons";

describe("146 broadcast homage collection", () => {
  it("appends twelve distinct foods and twenty-four props while preserving legacy order", () => {
    expect(COMPANION_FOOD_KINDS).toHaveLength(252); expect(COMPANION_TOY_KINDS).toHaveLength(84);
    expect(COMPANION_SNACK_EXPANSION_146).toHaveLength(12); expect(COMPANION_TOY_EXPANSION_146).toHaveLength(24);
    expect(COMPANION_FOOD_KINDS.slice(240)).toEqual(COMPANION_SNACK_EXPANSION_146.map(item => item.id));
    expect(COMPANION_TOY_KINDS.slice(60)).toEqual(COMPANION_TOY_EXPANSION_146.map(item => item.id));
    expect(COMPANION_FOOD_KINDS[239]).toBe("oyster"); expect(COMPANION_TOY_KINDS[59]).toBe("stud-brick-castle");
    expect(new Set(COMPANION_FOOD_KINDS).size).toBe(252); expect(new Set(COMPANION_TOY_KINDS).size).toBe(84);
    expect(COMPANION_SNACK_EXPANSION_146.map(item => COMPANION_FOOD_NAMES[item.id])).toEqual(["토리표 깍콩국", "꽝꽝 언 남은 피자", "꽝꽝 언 남은 떡볶이", "벌칙 룰렛 빼빼로", "빼빼로", "파란 마시멜로 떡국", "수상한 초록 우유", "민초 차돌된장찌개", "토리표 생일 미역국", "쿠키 케이크", "두바이 쫀득 쿠키", "두초생 케이크"]);
    for (const item of COMPANION_SNACK_EXPANSION_146) {
      expect(COMPANION_FOOD_FACTS[item.id]).toBe(item.fact); expect(COMPANION_FOOD_FAMILY[item.id]).toBe(item.family);
      expect(Object.values(COMPANION_FOOD_FAMILIES).flat().filter(kind => kind === item.id)).toHaveLength(1);
    }
    for (const item of COMPANION_TOY_EXPANSION_146) {
      const edition = ["practice-baseball-bat", "practice-baseball-glove"].includes(item.id) ? 159 : 146;
      expect(getCompanionToyArt(item.id)).toBe(`/companion/home/${edition}/toy-${item.id}.webp`);
    }
  });
  it("normalizes exact positive integer masses without increasing established rare-item odds", () => {
    expect(Object.values(COMPANION_FOOD_WEIGHTS).reduce((sum, mass) => sum + mass, 0)).toBe(106169080);
    expect(Object.values(COMPANION_TOY_WEIGHTS).reduce((sum, mass) => sum + mass, 0)).toBe(38628880);
    expect(COMPANION_FOOD_WEIGHTS.croquembouche).toBe(5280); expect(COMPANION_TOY_WEIGHTS["stud-brick-castle"]).toBe(1800);
    expect(companionFoodChance("croquembouche")).toBeLessThan(.00005); expect(companionToyChance("stud-brick-castle")).toBeLessThan(.00005);
    for (const kind of ["cricket-pepero", "herb-avocado-milk", "mint-choco-brisket-stew"] as const) expect(companionFoodChance(kind)).toBeLessThan(.00005);
    expect(companionFoodChance("pepero")).toBeGreaterThan(companionFoodChance("cricket-pepero") * 40);
    expect(COMPANION_FOOD_KINDS.reduce((sum, food) => sum + companionFoodChance(food), 0)).toBeCloseTo(1, 12);
    expect(COMPANION_TOY_KINDS.reduce((sum, toy) => sum + companionToyChance(toy), 0)).toBeCloseTo(1, 12);
  });
  it("earns contextual food reasons only after real food outcomes, and later positive meals can replace them", () => {
    const store = createCompanionTastesStore();
    for (const item of COMPANION_SNACK_EXPANSION_146) {
      expect(companionProfileTasteReason(store.load(), "food", item.id, "negative")).toBeUndefined();
      for (const roll of [0, .2, .5, .8, 1]) { const result = evaluateCompanionFoodTaste(item.id, undefined, roll); expect(isCompanionFoodTasteOutcome(result)).toBe(true); expect(isPositiveCompanionTasteReason(result.reason)).toBe(result.reaction !== "disliked"); }
    }
    const cold = evaluateCompanionFoodTaste("frozen-leftover-pizza", undefined, 0); expect(cold).toMatchObject({ reaction: "disliked", reason: "icy-tooth" });
    store.recordFoodOutcome(cold, false); expect(store.load().reasons).toEqual([]);
    store.recordFoodOutcome(cold); expect(companionProfileTasteReason(store.load(), "food", cold.food, "negative")).toContain("이가 시려요");
    store.recordFoodOutcome(evaluateCompanionFoodTaste(cold.food, undefined, 1)); expect(companionProfileTasteReason(store.load(), "food", cold.food, "positive")).toContain("치즈");
    expect(companionProfileTasteReason(store.load(), "food", cold.food, "negative")).toBeUndefined();
    for (const food of ["pepero", "birthday-seaweed-soup", "cookie-cake", "dubai-chewy-cookie", "duchosaeng-cake"] as const) expect(evaluateCompanionFoodTaste(food, undefined, 0).reaction).not.toBe("disliked");
  });
  it("keeps new toy discovery tied to play and confines special reasons to their actual props", () => {
    const store = createCompanionTastesStore();
    for (const item of COMPANION_TOY_EXPANSION_146) {
      for (const event of ["taken-out", "tidied", "tripped", "declined"] as const) expect(store.recordToy(item.id, event)).toBe(false);
      expect(store.recordToy(item.id, "played", false)).toBe(true);
    }
    expect(store.load().reasons).toEqual([]); expect(store.load().toys).toEqual(COMPANION_TOY_EXPANSION_146.map(item => item.id));
    store.recordToy("card-mirror", "played"); store.recordToy("card-mirror", "played");
    expect(companionProfileTasteReason(store.load(), "toy", "card-mirror", "positive")).toContain("거울");
    expect(companionProfileTasteReason(store.load(), "toy", "card-mirror", "negative")).toBeUndefined();
    store.recordToy("card-mirror", "tripped"); expect(companionProfileTasteReason(store.load(), "toy", "card-mirror", "negative")).toContain("넘어졌어요");
    expect(COMPANION_TOY_HINTS["matte-turbo-lighter"]).toContain("불을 붙이지 않고");
    expect(COMPANION_TOY_HINTS["ceramic-safety-cutter"]).toContain("날이 들어간 채");
    expect(COMPANION_TOY_HINTS["vr-headset"]).toContain("방송");
  });
});
