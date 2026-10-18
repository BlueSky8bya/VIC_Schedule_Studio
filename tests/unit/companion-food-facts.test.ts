import { describe, expect, it } from "vitest";
import { COMPANION_FOOD_FACTS } from "@/lib/ui/viewer-companion/food-facts";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";

describe("food-specific collection notes", () => {
  it("covers every current food once with a short readable note and no runtime probability explanation", () => {
    expect(Object.keys(COMPANION_FOOD_FACTS).sort()).toEqual([...COMPANION_FOOD_KINDS].sort());
    const facts = Object.values(COMPANION_FOOD_FACTS);
    expect(new Set(facts).size).toBe(COMPANION_FOOD_KINDS.length);
    for (const fact of facts) {
      expect(fact.length).toBeGreaterThan(20);
      expect(fact.length).toBeLessThanOrEqual(85);
      expect(fact).not.toMatch(/직전|등장|확률|%|면역|치료|예방|효능/);
    }
  });
  it("keeps the tomato explanation concrete and Korean convenience-store rice-ball identity intact", () => {
    expect(COMPANION_FOOD_FACTS.tomato).toContain("열매");
    expect(COMPANION_FOOD_FACTS.tomato).toContain("소스");
    expect(COMPANION_FOOD_FACTS["rice-ball"]).toContain("편의점");
    expect(COMPANION_FOOD_FACTS["rice-ball"]).toContain("삼각형");
    expect(COMPANION_FOOD_FACTS["rice-ball"]).not.toMatch(/오니기리|일본/);
  });
});
