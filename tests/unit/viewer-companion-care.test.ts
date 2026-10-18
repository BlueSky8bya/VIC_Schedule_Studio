import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMPANION_CARE_KEY, COMPANION_HABITS_EVENT, DEFAULT_COMPANION_CARE, DEFAULT_COMPANION_MEMORY, createCompanionCareStore, loadCompanionCare, normalizeCompanionCare, resetCompanionHabits, saveCompanionCare, subscribeCompanionHabits } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_HABITS, learnCompanionHabits } from "@/lib/ui/viewer-companion/habits";
import { DEFAULT_COMPANION_LIFE } from "@/lib/ui/viewer-companion/life";

beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const learned = { sociability: .3, playfulness: .1, confidence: -.2, credit: .4, generation: 0 };
const neutral = (generation = 1) => ({ ...DEFAULT_COMPANION_HABITS, generation });

describe("private device-only companion care storage", () => {
  it("allows only finite needs and clamps their range", () => {
    expect(normalizeCompanionCare({ hunger: 20, affection: -5, energy: NaN, curiosity: "1", email: "canary@example.invalid" }))
      .toEqual({ hunger: 1, affection: 0, energy: DEFAULT_COMPANION_CARE.energy, curiosity: DEFAULT_COMPANION_CARE.curiosity });
    expect(normalizeCompanionCare(null)).toEqual(DEFAULT_COMPANION_CARE);
  });

  it("persists needs and allowlisted habits without identity, schedule text or absence timestamps", () => {
    let raw: string | null = null;
    const storage = { getItem: vi.fn(() => raw), setItem: vi.fn((_key: string, value: string) => { raw = value; }) };
    const store = createCompanionCareStore(storage, () => 0);
    store.save({ ...DEFAULT_COMPANION_MEMORY, title: "sensitive-schedule-canary", email: "identity-canary", habits: { ...learned, account: "nested-identity-canary", title: "nested-schedule-canary", eventId: "nested-event-canary", input: ["gesture-canary"], lastAt: 1234 }, life: { ...DEFAULT_COMPANION_LIFE, account: "life-identity-canary", foodScores: { ...DEFAULT_COMPANION_LIFE.foodScores, title: "life-schedule-canary" } } } as typeof DEFAULT_COMPANION_MEMORY);
    expect(storage.setItem.mock.calls[0][0]).toBe(COMPANION_CARE_KEY);
    expect(Object.keys(JSON.parse(raw!)).sort()).toEqual(["affection", "curiosity", "energy", "habits", "hunger", "life", "version"]);
    expect(Object.keys(JSON.parse(raw!).habits).sort()).toEqual(["confidence", "credit", "generation", "playfulness", "sociability"]);
    expect(JSON.parse(raw!).version).toBe(3);
    expect(raw).not.toContain("canary");
    const reopened = createCompanionCareStore(storage, () => 86400000);
    expect(reopened.load()).toEqual({ ...DEFAULT_COMPANION_MEMORY, habits: learned });
  });

  it("throttles active saves and can force an immediate feeding flush", () => {
    let now = 0, raw: string | null = null;
    const storage = { getItem: () => raw, setItem: vi.fn((_key: string, value: string) => { raw = value; }) };
    const store = createCompanionCareStore(storage, () => now);
    store.save({ ...DEFAULT_COMPANION_CARE, hunger: .6 });
    now = 1000; store.save({ ...DEFAULT_COMPANION_CARE, hunger: .2 });
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(store.load().hunger).toBe(.2);
    store.save({ ...DEFAULT_COMPANION_CARE, hunger: .1 }, true);
    expect(storage.setItem).toHaveBeenCalledTimes(2);
    expect(JSON.parse(raw!).hunger).toBe(.1);
    now = 6000; store.save({ ...DEFAULT_COMPANION_CARE, hunger: .11 });
    expect(storage.setItem).toHaveBeenCalledTimes(3);
  });

  it("retains the last meal through write quota failures and retries later", () => {
    let fail = true, now = 0;
    let raw: string | null = JSON.stringify({ version: 1, ...DEFAULT_COMPANION_CARE });
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { if (fail) throw new Error("quota"); raw = value; } };
    const store = createCompanionCareStore(storage, () => now);
    store.load(); store.save({ ...DEFAULT_COMPANION_CARE, hunger: .2 }, true);
    expect(store.load().hunger).toBe(.2);
    fail = false; now = 1000; store.save(store.load(), true);
    expect(JSON.parse(raw!).hunger).toBe(.2);
    raw = null;
    expect(store.load()).toEqual({ ...DEFAULT_COMPANION_MEMORY, habits: neutral(), life: { ...DEFAULT_COMPANION_LIFE, generation: 1 } });
  });

  it("throttles failed ordinary write attempts while preserving force and memory", () => {
    let now = 0;
    const storage = { getItem: () => JSON.stringify({ version: 1, ...DEFAULT_COMPANION_CARE }), setItem: vi.fn(() => { throw new Error("quota"); }) };
    const store = createCompanionCareStore(storage, () => now);
    store.load(); store.save({ ...DEFAULT_COMPANION_CARE, hunger: .2 });
    for (now = 50; now < 5000; now += 50) store.save({ ...DEFAULT_COMPANION_CARE, hunger: .21 });
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(store.load().hunger).toBe(.21);
    now = 5000; store.save(store.load());
    expect(storage.setItem).toHaveBeenCalledTimes(2);
    now = 5001; store.save({ ...DEFAULT_COMPANION_CARE, hunger: .1 }, true);
    expect(storage.setItem).toHaveBeenCalledTimes(3);
    expect(store.load().hunger).toBe(.1);
  });

  it("works with blocked or absent storage and rejects unknown stored versions", () => {
    const blocked = createCompanionCareStore({ getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    blocked.save({ ...DEFAULT_COMPANION_CARE, hunger: .2 }, true);
    expect(blocked.load().hunger).toBe(.2);
    const memory = createCompanionCareStore();
    memory.save({ ...DEFAULT_COMPANION_CARE, hunger: .1 });
    expect(memory.load().hunger).toBe(.1);
    for (const raw of ["{", "[]", JSON.stringify({ version: 99, hunger: .1 })]) {
      expect(createCompanionCareStore({ getItem: () => raw, setItem: () => {} }).load()).toEqual(DEFAULT_COMPANION_MEMORY);
    }
  });

  it("migrates version1 needs to neutral habits and preserves version2 habits for legacy care-only callers", () => {
    let raw = JSON.stringify({ version: 1, ...DEFAULT_COMPANION_CARE, hunger: .2, habits: learned });
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    const old = createCompanionCareStore(storage, () => 0);
    expect(old.load()).toEqual({ ...DEFAULT_COMPANION_MEMORY, hunger: .2, habits: DEFAULT_COMPANION_HABITS });
    old.save({ ...DEFAULT_COMPANION_CARE, hunger: .3 }, true);
    expect(JSON.parse(raw)).toEqual({ version: 3, ...DEFAULT_COMPANION_MEMORY, hunger: .3, habits: DEFAULT_COMPANION_HABITS });
    raw = JSON.stringify({ version: 2, ...DEFAULT_COMPANION_CARE, habits: learned });
    const current = createCompanionCareStore(storage, () => 0);
    // No load is required before an old caller saves four needs.
    expect(current.save({ ...DEFAULT_COMPANION_CARE, hunger: .1 }, true)).toEqual({ ...DEFAULT_COMPANION_MEMORY, hunger: .1, habits: learned });
    expect(current.save({ ...DEFAULT_COMPANION_CARE, habits: undefined }, true).habits).toEqual(learned);
    expect(JSON.parse(raw).habits).toEqual(learned);
  });

  it("rejects malformed versions and sanitizes bounded version2 habits without mutating inputs", () => {
    for (const raw of ["{", "[]", "null", JSON.stringify({ ...DEFAULT_COMPANION_CARE, habits: learned }), JSON.stringify({ version: 99, ...DEFAULT_COMPANION_CARE, habits: learned })]) {
      expect(createCompanionCareStore({ getItem: () => raw, setItem: () => {} }).load()).toEqual(DEFAULT_COMPANION_MEMORY);
    }
    for (const habits of [null, [], "learned"]) {
      const raw = JSON.stringify({ version: 2, ...DEFAULT_COMPANION_CARE, habits });
      expect(createCompanionCareStore({ getItem: () => raw, setItem: () => {} }).load().habits).toEqual(DEFAULT_COMPANION_HABITS);
    }
    const store = createCompanionCareStore();
    const source = { ...DEFAULT_COMPANION_CARE, habits: { sociability: 5, playfulness: -4, confidence: NaN, credit: Infinity, generation: NaN } };
    expect(store.save(source).habits).toEqual({ sociability: 1, playfulness: -1, confidence: 0, credit: 1, generation: 0 });
    expect(source.habits.confidence).toBeNaN(); expect(source.habits.sociability).toBe(5);
    const returned = store.load(); returned.habits.sociability = -.8; returned.hunger = 0;
    expect(store.load()).toEqual({ ...DEFAULT_COMPANION_MEMORY, habits: { sociability: 1, playfulness: -1, confidence: 0, credit: 1, generation: 0 } });
  });

  it("preserves learned values in memory through quota failures within the same five-second budget", () => {
    let now = 0, fail = true, raw = JSON.stringify({ version: 2, ...DEFAULT_COMPANION_MEMORY });
    const storage = { getItem: () => raw, setItem: vi.fn((_key: string, value: string) => { if (fail) throw new Error("quota"); raw = value; }) };
    const store = createCompanionCareStore(storage, () => now);
    store.load(); store.save({ ...DEFAULT_COMPANION_CARE, hunger: .2, habits: learned });
    for (now = 250; now < 5000; now += 250) store.save({ ...DEFAULT_COMPANION_CARE, hunger: .21 });
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(store.load()).toEqual({ ...DEFAULT_COMPANION_MEMORY, hunger: .21, habits: learned });
    fail = false; now = 5000; store.save(store.load());
    expect(storage.setItem).toHaveBeenCalledTimes(2); expect(JSON.parse(raw).habits).toEqual(learned);
  });

  it("keeps storage reads at write boundaries while ordinary samples update dirty memory", () => {
    let now = 0, raw: string | null = null;
    const storage = { getItem: vi.fn(() => raw), setItem: vi.fn((_key: string, value: string) => { raw = value; }) };
    const store = createCompanionCareStore(storage, () => now);
    store.save({ ...DEFAULT_COMPANION_CARE, habits: learned });
    for (let sample = 1; sample < 100; sample++) {
      now = sample * 50;
      expect(store.save({ ...DEFAULT_COMPANION_CARE, hunger: sample / 100 }).hunger).toBe(sample / 100);
    }
    expect(storage.getItem).toHaveBeenCalledTimes(1); expect(storage.setItem).toHaveBeenCalledTimes(1);
    now = 5000; store.save({ ...DEFAULT_COMPANION_CARE, hunger: .25 });
    expect(storage.getItem).toHaveBeenCalledTimes(2); expect(storage.setItem).toHaveBeenCalledTimes(2);
    raw = JSON.stringify({ version: 2, ...DEFAULT_COMPANION_CARE, habits: neutral() });
    now = 5001; expect(store.save({ ...DEFAULT_COMPANION_CARE, habits: { ...learned, credit: .9 } }, true).habits).toEqual(neutral());
    expect(storage.getItem).toHaveBeenCalledTimes(3); expect(storage.setItem).toHaveBeenCalledTimes(3);
  });

  it("also budgets failed read attempts while keeping blocked-storage habits in memory", () => {
    let now = 0;
    const storage = { getItem: vi.fn(() => { throw new Error("blocked"); }), setItem: vi.fn(() => { throw new Error("blocked"); }) };
    const store = createCompanionCareStore(storage, () => now);
    store.save({ ...DEFAULT_COMPANION_CARE, habits: learned });
    for (let sample = 1; sample < 100; sample++) {
      now = sample * 50;
      expect(store.save({ ...DEFAULT_COMPANION_CARE, hunger: .1 }).habits).toEqual(learned);
    }
    expect(storage.getItem).toHaveBeenCalledTimes(1); expect(storage.setItem).toHaveBeenCalledTimes(1);
    now = 5000; store.save({ ...DEFAULT_COMPANION_CARE, hunger: .1 });
    expect(storage.getItem).toHaveBeenCalledTimes(2); expect(storage.setItem).toHaveBeenCalledTimes(2);
  });

  it("resets only habits and rejects stale ordinary and forced cleanup snapshots", () => {
    let now = 0, raw: string | null = null;
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    const store = createCompanionCareStore(storage, () => now);
    const stale = store.save({ ...DEFAULT_COMPANION_CARE, hunger: .13, affection: .8, habits: learned }, true);
    expect(store.resetHabits()).toEqual({ ...DEFAULT_COMPANION_MEMORY, hunger: .13, affection: .8, habits: neutral(), life: { ...DEFAULT_COMPANION_LIFE, generation: 1 } });
    now = 250; expect(store.save(stale).habits).toEqual(neutral());
    expect(store.save(stale, true).habits).toEqual(neutral());
    expect(JSON.parse(raw!).habits).toEqual(neutral());
    const newExperience = { ...neutral(), sociability: .035, credit: 0 };
    expect(store.save({ ...stale, habits: newExperience }, true).habits).toEqual(newExperience);
    // A late old callback cannot undo either the reset or a newer experience.
    expect(store.save(stale, true).habits).toEqual(newExperience);
  });

  it("accepts the exact same earned traits after resetting, rather than blacklisting the old values", () => {
    let raw: string | null = null;
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    const store = createCompanionCareStore(storage, () => 0);
    const before = learnCompanionHabits({ ...DEFAULT_COMPANION_HABITS }, "petted");
    store.save({ ...DEFAULT_COMPANION_CARE, habits: before }, true);
    const reset = store.resetHabits(), after = learnCompanionHabits(reset.habits, "petted");
    expect(after).toEqual({ ...before, generation: 1 });
    expect(store.save({ ...reset, habits: after }, true).habits).toEqual(after);
    expect(JSON.parse(raw!).habits).toEqual(after); expect(after.credit).toBe(0);
    expect(store.save({ ...reset, habits: before }, true).habits).toEqual(after);
    const again = store.resetHabits(), relearned = learnCompanionHabits(again.habits, "petted");
    expect(relearned).toEqual({ ...before, generation: 2 });
    expect(store.save({ ...again, habits: relearned }, true).habits).toEqual(relearned);
  });

  it("migrates missing or malformed generations to zero and caps the numeric reset counter", () => {
    for (const generation of [undefined, null, "1", -.1, -1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const raw = JSON.stringify({ version: 2, ...DEFAULT_COMPANION_CARE, habits: { ...learned, generation } });
      expect(createCompanionCareStore({ getItem: () => raw, setItem: () => {} }).load().habits).toEqual(learned);
    }
    let raw = JSON.stringify({ version: 2, ...DEFAULT_COMPANION_CARE, habits: { ...learned, generation: Number.MAX_SAFE_INTEGER } });
    const store = createCompanionCareStore({ getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } });
    expect(store.resetHabits().habits).toEqual(neutral(Number.MAX_SAFE_INTEGER));
    expect(JSON.parse(raw).habits.generation).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("invalidates a generation0 brain on deletion and preserves the dirty clear through repeated loads", () => {
    let now = 0, raw: string | null = null;
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    const store = createCompanionCareStore(storage, () => now);
    expect(store.load()).toEqual(DEFAULT_COMPANION_MEMORY);
    const stale = store.save({ ...DEFAULT_COMPANION_CARE, habits: learned }, true);
    raw = null;
    expect(store.load().habits).toEqual(neutral());
    expect(store.load().habits).toEqual(neutral());
    now = 250;
    expect(store.save({ ...stale, habits: { ...learned, credit: .9 } }).habits).toEqual(neutral());
    expect(raw).toBeNull();
    expect(store.save(stale, true).habits).toEqual(neutral());
    expect(JSON.parse(raw!).habits).toEqual(neutral());
    raw = null; store.synchronize(null);
    expect(store.load().habits).toEqual(neutral(2));
    // A second explicit clear is a new reset intent even with unchanged null.
    store.synchronize(null); expect(store.load().habits).toEqual(neutral(3));
    expect(store.save(stale, true).habits).toEqual(neutral(3));
  });

  it("lets an external reset supersede a dirty write before its storage event arrives", () => {
    let now = 0, raw: string | null = null;
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    const store = createCompanionCareStore(storage, () => now);
    const stale = store.save({ ...DEFAULT_COMPANION_CARE, habits: learned }, true);
    now = 250; store.save({ ...stale, hunger: .1 });
    raw = JSON.stringify({ version: 2, ...DEFAULT_COMPANION_CARE, habits: neutral() });
    expect(store.save(stale, true).habits).toEqual(neutral());
    expect(JSON.parse(raw).habits).toEqual(neutral());
    raw = null;
    expect(store.load()).toEqual({ ...DEFAULT_COMPANION_MEMORY, habits: neutral(2), life: { ...DEFAULT_COMPANION_LIFE, generation: 2 } });
  });

  it("blocks old learned traits even when the stale brain has replenished its credit", () => {
    let now = 0, raw: string | null = null;
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    const store = createCompanionCareStore(storage, () => now);
    const stale = store.save({ ...DEFAULT_COMPANION_CARE, habits: learned }, true);
    raw = JSON.stringify({ version: 2, ...DEFAULT_COMPANION_CARE, habits: neutral() });
    store.synchronize(raw);
    const advanced = { ...stale, habits: { ...stale.habits, credit: .4138889 } };
    now = 250; expect(store.save(advanced).habits).toEqual(neutral());
    expect(store.save(advanced, true).habits).toEqual(neutral());
    now = 5250; expect(store.save({ ...advanced, habits: { ...advanced.habits, credit: .8 } }).habits).toEqual(neutral());
    expect(JSON.parse(raw!).habits).toEqual(neutral());
  });

  it("accepts same-generation learning credit changes without treating trait values as stale", () => {
    let now = 0, raw: string | null = null;
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    const store = createCompanionCareStore(storage, () => now);
    store.save(DEFAULT_COMPANION_MEMORY, true);
    raw = JSON.stringify({ version: 2, ...DEFAULT_COMPANION_CARE, habits: { ...DEFAULT_COMPANION_HABITS, credit: .4 } });
    store.synchronize(raw);
    now = 250;
    expect(store.save({ ...DEFAULT_COMPANION_CARE, habits: { ...DEFAULT_COMPANION_HABITS, credit: .7 } }).habits).toEqual({ ...DEFAULT_COMPANION_HABITS, credit: .7 });
    expect(store.save(DEFAULT_COMPANION_MEMORY, true).habits).toEqual(DEFAULT_COMPANION_HABITS);
  });

  it("keeps a reset through failed writes and an unchanged stale readable value", () => {
    let raw = JSON.stringify({ version: 2, ...DEFAULT_COMPANION_CARE, hunger: .14, habits: learned }), fail = true;
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { if (fail) throw new Error("quota"); raw = value; } };
    const store = createCompanionCareStore(storage, () => 0), stale = store.load();
    expect(store.resetHabits()).toEqual({ ...DEFAULT_COMPANION_MEMORY, hunger: .14, habits: neutral(), life: { ...DEFAULT_COMPANION_LIFE, generation: 1 } });
    expect(store.load().habits).toEqual(neutral());
    expect(store.save(stale, true).habits).toEqual(neutral());
    fail = false; store.save(store.load(), true);
    expect(JSON.parse(raw).habits).toEqual(neutral());
    expect(JSON.parse(raw).hunger).toBe(.14);
  });
});

describe("local learned-habit subscriptions", () => {
  function browser() {
    const entries = new Map<string, string>();
    const target = Object.assign(new EventTarget(), { localStorage: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value); }
    } });
    vi.stubGlobal("window", target);
    return { target, entries };
  }
  const stored = (target: EventTarget, key: string | null, newValue: string | null) => target.dispatchEvent(Object.assign(new Event("storage"), { key, newValue }));

  it("notifies same-tab reset once with only sanitized habits and preserves care and preferences", () => {
    const { entries } = browser(), listener = vi.fn();
    entries.set("vic.viewerCompanion", "manual-preferences-canary");
    saveCompanionCare({ ...DEFAULT_COMPANION_CARE, hunger: .17, affection: .75, habits: learned }, true);
    const stop = subscribeCompanionHabits(listener);
    expect(resetCompanionHabits()).toEqual(neutral());
    expect(listener).toHaveBeenCalledTimes(1); expect(listener).toHaveBeenCalledWith(neutral());
    expect(loadCompanionCare()).toEqual({ ...DEFAULT_COMPANION_MEMORY, hunger: .17, affection: .75, habits: neutral(), life: { ...DEFAULT_COMPANION_LIFE, generation: 1 } });
    expect(entries.get("vic.viewerCompanion")).toBe("manual-preferences-canary");
    stop(); resetCompanionHabits(); expect(listener).toHaveBeenCalledTimes(1);
  });

  it("adopts external sanitized numbers and clear events while ignoring unrelated keys", () => {
    const { target, entries } = browser(), listener = vi.fn(), stop = subscribeCompanionHabits(listener);
    saveCompanionCare({ ...DEFAULT_COMPANION_CARE, habits: learned }, true);
    stored(target, "other", null); expect(listener).not.toHaveBeenCalled();
    const external = JSON.stringify({ version: 2, ...DEFAULT_COMPANION_CARE, habits: { ...learned, sociability: -.4, eventId: "sensitive-canary" }, email: "sensitive-canary" });
    entries.set(COMPANION_CARE_KEY, external); stored(target, COMPANION_CARE_KEY, external);
    expect(listener).toHaveBeenLastCalledWith({ ...learned, sociability: -.4 });
    expect(JSON.stringify(listener.mock.calls)).not.toContain("canary");
    expect(loadCompanionCare().habits).toEqual({ ...learned, sociability: -.4 });
    entries.clear(); stored(target, null, null);
    expect(listener).toHaveBeenLastCalledWith(neutral());
    expect(loadCompanionCare()).toEqual({ ...DEFAULT_COMPANION_MEMORY, habits: neutral(), life: { ...DEFAULT_COMPANION_LIFE, generation: 1 } });
    stop();
  });

  it("honors an explicit clear and external newValue when storage is blocked or unchanged after quota failure", () => {
    const { target } = browser(), listener = vi.fn(), stop = subscribeCompanionHabits(listener);
    target.localStorage.setItem = () => { throw new Error("quota"); };
    const stale = saveCompanionCare({ ...DEFAULT_COMPANION_CARE, hunger: .12, habits: learned }, true);
    stored(target, null, null);
    expect(listener).toHaveBeenLastCalledWith(neutral());
    expect(saveCompanionCare(stale, true).habits).toEqual(neutral());
    target.localStorage.getItem = () => { throw new Error("blocked"); };
    const changed = { ...learned, confidence: .8, generation: 2 };
    stored(target, COMPANION_CARE_KEY, JSON.stringify({ version: 2, ...DEFAULT_COMPANION_CARE, habits: changed }));
    expect(listener).toHaveBeenLastCalledWith(changed); expect(loadCompanionCare().habits).toEqual(changed);
    expect(saveCompanionCare(stale, true).habits).toEqual(changed);
    stop();
  });

  it("normalizes same-tab event data and provides safe server-only fallbacks", () => {
    const { target } = browser(), listener = vi.fn(), stop = subscribeCompanionHabits(listener);
    target.dispatchEvent(new CustomEvent(COMPANION_HABITS_EVENT, { detail: { ...learned, sociability: Infinity, email: "sensitive-canary" } }));
    expect(listener).toHaveBeenLastCalledWith({ ...learned, sociability: 0 });
    stop(); vi.stubGlobal("window", undefined);
    expect(loadCompanionCare()).toEqual(DEFAULT_COMPANION_MEMORY);
    expect(resetCompanionHabits()).toEqual(DEFAULT_COMPANION_HABITS);
    expect(saveCompanionCare({ ...DEFAULT_COMPANION_CARE, habits: learned })).toEqual({ ...DEFAULT_COMPANION_MEMORY, habits: learned });
    expect(subscribeCompanionHabits(listener)).toBeTypeOf("function");
  });
});
