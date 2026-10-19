import { describe, expect, it, vi } from "vitest";
import { COMPANION_HOME_LIGHT_KEY, createCompanionHomeLightStore, parseCompanionHomeLight } from "@/lib/ui/viewer-companion/home-light";

describe("136 persistent room light", () => {
  const storage = () => { const values = new Map<string, string>(); return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, raw: string) => { values.set(key, raw); } }; };
  it.each([false, true])("initializes once from dark=%s and then retains even false across new instances/theme changes", dark => {
    const memory = storage(); let theme = dark;
    const first = createCompanionHomeLightStore(memory, () => theme);
    expect(first.initialize()).toBe(!dark);
    theme = !dark; expect(first.read()).toBe(!dark);
    first.set(false); expect(first.read()).toBe(false);
    const remounted = createCompanionHomeLightStore(memory, () => theme);
    expect(remounted.initialize()).toBe(false);
    remounted.set(true);
    expect(createCompanionHomeLightStore(memory, () => true).read()).toBe(true);
    expect(JSON.parse(memory.values.get(COMPANION_HOME_LIGHT_KEY)!)).toEqual({ version: 1, lit: true });
  });
  it("rejects malformed/foreign values rather than treating a saved false as missing", () => {
    for (const raw of [null, "{", 'true', '{"version":2,"lit":true}', '{"version":1,"lit":"false"}']) expect(parseCompanionHomeLight(raw)).toBeUndefined();
    expect(parseCompanionHomeLight('{"version":1,"lit":false}')).toBe(false);
    const memory = storage(); memory.values.set(COMPANION_HOME_LIGHT_KEY, "{");
    expect(createCompanionHomeLightStore(memory, () => true).initialize()).toBe(false);
    expect(parseCompanionHomeLight(memory.getItem(COMPANION_HOME_LIGHT_KEY))).toBe(false);
  });
  it("keeps the last decision after failed writes over an older readable value", () => {
    const memory = storage(); let fail = false;
    const store = createCompanionHomeLightStore({ getItem: memory.getItem, setItem: (key, raw) => { if (fail) throw Error("quota"); memory.setItem(key, raw); } }, () => false);
    store.initialize(); fail = true; store.set(false); expect(store.read()).toBe(false);
    store.set(true); store.set(false); expect(store.read()).toBe(false);
    fail = false; store.set(false); expect(parseCompanionHomeLight(memory.getItem(COMPANION_HOME_LIGHT_KEY))).toBe(false);
  });
  it("retains a choice with no storage and notifies/unsubscribes without timers", () => {
    const store = createCompanionHomeLightStore(undefined, () => false), listener = vi.fn(), off = store.subscribe(listener);
    store.initialize(); store.set(false); expect(store.read()).toBe(false); expect(listener).toHaveBeenCalledTimes(2);
    off(); store.set(true); expect(listener).toHaveBeenCalledTimes(2);
  });
  it("adopts other-tab choices and resets deleted values from the current theme", () => {
    const memory = storage(); const store = createCompanionHomeLightStore(memory, () => true), listener = vi.fn();
    store.initialize(); store.subscribe(listener);
    memory.setItem(COMPANION_HOME_LIGHT_KEY, '{"version":1,"lit":true}'); store.externalChange(); expect(store.read()).toBe(true);
    memory.values.clear(); store.externalChange(); expect(store.read()).toBe(false); expect(listener).toHaveBeenCalledTimes(2);
  });
});
