import { describe, expect, it } from "vitest";
import { advanceCompanionHabits, DEFAULT_COMPANION_HABITS, learnCompanionHabits, normalizeCompanionHabits, type CompanionExperience, type CompanionHabits } from "@/lib/ui/viewer-companion/habits";

const fresh = (): CompanionHabits => ({ ...DEFAULT_COMPANION_HABITS });
const repeat = (experience: CompanionExperience, count: number, initial = fresh()) => {
  let habits = initial;
  for (let index = 0; index < count; index++) habits = learnCompanionHabits(advanceCompanionHabits(habits, 18000), experience);
  return habits;
};

describe("slow, earned companion habits", () => {
  it("starts neutral with one earned-interaction credit and a frozen default", () => {
    expect(DEFAULT_COMPANION_HABITS).toEqual({ sociability: 0, playfulness: 0, confidence: 0, credit: 1, generation: 0 });
    expect(Object.isFrozen(DEFAULT_COMPANION_HABITS)).toBe(true);
    expect(normalizeCompanionHabits(undefined)).toEqual(DEFAULT_COMPANION_HABITS);
  });

  it("changes gradually across repeated acknowledged experiences, rather than replacing personality at once", () => {
    const once = repeat("petted", 1), fifty = repeat("petted", 50);
    expect(once).toEqual({ sociability: .035, playfulness: .00525, confidence: .028000000000000004, credit: 0, generation: 0 });
    expect(fifty.sociability).toBeGreaterThan(.8); expect(fifty.sociability).toBeLessThan(.9);
    expect(fifty.sociability).toBeGreaterThan(once.sociability * 10);
    expect(fifty.confidence).toBeGreaterThan(.6); expect(fifty.confidence).toBeLessThan(.8);
    expect(fifty.playfulness).toBeLessThan(.15);
  });

  it.each([
    ["petted", { sociability: 1, playfulness: .15, confidence: .8 }],
    ["fed", { sociability: .65, playfulness: .1, confidence: .9 }],
    ["played", { sociability: .4, playfulness: 1, confidence: .8 }],
    ["bonked", { sociability: -.4, playfulness: -.25, confidence: -1 }],
  ] as const)("applies the small %s signal once and consumes its full credit", (experience, signal) => {
    const source = fresh(), learned = learnCompanionHabits(source, experience);
    expect(learned.credit).toBe(0);
    for (const trait of ["sociability", "playfulness", "confidence"] as const) expect(learned[trait]).toBeCloseTo(signal[trait] * .035, 14);
    expect(source).toEqual(DEFAULT_COMPANION_HABITS);
    expect(learned).not.toBe(source);
  });

  it("does not learn again from input spam, partial credit, autonomous vocabulary or disabled learning", () => {
    const learned = learnCompanionHabits(fresh(), "petted");
    for (let index = 0; index < 1000; index++) expect(learnCompanionHabits(learned, index % 2 ? "played" : "bonked")).toBe(learned);
    const partial = advanceCompanionHabits(learned, 17999);
    expect(learnCompanionHabits(partial, "fed")).toBe(partial);
    const ready = fresh();
    expect(learnCompanionHabits(ready, "petted", false)).toBe(ready);
    for (const invalid of ["landed", "rested", "food-lost", "heart-blocked", "toString", "__proto__"]) expect(learnCompanionHabits(ready, invalid as CompanionExperience)).toBe(ready);
  });

  it("replenishes only credit through supplied enabled active time and clamps each elapsed sample", () => {
    const spent = learnCompanionHabits(fresh(), "played"), half = advanceCompanionHabits(spent, 9000);
    expect(half).toEqual({ ...spent, credit: .5 });
    expect(advanceCompanionHabits(half, 9000)).toEqual({ ...spent, credit: 1 });
    expect(advanceCompanionHabits(spent, 30 * 86400_000)).toEqual({ ...spent, credit: 1 });
    expect(advanceCompanionHabits(spent, 30 * 86400_000, false)).toBe(spent);
    expect(advanceCompanionHabits(fresh(), 9000).credit).toBe(1);
    for (const invalid of [-1, -Infinity, Infinity, NaN, 0]) expect(advanceCompanionHabits(spent, invalid)).toBe(spent);
    expect(spent.credit).toBe(0);
  });

  it("preserves earned traits and spent credit through normalization/reload without an absence penalty or free refill", () => {
    const trained = advanceCompanionHabits(repeat("fed", 12), 4500);
    const reopened = normalizeCompanionHabits(JSON.parse(JSON.stringify(trained)));
    expect(reopened).toEqual(trained); expect(reopened.credit).toBe(.25);
    expect(learnCompanionHabits(reopened, "fed")).toBe(reopened);
    expect(advanceCompanionHabits(reopened, 0)).toBe(reopened);
    expect(Object.keys(reopened).sort()).toEqual(["confidence", "credit", "generation", "playfulness", "sociability"]);
  });

  it("can recover through later friendly experiences instead of permanently assigning a fearful personality", () => {
    const wary = repeat("bonked", 50), recovering = repeat("petted", 50, wary);
    expect(wary.confidence).toBeLessThan(-.8); expect(wary.sociability).toBeLessThan(-.3);
    expect(recovering.confidence).toBeGreaterThan(.5); expect(recovering.sociability).toBeGreaterThan(.7);
    expect(wary.confidence).toBeLessThan(0);
  });

  it("allowlists finite bounded fields, strips metadata, and never mutates source or learned values", () => {
    const source = { sociability: -4, playfulness: 7, confidence: NaN, credit: .4, email: "identity-canary", title: "schedule-canary", id: "event-canary", at: 1234 };
    const normalized = normalizeCompanionHabits(source);
    expect(normalized).toEqual({ sociability: -1, playfulness: 1, confidence: 0, credit: .4, generation: 0 });
    expect(JSON.stringify(normalized)).not.toContain("canary");
    expect(source.credit).toBe(.4); expect(source.confidence).toBeNaN();
    for (const invalid of [null, [], "bad", 5, { sociability: Infinity, confidence: "1", credit: -Infinity }]) expect(normalizeCompanionHabits(invalid)).toEqual(DEFAULT_COMPANION_HABITS);
    expect(normalizeCompanionHabits({ credit: -1 }).credit).toBe(0);
    expect(normalizeCompanionHabits({ credit: 3 }).credit).toBe(1);
    const frozen = Object.freeze(fresh());
    expect(() => learnCompanionHabits(frozen, "fed")).not.toThrow();
    expect(() => advanceCompanionHabits(Object.freeze({ ...frozen, credit: 0 }), 250)).not.toThrow();
    const clean = learnCompanionHabits(source as unknown as CompanionHabits, "petted");
    expect(Object.keys(clean).sort()).toEqual(["confidence", "credit", "generation", "playfulness", "sociability"]);
  });

  it("bounds the maximum accepted trait step and leaves saturated no-op credit stable", () => {
    for (const initial of [-1, 0, 1]) for (const experience of ["petted", "fed", "played", "bonked"] as const) {
      const source = { sociability: initial, playfulness: initial, confidence: initial, credit: 1, generation: 0 };
      const learned = learnCompanionHabits(source, experience);
      for (const trait of ["sociability", "playfulness", "confidence"] as const) {
        expect(Number.isFinite(learned[trait])).toBe(true);
        expect(learned[trait]).toBeGreaterThanOrEqual(-1); expect(learned[trait]).toBeLessThanOrEqual(1);
        expect(Math.abs(learned[trait] - source[trait])).toBeLessThanOrEqual(.07 + Number.EPSILON);
      }
      expect(advanceCompanionHabits(source, 250)).toBe(source);
    }
    expect(learnCompanionHabits({ ...fresh(), credit: 1 - 5e-10 }, "petted").credit).toBe(0);
    const insufficient = { ...fresh(), credit: 1 - 2e-9 };
    expect(learnCompanionHabits(insufficient, "petted")).toBe(insufficient);
  });

  it("preserves only a valid local reset generation through earning, budget recovery and reload", () => {
    for (const generation of [0, 1, 17, Number.MAX_SAFE_INTEGER]) {
      const source = { ...fresh(), generation };
      const learned = learnCompanionHabits(source, "petted");
      expect(learned.generation).toBe(generation);
      const replenished = advanceCompanionHabits(learned, 18000);
      expect(replenished.generation).toBe(generation);
      expect(normalizeCompanionHabits(JSON.parse(JSON.stringify(replenished)))).toEqual(replenished);
      expect(learnCompanionHabits(source, "bonked", false)).toBe(source);
    }
    for (const generation of [-1, .5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, "7", null]) {
      expect(normalizeCompanionHabits({ ...fresh(), generation }).generation).toBe(0);
    }
    expect(normalizeCompanionHabits({ sociability: .2, credit: .3 })).toEqual({ ...fresh(), sociability: .2, credit: .3 });
  });
});
