import { describe, expect, it, vi } from "vitest";
import { createBoundedWeightedCatalog } from "@/lib/ui/viewer-companion/bounded-weighted-catalog";
import { companionToyChance, COMPANION_TOY_KINDS, COMPANION_TOY_RARITY, COMPANION_TOY_WEIGHTS, randomCompanionToy } from "@/lib/ui/viewer-companion/toy-catalog";
import { randomCompanionFood } from "@/lib/ui/viewer-companion/snacks";

describe("143 bounded weighted collection draw", () => {
  it("keeps interval boundaries exact, including a removed first, middle or last interval", () => {
    const draw = createBoundedWeightedCatalog([{ id: "a", mass: 2 }, { id: "b", mass: 3 }, { id: "c", mass: 5 }]);
    expect(draw.totalMass).toBe(10);
    for (const [previous, sequence] of [[undefined, ["a", "a", "b", "b", "b", "c", "c", "c", "c", "c"]], ["a", ["b", "b", "b", "c", "c", "c", "c", "c"]], ["b", ["a", "a", "c", "c", "c", "c", "c"]], ["c", ["a", "a", "b", "b", "b"]]] as const) {
      const found = sequence.map((_, i) => draw.draw(previous, () => (i + .5) / sequence.length));
      expect(found).toEqual(sequence);
    }
    expect(draw.draw(undefined, () => .2)).toBe("b");
    expect(draw.draw(undefined, () => .5)).toBe("c");
    expect(draw.draw("b", () => 2 / 7)).toBe("c");
    expect(draw.chance("__proto__")).toBe(0); expect(draw.chance("a", "a")).toBe(0);
    expect(draw.chance("a", "foreign")).toBe(.2);
  });
  it.each([[], [{ id: "only", mass: 1 }], [{ id: "a", mass: 0 }, { id: "b", mass: 1 }], [{ id: "a", mass: 1.2 }, { id: "b", mass: 1 }], [{ id: "a", mass: 1 }, { id: "a", mass: 2 }], [{ id: "", mass: 1 }, { id: "b", mass: 2 }], [{ id: "a", mass: Number.MAX_SAFE_INTEGER }, { id: "b", mass: 1 }]].map(entries => ({ entries })))("rejects invalid fixed intervals %#", ({ entries }) => {
    expect(() => createBoundedWeightedCatalog(entries)).toThrow();
  });
  it("consumes one bounded sample for finite, nonfinite and unknown-previous input", () => {
    for (const value of [-4, 0, .5, 1, 9, Number.NaN, Number.POSITIVE_INFINITY]) {
      const rng = vi.fn(() => value), toy = randomCompanionToy("ball", rng);
      expect(COMPANION_TOY_KINDS).toContain(toy); expect(toy).not.toBe("ball"); expect(rng).toHaveBeenCalledOnce();
      rng.mockClear(); expect(randomCompanionFood("apple", rng)).not.toBe("apple"); expect(rng).toHaveBeenCalledOnce();
    }
    expect(createBoundedWeightedCatalog([{ id: "__proto__", mass: 1 }, { id: "constructor", mass: 1 }]).draw(undefined, () => 0)).toBe("__proto__"); //Map lookup has no prototype keys.
  });
  it("bounds catalogue construction and rejects a nonstring runtime identity", () => {
    expect(() => createBoundedWeightedCatalog(Array.from({ length: 513 }, (_, i) => ({ id: String(i), mass: 1 })))).toThrow();
    expect(() => createBoundedWeightedCatalog([{ id: 3 as unknown as string, mass: 1 }, { id: "b", mass: 1 }])).toThrow();
  });
  it("proves all eighty-four toy intervals for every previous exclusion with no residual mass", () => {
    expect(COMPANION_TOY_KINDS).toHaveLength(84);
    expect(Object.fromEntries(["common", "uncommon", "rare", "ultra-rare", "mythic"].map(tier => [tier, Object.values(COMPANION_TOY_RARITY).filter(value => value === tier).length]))).toEqual({ common: 24, uncommon: 22, rare: 25, "ultra-rare": 12, mythic: 1 });
    const totalMass = Object.values(COMPANION_TOY_WEIGHTS).reduce((sum, mass) => sum + mass, 0); expect(totalMass).toBe(38628880);
    for (const previous of [undefined, ...COMPANION_TOY_KINDS]) {
      const total = totalMass - (previous ? COMPANION_TOY_WEIGHTS[previous] : 0);
      let offset = 0, residual = total, chanceSum = 0;
      for (const kind of COMPANION_TOY_KINDS) {
        const mass = kind === previous ? 0 : COMPANION_TOY_WEIGHTS[kind];
        expect(companionToyChance(kind, previous)).toBeCloseTo(mass / total, 14); chanceSum += companionToyChance(kind, previous); residual -= mass;
        if (mass) for (const point of [offset + .25, offset + mass / 2, offset + mass - .25]) expect(randomCompanionToy(previous, () => point / total)).toBe(kind);
        offset += mass;
      }
      expect(offset).toBe(total); expect(residual).toBe(0); expect(chanceSum).toBeCloseTo(1, 12);
    }
    expect(companionToyChance("stud-brick-castle")).toBe(1800 / 38628880);
  });
});
