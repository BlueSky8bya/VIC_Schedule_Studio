import { describe, expect, it, vi } from "vitest";
import { COMPANION_CARE_KEY, DEFAULT_COMPANION_CARE, createCompanionCareStore, normalizeCompanionCare } from "@/lib/ui/viewer-companion/care";

describe("private device-only companion care storage", () => {
  it("allows only finite needs and clamps their range", () => {
    expect(normalizeCompanionCare({ hunger: 20, affection: -5, energy: NaN, curiosity: "1", email: "canary@example.invalid" }))
      .toEqual({ hunger: 1, affection: 0, energy: DEFAULT_COMPANION_CARE.energy, curiosity: DEFAULT_COMPANION_CARE.curiosity });
    expect(normalizeCompanionCare(null)).toEqual(DEFAULT_COMPANION_CARE);
  });

  it("persists four needs without identity, schedule text or absence timestamps", () => {
    let raw: string | null = null;
    const storage = { getItem: vi.fn(() => raw), setItem: vi.fn((_key: string, value: string) => { raw = value; }) };
    const store = createCompanionCareStore(storage, () => 0);
    store.save({ ...DEFAULT_COMPANION_CARE, title: "sensitive-schedule-canary", email: "identity-canary" } as typeof DEFAULT_COMPANION_CARE);
    expect(storage.setItem.mock.calls[0][0]).toBe(COMPANION_CARE_KEY);
    expect(Object.keys(JSON.parse(raw!)).sort()).toEqual(["affection", "curiosity", "energy", "hunger", "version"]);
    expect(raw).not.toContain("canary");
    const reopened = createCompanionCareStore(storage, () => 86400000);
    expect(reopened.load()).toEqual(DEFAULT_COMPANION_CARE);
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
    expect(store.load()).toEqual(DEFAULT_COMPANION_CARE);
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
      expect(createCompanionCareStore({ getItem: () => raw, setItem: () => {} }).load()).toEqual(DEFAULT_COMPANION_CARE);
    }
  });
});
