import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { COMPANION_FOOD_KINDS, COMPANION_FOOD_NAMES, COMPANION_FOOD_RARITY } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_FOOD_FACTS } from "@/lib/ui/viewer-companion/food-facts";
import { COMPANION_FOOD_FAMILY, companionConsumedFoodExperience } from "@/lib/ui/viewer-companion/food-family";
import { COMPANION_SNACK_EXPANSION_143 } from "@/lib/ui/viewer-companion/snack-expansion-143";
import { COMPANION_TOY_EXPANSION_143 } from "@/lib/ui/viewer-companion/toy-expansion-143";
import { COMPANION_TOY_KINDS, COMPANION_TOY_NAMES, COMPANION_TOY_VISUALS, COMPANION_TOY_HINTS } from "@/lib/ui/viewer-companion/toy-catalog";
import { createCompanionLife, normalizeCompanionLife } from "@/lib/ui/viewer-companion/life";
import { normalizeCompanionCollection, createCompanionCollectionStore } from "@/lib/ui/viewer-companion/collection";
import { normalizeCompanionTastes, createCompanionTastesStore } from "@/lib/ui/viewer-companion/toy-tastes";
import { formatCompanionCollectionChance } from "@/lib/ui/viewer-companion/collection-rarity";

const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
describe("143 append-only local collection migration", () => {
  it("preserves the exact180 old IDs, names and rarity classes", () => {
    const old = COMPANION_FOOD_KINDS.slice(0, 180);
    expect(sha(old)).toBe("722c2bd5a8aef99a5cd5569354a4aa06de37b024b2c0dd6fe0bacf187810343f");
    expect(sha(old.map(id => [id, COMPANION_FOOD_NAMES[id]]))).toBe("2942a19c44eb90b52d7b3c0b7cf596b2920295c1a909f64f3e7cd30c2171a9a5");
    expect(sha(old.map(id => [id, COMPANION_FOOD_RARITY[id]]))).toBe("05f9bd0d7c756e17516fb3fc4afc14c0a0475988db7ba70968cd6f6568a678b7");
    expect(COMPANION_FOOD_KINDS.slice(180, 240)).toEqual(COMPANION_SNACK_EXPANSION_143.map(item => item.id));
    expect(COMPANION_TOY_KINDS.slice(24, 60)).toEqual(COMPANION_TOY_EXPANSION_143.map(item => item.id));
    expect(COMPANION_FOOD_KINDS.length % 12).toBe(0); expect(COMPANION_TOY_KINDS.length % 12).toBe(0);
    expect(new Set(Object.values(COMPANION_TOY_NAMES)).size).toBe(84);
  });
  it("covers all facts/families and keeps generated toys inside the shared44px target", () => {
    expect(Object.keys(COMPANION_FOOD_FACTS).length).toBe(252); expect(Object.keys(COMPANION_FOOD_FAMILY).length).toBe(252);
    for (const food of COMPANION_FOOD_KINDS) { expect(COMPANION_FOOD_FACTS[food].length).toBeGreaterThan(10); expect(COMPANION_FOOD_FAMILY[food]).toBeTruthy(); }
    for (const toy of COMPANION_TOY_KINDS) { const box = COMPANION_TOY_VISUALS[toy]; expect(box.width).toBeGreaterThanOrEqual(18); expect(box.width).toBeLessThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(18); expect(box.height).toBeLessThanOrEqual(44); expect(COMPANION_TOY_HINTS[toy]).toBeTruthy(); }
    expect(companionConsumedFoodExperience("jjajangmyeon", ["udon"])).toEqual({ exact: false, related: 1 });
    expect(companionConsumedFoodExperience("croquembouche", ["udon"])).toEqual({ exact: false, related: 0 });
  });
  it("loads old180-food earned values and24-toy read state without awarding any new identity", () => {
    const oldFoods = COMPANION_FOOD_KINDS.slice(0, 180), oldToys = COMPANION_TOY_KINDS.slice(0, 24), initial = createCompanionLife(() => 0);
    const scores = Object.fromEntries(oldFoods.map(id => [id, id === "macaron" ? .42 : .2]));
    const life = normalizeCompanionLife({ ...initial, seedFood: "sushi", favoriteFood: "macaron", foodScores: scores, familiarity: { apple: .4 } });
    for (const food of oldFoods) expect(life.foodScores[food]).toBe(scores[food]);
    expect(life.seedFood).toBe("sushi"); expect(life.favoriteFood).toBe("macaron");
    for (const food of COMPANION_FOOD_KINDS.slice(180)) expect(life.familiarity[food]).toBe(0);
    const collection = normalizeCompanionCollection({ version: 1, foods: oldFoods, seen: { foods: oldFoods.slice(0, 80) } });
    expect(collection.foods).toEqual(oldFoods); expect(collection.seen?.foods).toEqual(oldFoods.slice(0, 80));
    const tastes = normalizeCompanionTastes({ version: 1, toys: oldToys, seen: oldToys.slice(0, 9), toyTastes: { feather: { accepted: 3, declined: 0, score: .6 } } });
    expect(tastes.toys).toEqual(oldToys); expect(tastes.seen).toEqual(oldToys.slice(0, 9)); expect(tastes.toyTastes.feather?.score).toBe(.6);
  });
  it("awards new toys only for real accepted play, even with learning OFF", () => {
    const tastes = createCompanionTastesStore();
    for (const event of ["taken-out", "tidied", "declined", "tripped"] as const) expect(tastes.recordToy("stud-brick-castle", event)).toBe(false);
    expect(tastes.load().toys).toEqual([]); expect(tastes.acknowledge("stud-brick-castle")).toBe(false);
    expect(tastes.recordToy("stud-brick-castle", "played", false)).toBe(true);
    expect(tastes.load().toys).toEqual(["stud-brick-castle"]); expect(tastes.load().toyTastes).toEqual({});
    expect(tastes.acknowledge("stud-brick-castle")).toBe(true); expect(tastes.load().seen).toEqual(["stud-brick-castle"]);
    const foods = createCompanionCollectionStore();
    expect(foods.load().foods).toEqual([]); //Catalogue registration is not consumption.
  });
  it("prints micro probabilities without rounding mythic to zero", () => {
    expect(formatCompanionCollectionChance(.00005)).toBe("0.005%");
    expect(formatCompanionCollectionChance(.00019)).toBe("0.019%");
    expect(formatCompanionCollectionChance(.03125)).toBe("3.13%");
    expect(formatCompanionCollectionChance(1)).toBe("100%");
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(formatCompanionCollectionChance(value)).toBe("0%");
  });
});
