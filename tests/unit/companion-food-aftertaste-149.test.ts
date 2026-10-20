import { describe, expect, it } from "vitest";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_FOOD_AFTERTASTES, createCompanionFoodAftertaste, sampleCompanionFoodAftertaste } from "@/lib/ui/viewer-companion/food-aftertaste";

describe("actual consumed unusual-food aftertaste", () => {
  it("admits only four unusual recipes and durian after a successful real consume ACK", () => {
    const event = createCompanionFoodAftertaste(), admitted = [];
    for (const food of COMPANION_FOOD_KINDS) {
      const response = event.consume({ foodId: `real-${food}`, food, consumed: true }, true);
      if (response) { admitted.push(food); expect(response.food).toBe(food); expect(response.duration).toBeLessThan(2500); }
    }
    expect(admitted.sort()).toEqual(Object.keys(COMPANION_FOOD_AFTERTASTES).sort());
    expect(admitted).toHaveLength(5);
    expect(COMPANION_FOOD_AFTERTASTES.durian).toBe("cough");
    expect(COMPANION_FOOD_AFTERTASTES["cricket-pepero"]).toBe("retch");
    for (const food of ["kkak-kong-soup", "birthday-seaweed-soup", "pepero", "frozen-leftover-pizza", "frozen-leftover-tteokbokki"] as const) expect(event.consume({ foodId: `another-${food}`, food, consumed: true }, true)).toBeUndefined();
  });

  it("does not react to a spawn, inspection, refusal, failed consume, fake kind or empty identity", () => {
    const event = createCompanionFoodAftertaste();
    for (const food of Object.keys(COMPANION_FOOD_AFTERTASTES)) expect(event.consume({ foodId: food, food, consumed: false }, true)).toBeUndefined();
    expect(event.consume({ foodId: "private-canary", food: "not-a-food", consumed: true }, true)).toBeUndefined();
    expect(event.consume({ foodId: " ", food: "durian", consumed: true }, true)).toBeUndefined();
    expect(event.consume({ foodId: "durian", food: "durian", consumed: true }, true)?.kind).toBe("cough");
  });

  it("deduplicates a real meal and never replays a suppressed meal after returning from OFF or a hidden tab", () => {
    const event = createCompanionFoodAftertaste(), receipt = { foodId: "one-real-meal", food: "herb-avocado-milk", consumed: true };
    expect(event.consume(receipt, true)?.kind).toBe("retch"); expect(event.consume(receipt, true)).toBeUndefined();
    const quiet = { ...receipt, foodId: "quiet-real-meal" };
    expect(event.consume(quiet, false)).toBeUndefined(); expect(event.consume(quiet, true)).toBeUndefined();
    expect(event.consume({ ...receipt, foodId: "another-real-meal" }, true)?.kind).toBe("retch");
  });

  it("uses finite existing strained/recover art with no residual motion at either end or under quiet motion", () => {
    for (const kind of ["cough", "retch"] as const) {
      const phases = new Set<string>();
      let contractions = 0, wasContracting = false;
      for (let index = 0; index <= 500; index++) {
        const sample = sampleCompanionFoodAftertaste(kind, index / 500);
        expect(Object.entries(sample).filter(([, value]) => typeof value === "number").every(([, value]) => Number.isFinite(value))).toBe(true);
        expect([0, 23]).toContain(sample.row); expect(sample.phase).toBeGreaterThanOrEqual(0); expect(sample.phase).toBeLessThanOrEqual(1);
        expect(sample.compression).toBeLessThanOrEqual(.055); expect(Math.abs(sample.shift)).toBeLessThanOrEqual(2.5); expect(Math.abs(sample.lean)).toBeLessThan(13);
        const contracting = sample.puff > .05; if (contracting && !wasContracting) contractions++; wasContracting = contracting; phases.add(sample.beat);
      }
      expect(phases).toEqual(new Set([kind, "recover"])); expect(contractions).toBeGreaterThanOrEqual(2); expect(contractions).toBeLessThanOrEqual(3);
      for (const p of [0, 1, -1, 2, Number.NaN, Infinity]) {
        const sample = sampleCompanionFoodAftertaste(kind, p);
        expect([sample.row, sample.lift, sample.lean, sample.shift, sample.compression, sample.puff]).toEqual([0, 0, 0, 0, 0, 0]);
      }
      expect(sampleCompanionFoodAftertaste(kind, .4, true)).toEqual(sampleCompanionFoodAftertaste(kind, 0));
    }
  });
});
