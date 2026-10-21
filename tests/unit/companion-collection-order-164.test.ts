import { describe, expect, it } from "vitest";
import { COMPANION_FOOD_BOOK_ORDER, COMPANION_TOY_BOOK_ORDER, orderCompanionBook, type CompanionBookEntry } from "@/lib/ui/viewer-companion/collection-book-order";
import { COMPANION_FOOD_BOOK_METADATA, COMPANION_TOY_BOOK_METADATA } from "@/lib/ui/viewer-companion/collection-book-metadata";
import { COMPANION_FOOD_KINDS, COMPANION_FOOD_NAMES, COMPANION_FOOD_WEIGHTS, companionFoodChance, randomCompanionFood } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_TOY_KINDS, COMPANION_TOY_NAMES, COMPANION_TOY_WEIGHTS, companionToyChance, randomCompanionToy } from "@/lib/ui/viewer-companion/toy-catalog";

describe("164 catalogue display order", () => {
  it("prioritizes actual difficulty, preparation, familiarity, then Korean alphabetical ties", () => {
    const entries: Record<string, CompanionBookEntry> = {
      rareRaw: { name: "가", mass: 1, requiresPreparation: false, familiarity: "familiar" },
      prepared: { name: "가", mass: 10, requiresPreparation: true, familiarity: "familiar" },
      rawOtherNa: { name: "나", mass: 10, requiresPreparation: false, familiarity: "other" },
      rawOtherGa: { name: "가", mass: 10, requiresPreparation: false, familiarity: "other" },
      rawFamiliar: { name: "하", mass: 10, requiresPreparation: false, familiarity: "familiar" },
    };
    const input = Object.freeze(Object.keys(entries));
    expect(orderCompanionBook(input, id => entries[id])).toEqual(["rawFamiliar", "rawOtherGa", "rawOtherNa", "prepared", "rareRaw"]);
    expect(input).toEqual(Object.keys(entries));
    // A future ID joins the correct position without editing a display index.
    entries.newRaw = { name: "다", mass: 10, requiresPreparation: false, familiarity: "other" };
    expect(orderCompanionBook([...input, "newRaw"], id => entries[id])).toEqual(["rawFamiliar", "rawOtherGa", "rawOtherNa", "newRaw", "prepared", "rareRaw"]);
  });
  it("keeps label collisions deterministic regardless of insertion order", () => {
    const entry = () => ({ name: "같은 이름", mass: 1, requiresPreparation: false, familiarity: "other" as const });
    expect(orderCompanionBook(["b", "a"], entry)).toEqual(orderCompanionBook(["a", "b"], entry));
  });
  it("classifies every stable identity and displays every food/toy exactly once", () => {
    expect(Object.keys(COMPANION_FOOD_BOOK_METADATA).sort()).toEqual([...COMPANION_FOOD_KINDS].sort());
    expect(Object.keys(COMPANION_TOY_BOOK_METADATA).sort()).toEqual([...COMPANION_TOY_KINDS].sort());
    expect([...COMPANION_FOOD_BOOK_ORDER].sort()).toEqual([...COMPANION_FOOD_KINDS].sort());
    expect([...COMPANION_TOY_BOOK_ORDER].sort()).toEqual([...COMPANION_TOY_KINDS].sort());
    expect(COMPANION_FOOD_BOOK_METADATA.tofu.prepared).toBe(true);
    expect(COMPANION_FOOD_BOOK_METADATA.scallop.prepared).toBe(false);
    expect(COMPANION_TOY_BOOK_METADATA.blocks.assembly).toBe(true);
    expect(COMPANION_TOY_BOOK_METADATA["stud-brick-castle"].assembly).toBe(true);
    expect(COMPANION_TOY_BOOK_METADATA["transforming-robot"].assembly).toBe(false);
    expect(COMPANION_TOY_BOOK_METADATA["toy-car"].assembly).toBe(false);
  });
  it("uses 가나다 within a familiarity tie and preserves preparation over familiarity", () => {
    const before = <K extends string>(order: readonly K[], a: K, b: K) => expect(order.indexOf(a), `${a} before ${b}`).toBeLessThan(order.indexOf(b));
    before(COMPANION_FOOD_BOOK_ORDER, "potato", "apple");
    before(COMPANION_FOOD_BOOK_ORDER, "apple", "bread");
    before(COMPANION_FOOD_BOOK_ORDER, "apricot", "raspberry");
    before(COMPANION_TOY_BOOK_ORDER, "toy-car", "blocks");
    before(COMPANION_TOY_BOOK_ORDER, "hoop", "bell");
  });
  it("never changes draw intervals, probabilities or append-only saved identity registries", () => {
    expect(COMPANION_FOOD_KINDS[0]).toBe("apple");
    expect(COMPANION_TOY_KINDS.slice(0, 2)).toEqual(["ball", "blocks"]);
    for (const [ids, mass, chance, draw] of [
      [COMPANION_FOOD_KINDS, COMPANION_FOOD_WEIGHTS, companionFoodChance, randomCompanionFood],
      [COMPANION_TOY_KINDS, COMPANION_TOY_WEIGHTS, companionToyChance, randomCompanionToy],
    ] as const) {
      const kinds = ids as readonly string[], weights = mass as Readonly<Record<string, number>>;
      const total = kinds.reduce((sum, id) => sum + weights[id], 0);
      let offset = 0;
      for (const id of kinds) {
        expect((chance as (id: string) => number)(id)).toBeCloseTo(weights[id] / total, 14);
        expect((draw as (previous: undefined, rng: () => number) => string)(undefined, () => (offset + weights[id] / 2) / total)).toBe(id);
        offset += weights[id];
      }
    }
    expect(COMPANION_FOOD_BOOK_ORDER.map(id => COMPANION_FOOD_NAMES[id]).slice(0, 4)).toEqual(["감자", "고구마", "고추", "귤"]);
    expect(COMPANION_TOY_BOOK_ORDER.map(id => COMPANION_TOY_NAMES[id]).length).toBe(COMPANION_TOY_KINDS.length);
  });
});
