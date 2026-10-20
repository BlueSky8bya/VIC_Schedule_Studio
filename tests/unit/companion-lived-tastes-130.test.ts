import { describe, expect, it, vi } from "vitest";
import { advanceCompanionLife, createCompanionLife, experienceCompanionLife, normalizeCompanionLife } from "@/lib/ui/viewer-companion/life";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_TOY_KINDS } from "@/lib/ui/viewer-companion/toy-catalog";
import { COMPANION_TASTES_MAX_BYTES, companionTasteReason, createCompanionTastesStore, normalizeCompanionTastes, summarizeCompanionFoodTastes, summarizeCompanionToyTastes } from "@/lib/ui/viewer-companion/toy-tastes";
import { evaluateCompanionFoodTaste, isCompanionFoodTasteOutcome } from "@/lib/ui/viewer-companion/taste-reasons";
import { sanitizeMeta, sanitizeTarget } from "@/lib/activity/kinds";

describe("130 bounded lived taste impressions", () => {
  it("shares one consumed durian impression without inventing a reason for legacy data or the seed preference", () => {
    const store = createCompanionTastesStore(), initial = createCompanionLife(() => 0);
    const legacy = normalizeCompanionTastes({ version: 1, toys: ["ball"], seen: ["ball"], toyTastes: { ball: { accepted: 3, declined: 4, score: -.8 } } });
    expect(legacy.toys).toEqual(["ball"]); expect(legacy.seen).toEqual(["ball"]); expect(legacy.reasons).toEqual([]);
    expect(companionTasteReason(legacy, "toy", "ball")).toBeUndefined(); expect(summarizeCompanionToyTastes(legacy).disliked).toBeNull();
    expect(summarizeCompanionFoodTastes(store.load(), initial).favorite).toBe(initial.seedFood);
    const outcome = evaluateCompanionFoodTaste("durian", initial, 0);
    expect(outcome).toEqual({ food: "durian", reaction: "disliked", reason: "durian-socks" });
    const life = experienceCompanionLife(initial, { kind: "fed", food: "durian", taste: outcome }); store.recordFoodOutcome(outcome);
    expect(summarizeCompanionFoodTastes(store.load(), life, [])).toMatchObject({ disliked: null });
    expect(summarizeCompanionFoodTastes(store.load(), life, ["durian"])).toMatchObject({ disliked: "durian" });
    expect(companionTasteReason(store.load(), "food", "durian")).toBe("주인 양말 냄새남");
    expect(initial.tastedFoods).toEqual([]); expect(life.tastedFoods).toEqual(["durian"]);
  });

  it("lets a delicious real meal replace a favorite immediately while preserving spent trait credit", () => {
    const initial = { ...createCompanionLife(() => 0), credit: 0 }, outcome = evaluateCompanionFoodTaste("peach", initial, 1);
    const next = experienceCompanionLife(initial, { kind: "fed", food: "peach", taste: outcome });
    expect(outcome.reaction).toBe("delighted"); expect(next.favoriteFood).toBe("peach"); expect(next.credit).toBe(0);
    for (const field of ["play", "comfort", "social", "curiosity"] as const) expect(next[field]).toBe(initial[field]);
    expect(next.foodScores.peach).toBeGreaterThan(next.foodScores[initial.favoriteFood]);
    expect(experienceCompanionLife(initial, { kind: "fed", food: "peach", taste: outcome }, false)).toBe(initial);
    expect(experienceCompanionLife(initial, { kind: "fed", food: "apple", taste: outcome })).toBe(initial);
    expect(isCompanionFoodTasteOutcome({ ...outcome, reason: "private-canary" })).toBe(false);
  });

  it("does not turn refusal, fullness, an unconsumed food or toy tidying into a new aversion", () => {
    const store = createCompanionTastesStore(), initial = createCompanionLife(() => 0);
    const familiar = { ...initial, familiarity: { ...initial.familiarity, peach: .9 } };
    const refused = experienceCompanionLife(familiar, { kind: "food-declined", food: "peach" });
    expect(refused.foodScores).toEqual(familiar.foodScores); expect(store.recordFood("peach", "declined")).toBe(false);
    store.recordToy("ball", "tidied"); store.recordToy("ball", "declined");
    expect(store.load().toyTastes).toEqual({}); expect(store.load().reasons).toEqual([]);
    expect(summarizeCompanionFoodTastes(store.load(), initial, ["peach"]).disliked).toBeNull();
  });

  it("does not replace a disliked seed with an uneaten default food, and does not put a negative reason on a favorite card", () => {
    const store = createCompanionTastesStore(), seed = createCompanionLife(() => 0);
    const initial = { ...seed, seedFood: "durian" as const, favoriteFood: "durian" as const, foodScores: { ...seed.foodScores, durian: .62 } }, bad = evaluateCompanionFoodTaste("durian", initial, 0);
    const life = experienceCompanionLife(initial, { kind: "fed", food: "durian", taste: bad }); store.recordFoodOutcome(bad);
    expect(normalizeCompanionLife(life).favoriteFood).toBe("durian");
    expect(summarizeCompanionFoodTastes(store.load(), life, ["durian"])).toEqual({ favorite: null, disliked: "durian" });
    expect(companionTasteReason(store.load(), "food", "durian", "positive")).toBeUndefined();
    expect(companionTasteReason(store.load(), "food", "durian", "negative")).toBe("주인 양말 냄새남");
  });

  it("never invents an ordinary apple or bread aversion, including legacy vague reasons", () => {
    const life = createCompanionLife(() => 0), store = createCompanionTastesStore();
    for (const food of ["apple", "bread"] as const) for (const roll of [0, .01, .2, .5, 1, NaN]) {
      const outcome = evaluateCompanionFoodTaste(food, life, roll);
      expect(outcome.reaction).not.toBe("disliked"); expect(isCompanionFoodTasteOutcome(outcome)).toBe(true);
    }
    expect(new Set(COMPANION_FOOD_KINDS.filter(food => evaluateCompanionFoodTaste(food, life, 0).reaction === "disliked"))).toEqual(new Set(["durian", "lemon", "grapefruit", "yuzu", "kumquat", "kiwi", "pineapple", "broccoli", "bell-pepper", "eggplant", "cabbage", "curry", "coconut"]));
    for (const reason of ["texture-surprise", "durian-socks", undefined]) {
      const invalid = { food: "apple" as const, reaction: "disliked" as const, reason };
      expect(isCompanionFoodTasteOutcome(invalid)).toBe(false);
      expect(store.recordFoodOutcome(invalid as Parameters<typeof store.recordFoodOutcome>[0])).toBe(false);
    }
    expect(store.load().foodTastes).toEqual({});
    expect(normalizeCompanionTastes({ version: 1, reasons: [{ domain: "food", kind: "apple", reason: "texture-surprise", age: 0 }] }).reasons).toEqual([]);
  });

  it("uses concrete polarizing flavours, with durian strongest but still capable of becoming a favorite", () => {
    const initial = createCompanionLife(() => 0), counts = new Map<string, number>();
    for (const food of ["durian", "lemon", "broccoli", "curry", "coconut"] as const) {
      const bad = evaluateCompanionFoodTaste(food, initial, 0), good = evaluateCompanionFoodTaste(food, initial, 1);
      expect(bad.reaction).toBe("disliked"); expect(isCompanionFoodTasteOutcome(bad)).toBe(true);
      expect(good.reaction).toBe("delighted"); expect(isCompanionFoodTasteOutcome(good)).toBe(true);
      counts.set(food, Array.from({ length: 1000 }, (_, i) => evaluateCompanionFoodTaste(food, initial, i / 1000)).filter(outcome => outcome.reaction === "disliked").length);
    }
    expect(evaluateCompanionFoodTaste("lemon", initial, 0).reason).toBe("sharp-sour");
    expect(evaluateCompanionFoodTaste("broccoli", initial, 0).reason).toBe("green-bitter");
    expect(evaluateCompanionFoodTaste("curry", initial, 0).reason).toBe("spicy-tickle");
    expect(evaluateCompanionFoodTaste("coconut", initial, 0).reason).toBe("strong-aroma");
    expect(counts.get("durian")!).toBeGreaterThan(Math.max(...[...counts].filter(([kind]) => kind !== "durian").map(([, count]) => count)));
    const life = experienceCompanionLife(initial, { kind: "fed", food: "durian", taste: evaluateCompanionFoodTaste("durian", initial, 1) });
    expect(life.favoriteFood).toBe("durian");
  });

  it("keeps learning OFF and malformed outcomes from creating evidence while real toy discovery remains separate", () => {
    const store = createCompanionTastesStore(), taste = evaluateCompanionFoodTaste("durian", createCompanionLife(() => 0), 0);
    expect(store.recordFoodOutcome(taste, false)).toBe(false);
    expect(store.recordFoodOutcome({ ...taste, food: "apple" })).toBe(false);
    store.recordToy("ball", "tripped", false);
    expect(store.load().toys).toEqual([]);
    store.recordToy("ball", "played", false);
    expect(store.load().toys).toEqual(["ball"]); expect(store.load().toyTastes).toEqual({}); expect(store.load().foodTastes).toEqual({}); expect(store.load().reasons).toEqual([]);
    const before = store.load(); for (const delta of [0, -1, NaN, Infinity]) expect(store.advanceActive(delta)).toBe(false);
    expect(store.load()).toEqual(before);
  });

  it("requires a witnessed trip for toy dislike and later real play recovers it and can change the favorite", () => {
    const store = createCompanionTastesStore(); store.recordToy("ball", "played"); store.recordToy("ball", "played");
    expect(summarizeCompanionToyTastes(store.load()).favorite).toBe("ball");
    store.recordToy("ball", "tripped"); expect(summarizeCompanionToyTastes(store.load()).disliked).toBe("ball");
    store.recordToy("ball", "tripped"); expect(summarizeCompanionToyTastes(store.load()).disliked).toBe("ball");
    expect(companionTasteReason(store.load(), "toy", "ball")).toBe("동그란 장난감에 발이 걸렸어요");
    store.recordToy("ball", "played"); expect(summarizeCompanionToyTastes(store.load()).disliked).toBeNull();
    store.recordToy("feather", "played"); store.recordToy("feather", "played");
    expect(summarizeCompanionToyTastes(store.load()).favorite).toBe("feather");
    expect(companionTasteReason(store.load(), "toy", "feather")).toBe("가볍게 살랑이는 게 좋아요");
  });

  it("forgets through supplied active buckets only, without reads at each needs sample or elapsed-away debt", () => {
    let raw: string | null = null;
    const disk = { getItem: vi.fn(() => raw), setItem: vi.fn((_key: string, value: string) => { raw = value; }) };
    const store = createCompanionTastesStore(disk); store.recordToy("ball", "played", false); store.recordToy("ball", "tripped"); store.acknowledge("ball");
    const original = store.load(); disk.getItem.mockClear(); disk.setItem.mockClear();
    for (let i = 0; i < 19; i++) expect(store.advanceActive(250)).toBe(false);
    expect(disk.getItem).not.toHaveBeenCalled(); expect(disk.setItem).not.toHaveBeenCalled();
    expect(store.advanceActive(250)).toBe(true); expect(disk.getItem).not.toHaveBeenCalled();
    expect(store.load().toyTastes.ball!.score).toBeGreaterThan(original.toyTastes.ball!.score);
    const paused = store.load(); expect(store.advanceActive(3_600_000, false)).toBe(false); expect(store.load()).toEqual(paused);
    for (let i = 0; i < 240; i++) store.advanceActive(5000);
    expect(summarizeCompanionToyTastes(store.load()).disliked).toBeNull(); expect(store.load().reasons).toEqual([]);
    expect(store.load().toys).toEqual(["ball"]); expect(store.load().seen).toEqual(["ball"]);
    const reloaded = createCompanionTastesStore(disk); expect(reloaded.load()).toEqual(store.load());
    const beforeLong = reloaded.load(); reloaded.advanceActive(3_600_000);
    expect(reloaded.load().reasons).toEqual(beforeLong.reasons); // One supplied sample is capped to30 active seconds.
  });

  it("softens a tasted food through existing life buckets, and a later delicious bite can reverse its dislike", () => {
    const initial = createCompanionLife(() => 0), dislike = evaluateCompanionFoodTaste("durian", initial, 0);
    let life = experienceCompanionLife(initial, { kind: "fed", food: "durian", taste: dislike });
    const before = life; expect(advanceCompanionLife(life, 5000, false)).toBe(life);
    for (let i = 0; i < 360; i++) life = advanceCompanionLife(life, 5000);
    expect(life.foodScores.durian).toBeGreaterThan(.35); expect(before.foodScores.durian).toBeLessThan(.35);
    const positive = evaluateCompanionFoodTaste("durian", life, 1);
    life = experienceCompanionLife({ ...life, credit: 0 }, { kind: "fed", food: "durian", taste: positive });
    expect(life.favoriteFood).toBe("durian"); expect(life.foodScores.durian).toBeGreaterThan(.7);
  });

  it("bounds all300 catalogue entries plus eight reasons below the explicit24KiB UTF-8 parse limit", () => {
    expect(COMPANION_FOOD_KINDS.length + COMPANION_TOY_KINDS.length).toBe(300);
    const record = { score: -.123456789, accepted: 31, declined: 31, tripped: 31, freeText: "private-canary", instanceId: "toy-999" };
    const value = normalizeCompanionTastes({ version: 1, toys: COMPANION_TOY_KINDS, seen: COMPANION_TOY_KINDS,
      toyTastes: Object.fromEntries(COMPANION_TOY_KINDS.map(kind => [kind, record])), foodTastes: Object.fromEntries(COMPANION_FOOD_KINDS.map(kind => [kind, record])),
      reasons: COMPANION_TOY_KINDS.map(kind => ({ domain: "toy", kind, reason: "toy-trip", age: 239, account: "private-canary" })), owner: "private-canary", at: Date.now() });
    const raw = JSON.stringify(value); expect(Buffer.byteLength(raw, "utf8")).toBeLessThanOrEqual(COMPANION_TASTES_MAX_BYTES); expect(raw.length).toBeLessThanOrEqual(COMPANION_TASTES_MAX_BYTES);
    expect(raw).not.toContain("private-canary"); expect(raw).not.toContain("toy-999"); expect(value.reasons).toHaveLength(8);
    expect(value.toyTastes.ball!.score).toBe(-.1235);
    const restored = createCompanionTastesStore({ getItem: () => raw, setItem: vi.fn() }).load(); expect(restored).toEqual(value);
    expect(normalizeCompanionLife({ ...createCompanionLife(() => 0), tastedFoods: ["durian", "durian", "private-canary"] }).tastedFoods).toEqual(["durian"]);
    expect(sanitizeTarget("companion-profile-page#durian")).toBe("companion-profile-page");
    expect(sanitizeMeta({ target: "companion-profile-page#together", food: "durian", reason: "durian-socks", taste: -1 })).toBeNull();
  });
});
