import { afterEach, describe, expect, it, vi } from "vitest";
import { advanceCompanionLife, createCompanionLife, experienceCompanionLife, getCompanionFoodPreference, normalizeCompanionLife, resetCompanionLife, summarizeCompanionLife, type CompanionLifeExperience } from "@/lib/ui/viewer-companion/life";
import { COMPANION_CARE_KEY, createCompanionCareStore, DEFAULT_COMPANION_CARE, loadCompanionCare, resetCompanionHabits, saveCompanionCare, subscribeCompanionHabits, subscribeCompanionLife } from "@/lib/ui/viewer-companion/care";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";

afterEach(() => vi.unstubAllGlobals());
const fresh = () => createCompanionLife(() => 0);
const earned = (life = fresh(), event: CompanionLifeExperience = { kind: "petted" }) => experienceCompanionLife(advanceCompanionLife(life, 18000), event);

describe("bounded device-local companion life", () => {
  it("draws one initial favorite and normalizes/resets without drawing again", () => {
    const rng = vi.fn(() => .7), life = createCompanionLife(rng);
    expect(rng).toHaveBeenCalledTimes(1); expect(life.favoriteFood).toBe("orange");
    expect(normalizeCompanionLife(JSON.parse(JSON.stringify(life)))).toEqual(life);
    const reset = resetCompanionLife(earned(life), 3);
    expect(reset.seedFood).toBe(life.seedFood); expect(reset.favoriteFood).toBe(life.seedFood); expect(reset.generation).toBe(3);
    expect(reset.social).toBe(.5); expect(rng).toHaveBeenCalledTimes(1);
  });

  it("allows a different fruit to overtake the initial preference after many real varied meals", () => {
    let life = fresh();
    const first = earned(life, { kind: "fed", food: "pear" });
    expect(first.favoriteFood).toBe("apple"); expect(first.foodScores.pear - life.foodScores.pear).toBeLessThan(.02);
    for (let index = 0; index < 60; index++) life = earned(life, { kind: "fed", food: index % 3 === 0 ? "lemon" : "pear" });
    // The less familiar fruit can win: variety is a real competing influence.
    expect(life.favoriteFood).toBe("lemon"); expect(life.recent).toContain("discovered-taste");
    expect(summarizeCompanionLife(life).favoriteLabel).toBe("레몬");
    // Another genuine preference can still emerge later; no initial/learned lock.
    for (let index = 0; index < 180; index++) life = earned(life, { kind: "fed", food: "strawberry" });
    expect(life.favoriteFood).toBe("strawberry");
  });

  it("diminishes repeated-food reward and recovers a food accident through active time", () => {
    const life = fresh(), familiar = normalizeCompanionLife({ ...life, familiarity: { apple: 1 } });
    const usual = earned(life, { kind: "fed", food: "apple" }), repeated = earned(familiar, { kind: "fed", food: "apple" });
    expect(repeated.foodScores.apple - familiar.foodScores.apple).toBeLessThan((usual.foodScores.apple - life.foodScores.apple) / 3);
    const accident = earned(life, { kind: "food-mishap", food: "apple" });
    expect(accident.foodScores.apple).toBeCloseTo(life.foodScores.apple, 4);
    expect(getCompanionFoodPreference(accident, "apple")).toBeLessThan(getCompanionFoodPreference(life, "apple"));
    let recovered = accident;
    for (let index = 0; index < 10; index++) recovered = advanceCompanionLife(recovered, 30000);
    expect(recovered.familiarity.apple).toBe(0); expect(recovered.foodScores.apple).toBeCloseTo(life.foodScores.apple, 4);
    expect(earned(accident).recent.at(-1)).toBe("reassured");
  });

  it("uses only bounded active time, has no absence debt and respects disabled learning", () => {
    const spent = earned();
    expect(experienceCompanionLife(spent, { kind: "played" })).toBe(spent);
    expect(advanceCompanionLife(spent, 0)).toBe(spent);
    expect(advanceCompanionLife(spent, 99 * 86400000)).toEqual(advanceCompanionLife(spent, 30000));
    expect(advanceCompanionLife(spent, 30000, false)).toBe(spent);
    expect(experienceCompanionLife(fresh(), { kind: "petted" }, false).social).toBe(.5);
    expect(normalizeCompanionLife(JSON.parse(JSON.stringify(spent)))).toEqual(spent);
    const active = advanceCompanionLife(fresh(), 30000);
    expect(active.curiosity).toBeGreaterThan(.5); expect(active.foodScores.pear).toBeGreaterThan(.5);
    expect(active.foodScores.pear - .5).toBeLessThan(.001);
  });

  it("retains food-record references through ordinary quarter-second budget samples", () => {
    let life = fresh();
    const scores = life.foodScores, familiarity = life.familiarity;
    for (let index = 0; index < 19; index++) {
      life = advanceCompanionLife(life, 250);
      expect(life.foodScores).toBe(scores); expect(life.familiarity).toBe(familiarity);
    }
    const changed = advanceCompanionLife(life, 250);
    expect(changed.foodScores).not.toBe(scores); expect(changed.familiarity).not.toBe(familiarity);
    expect(changed.noveltyCredit).toBeCloseTo(0, 10);
  });

  it("stores only finite food/trait numbers and four known reason enums", () => {
    const source = { ...fresh(), play: 4, curiosity: -3, social: NaN, credit: Infinity, recent: ["kind-touch", "identity-canary", "variety", "play-together", "rested", "food-mishap"], foodScores: { apple: 2, pear: -4, email: "identity-canary" }, account: "identity-canary", at: 1234, eventId: "schedule-canary" };
    const life = normalizeCompanionLife(source);
    expect(life.play).toBe(1); expect(life.curiosity).toBe(0); expect(life.social).toBe(.5);
    expect(life.foodScores.apple).toBe(1); expect(life.foodScores.pear).toBe(0); expect(life.recent).toHaveLength(4);
    expect(Object.keys(life.foodScores)).toEqual([...COMPANION_FOOD_KINDS]);
    expect(JSON.stringify(life)).not.toContain("canary"); expect(JSON.stringify(life)).not.toContain("1234");
    expect(source.play).toBe(4);
  });
});

describe("life persistence and reset safety", () => {
  it.each(["social", "play", "comfort", "curiosity"] as const)("notifies at the displayed low/high %s boundaries without notifying inside a category", trait => {
    const listener = vi.fn(), store = createCompanionCareStore(undefined, () => 0, () => 0, listener);
    let memory = store.load();
    memory = store.save({ ...memory, life: { ...memory.life, [trait]: .64 } }, true);
    listener.mockClear();

    const save = (value: number) => { memory = store.save({ ...memory, life: { ...memory.life, [trait]: value } }, true); };
    save(.649); expect(listener).not.toHaveBeenCalled();
    save(.65); expect(listener).toHaveBeenCalledTimes(1); expect(listener.mock.lastCall![0][trait]).toBe(.65);
    save(.674); expect(listener).toHaveBeenCalledTimes(1);
    save(.3501); expect(listener).toHaveBeenCalledTimes(2);
    save(.35); expect(listener).toHaveBeenCalledTimes(3); expect(listener.mock.lastCall![0][trait]).toBe(.35);
    save(.325); expect(listener).toHaveBeenCalledTimes(3);
    expect(store.load().life[trait]).toBe(.325);
  });

  it("publishes the actual repeated-petting experience that changes the visible social category", () => {
    let raw: string | null = null, now = 0;
    const listener = vi.fn(), storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    const store = createCompanionCareStore(storage, () => now, () => 0, listener), initial = store.load();
    let memory = store.save({ ...initial, life: { ...initial.life, social: .64, comfort: .85, recent: ["kind-touch"] } }, true);
    listener.mockClear();
    memory = store.save({ ...memory, life: experienceCompanionLife(memory.life, { kind: "petted" }) }, true);
    expect(memory.life.social).toBeCloseTo(.649); expect(listener).not.toHaveBeenCalled();
    now = 18000;
    memory = store.save({ ...memory, life: earned(memory.life) }, true);
    expect(memory.life.social).toBeCloseTo(.657775);
    expect(listener).toHaveBeenCalledTimes(1); expect(listener.mock.lastCall![0].social).toBe(memory.life.social);
    expect(memory.life.recent).toEqual(["kind-touch"]);
    expect(JSON.parse(raw!).life.social).toBe(memory.life.social);
  });

  it("migrates legacy needs once, saves a random seed before reload and preserves earned traits", () => {
    let raw: string | null = JSON.stringify({ version: 2, ...DEFAULT_COMPANION_CARE, hunger: .12, habits: { generation: 4, sociability: .3 } });
    const storage = { getItem: () => raw, setItem: vi.fn((_key: string, value: string) => { raw = value; }) }, rng = vi.fn(() => .7);
    const store = createCompanionCareStore(storage, () => 0, rng), initial = store.load();
    expect(initial.hunger).toBe(.12); expect(initial.habits.sociability).toBe(.3); expect(initial.life.generation).toBe(4);
    expect(JSON.parse(raw!).version).toBe(3); expect(storage.setItem).toHaveBeenCalledTimes(1);
    const learning = earned(initial.life), saved = store.save({ ...initial, life: learning }, true);
    const neverReroll = vi.fn(() => 0), reopened = createCompanionCareStore(storage, () => 90000000, neverReroll).load();
    expect(reopened).toEqual(saved); expect(neverReroll).not.toHaveBeenCalled(); expect(rng).toHaveBeenCalledTimes(1);
  });

  it("keeps a volatile seed/experience through denied storage and throttles attempts", () => {
    let now = 0;
    const storage = { getItem: () => { throw new Error("blocked"); }, setItem: vi.fn(() => { throw new Error("quota"); }) }, rng = vi.fn(() => .7);
    const store = createCompanionCareStore(storage, () => now, rng), initial = store.load();
    const learned = store.save({ ...initial, life: earned(initial.life) });
    for (now = 100; now < 5000; now += 100) store.save(learned);
    expect(store.load().life).toEqual(learned.life); expect(rng).toHaveBeenCalledTimes(1); expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it("rejects stale life after reset, preserves initial favorite, and returns deep copies", () => {
    const store = createCompanionCareStore(undefined, () => 0, () => .7), initial = store.load();
    const stale = store.save({ ...initial, life: earned(initial.life) }, true), reset = store.resetHabits();
    expect(reset.life.generation).toBe(1); expect(reset.life.favoriteFood).toBe(initial.life.seedFood);
    expect(store.save(stale, true).life).toEqual(reset.life);
    const copy = store.load(); copy.life.foodScores.apple = 0; copy.life.recent.push("food-mishap");
    expect(store.load().life).toEqual(reset.life);
  });

  it("preserves learned life through an older care-only tab's same-generation update", () => {
    let raw: string | null = null;
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } }, store = createCompanionCareStore(storage, () => 0, () => .7);
    const initial = store.load(), learned = store.save({ ...initial, life: earned(initial.life) }, true);
    raw = JSON.stringify({ version: 2, ...DEFAULT_COMPANION_CARE, hunger: .1, habits: learned.habits });
    expect(store.load().life).toEqual(learned.life); expect(store.load().hunger).toBe(.1);
  });

  it("shares sanitized changes in the same tab and counts one clear across both subscriptions", () => {
    const entries = new Map<string, string>();
    const target = Object.assign(new EventTarget(), { localStorage: { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } } });
    vi.stubGlobal("window", target);
    const lifeListener = vi.fn(), habitListener = vi.fn(), stopLife = subscribeCompanionLife(lifeListener), stopHabit = subscribeCompanionHabits(habitListener);
    const initial = loadCompanionCare();
    saveCompanionCare({ ...initial, life: earned(initial.life) });
    expect(lifeListener).toHaveBeenCalledTimes(1); expect(lifeListener.mock.calls[0][0].recent).toContain("kind-touch");
    saveCompanionCare({ ...loadCompanionCare(), life: advanceCompanionLife(loadCompanionCare().life, 250) });
    expect(lifeListener).toHaveBeenCalledTimes(1);
    resetCompanionHabits(); expect(lifeListener).toHaveBeenCalledTimes(2); expect(habitListener).toHaveBeenCalledTimes(1);
    entries.clear(); target.dispatchEvent(Object.assign(new Event("storage"), { key: COMPANION_CARE_KEY, newValue: null }));
    expect(loadCompanionCare().habits.generation).toBe(2); expect(loadCompanionCare().life.generation).toBe(2);
    expect(lifeListener.mock.lastCall![0].generation).toBe(2); expect(habitListener.mock.lastCall![0].generation).toBe(2);
    stopLife(); stopHabit();
  });
});
