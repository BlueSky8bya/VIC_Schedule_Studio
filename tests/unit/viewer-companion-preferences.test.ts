import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMPANION_PREFERENCES_EVENT, COMPANION_PREFERENCES_KEY, DEFAULT_COMPANION_PREFERENCES, getCompanionPreferences, normalizeCompanionPreferences, setCompanionPreferences, subscribeCompanionPreferences } from "@/lib/ui/viewer-companion/preferences";

const entries = new Map<string, string>();
let browser: EventTarget & { localStorage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void } };
beforeEach(() => {
  entries.clear();
  browser = Object.assign(new EventTarget(), { localStorage: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); }
  } });
  vi.stubGlobal("window", browser);
  getCompanionPreferences();
});
afterEach(() => vi.unstubAllGlobals());

describe("viewer companion device preferences", () => {
  it("starts OFF with complete safe defaults, including SSR", () => {
    expect(getCompanionPreferences()).toEqual(DEFAULT_COMPANION_PREFERENCES);
    expect(getCompanionPreferences().enabled).toBe(false);
    expect(getCompanionPreferences().size).toBe("large");
    vi.stubGlobal("window", undefined);
    expect(getCompanionPreferences()).toEqual(DEFAULT_COMPANION_PREFERENCES);
  });
  it("normalizes old, missing and malformed sizes without resetting other choices", () => {
    for (const size of ["small", "normal", "large", "giant", null, undefined]) {
      const migrated = normalizeCompanionPreferences({ size, enabled: false, petting: false, feeding: false, animalMode: "dog", speed: "lively" });
      expect(migrated).toEqual({ ...DEFAULT_COMPANION_PREFERENCES, size: "large", enabled: false, petting: false, feeding: false, animalMode: "dog", speed: "lively" });
    }
    const oldBase = { ...DEFAULT_COMPANION_PREFERENCES, size: "small", enabled: true, roam: false } as const;
    for (const value of [null, [], {}, { size: "normal", feeding: false }]) expect(normalizeCompanionPreferences(value, oldBase)).toMatchObject({ size: "large", enabled: true, roam: false });
    setCompanionPreferences({ enabled: true, size: "small", petting: false });
    setCompanionPreferences({ enabled: false });
    expect(getCompanionPreferences()).toMatchObject({ enabled: false, size: "large", petting: false });
    expect(JSON.parse(entries.get(COMPANION_PREFERENCES_KEY)!)).toMatchObject({ size: "large", enabled: false, petting: false });
  });
  it("retains every detailed choice across master OFF and ON", () => {
    const chosen = { enabled: true, roam: false, jump: false, sleep: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, drag: false, petting: false, feeding: false, animalMode: "cat", speed: "relaxed", size: "large", personality: "sleepy" } as const;
    setCompanionPreferences(chosen);
    setCompanionPreferences({ enabled: false });
    expect(getCompanionPreferences()).toEqual({ ...chosen, enabled: false });
    setCompanionPreferences({ enabled: true });
    expect(getCompanionPreferences()).toEqual(chosen);
    expect(JSON.parse(entries.get(COMPANION_PREFERENCES_KEY)!)).toEqual({ version: 1, ...chosen });
  });
  it("allowlists booleans and enums without importing unknown properties", () => {
    expect(normalizeCompanionPreferences({ enabled: "true", roam: 1, sleep: false, speed: "turbo", size: "large", personality: "affectionate", feeding: "yes", animalMode: "cat-and-dog", email: "synthetic-canary@example.invalid" })).toEqual({ ...DEFAULT_COMPANION_PREFERENCES, sleep: false, size: "large", personality: "affectionate" });
    expect(normalizeCompanionPreferences(null)).toEqual(DEFAULT_COMPANION_PREFERENCES);
    expect(normalizeCompanionPreferences([])).toEqual(DEFAULT_COMPANION_PREFERENCES);
  });
  it("extends version1 preferences without resetting existing choices", () => {
    entries.set(COMPANION_PREFERENCES_KEY, JSON.stringify({ version: 1, enabled: true, roam: false, personality: "sleepy", size: "small" }));
    expect(getCompanionPreferences()).toEqual({ ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, personality: "sleepy", size: "large", animalMode: "default", feeding: true });
    setCompanionPreferences({ animalMode: "dog", feeding: false });
    expect(getCompanionPreferences()).toEqual({ ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, personality: "sleepy", size: "large", animalMode: "dog", feeding: false });
  });
  it("migrates the card prank to ON and keeps an explicit OFF independently of play and other pranks", () => {
    entries.set(COMPANION_PREFERENCES_KEY, JSON.stringify({ version: 1, enabled: true, jump: false, heartPrank: false }));
    expect(getCompanionPreferences()).toMatchObject({ enabled: true, roam: true, jump: false, cardPrank: true, heartPrank: false });
    const listener = vi.fn();
    const stop = subscribeCompanionPreferences(listener);
    setCompanionPreferences({ cardPrank: false });
    expect(listener).toHaveBeenLastCalledWith({ ...DEFAULT_COMPANION_PREFERENCES, enabled: true, jump: false, heartPrank: false, cardPrank: false });
    expect(JSON.parse(entries.get(COMPANION_PREFERENCES_KEY)!)).toMatchObject({ version: 1, cardPrank: false, roam: true });
    expect(getCompanionPreferences().cardPrank).toBe(false);
    expect(normalizeCompanionPreferences({ cardPrank: "off" }, getCompanionPreferences()).cardPrank).toBe(false);
    stop();
  });
  it("fails closed for corrupt or unsupported saved versions", () => {
    setCompanionPreferences({ enabled: true });
    entries.set(COMPANION_PREFERENCES_KEY, "{");
    expect(getCompanionPreferences().enabled).toBe(false);
    entries.set(COMPANION_PREFERENCES_KEY, JSON.stringify({ version: 2, enabled: true }));
    expect(getCompanionPreferences().enabled).toBe(false);
    entries.set(COMPANION_PREFERENCES_KEY, JSON.stringify({ enabled: true }));
    expect(getCompanionPreferences().enabled).toBe(false);
  });
  it("updates same-tab subscribers once and releases listeners", () => {
    const listener = vi.fn();
    const stop = subscribeCompanionPreferences(listener);
    const next = setCompanionPreferences({ enabled: true, personality: "affectionate" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(next);
    stop();
    setCompanionPreferences({ enabled: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it("reacts to other-tab changes and reset without handling unrelated keys", () => {
    const listener = vi.fn();
    const stop = subscribeCompanionPreferences(listener);
    entries.set(COMPANION_PREFERENCES_KEY, JSON.stringify({ version: 1, enabled: true, heartPrank: false }));
    const stored = (key: string | null) => browser.dispatchEvent(Object.assign(new Event("storage"), { key }));
    stored("unrelated");
    expect(listener).not.toHaveBeenCalled();
    stored(COMPANION_PREFERENCES_KEY);
    expect(listener).toHaveBeenLastCalledWith({ ...DEFAULT_COMPANION_PREFERENCES, enabled: true, heartPrank: false });
    entries.clear(); stored(null);
    expect(listener).toHaveBeenLastCalledWith(DEFAULT_COMPANION_PREFERENCES);
    stop();
  });
  it("keeps current-tab controls and detailed choices working when storage throws", () => {
    getCompanionPreferences();
    browser.localStorage.getItem = () => { throw new Error("storage denied"); };
    browser.localStorage.setItem = () => { throw new Error("storage denied"); };
    const listener = vi.fn();
    const stop = subscribeCompanionPreferences(listener);
    setCompanionPreferences({ enabled: true, jump: false });
    setCompanionPreferences({ enabled: false });
    expect(getCompanionPreferences()).toEqual({ ...DEFAULT_COMPANION_PREFERENCES, jump: false });
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
  });
  it("retains a local master and detailed changes when reads work but writes exceed quota", () => {
    const oldRaw = JSON.stringify({ version: 1, ...DEFAULT_COMPANION_PREFERENCES });
    entries.set(COMPANION_PREFERENCES_KEY, oldRaw);
    browser.localStorage.setItem = () => { throw new Error("quota exceeded"); };
    setCompanionPreferences({ enabled: true });
    setCompanionPreferences({ jump: false, size: "large" });
    expect(getCompanionPreferences()).toEqual({ ...DEFAULT_COMPANION_PREFERENCES, enabled: true, jump: false, size: "large" });
    expect(entries.get(COMPANION_PREFERENCES_KEY)).toBe(oldRaw);
    setCompanionPreferences({ enabled: false });
    expect(getCompanionPreferences()).toEqual({ ...DEFAULT_COMPANION_PREFERENCES, jump: false, size: "large" });
  });
  it("persists all unwritten local choices once storage recovers", () => {
    const save = browser.localStorage.setItem;
    browser.localStorage.setItem = () => { throw new Error("quota exceeded"); };
    setCompanionPreferences({ enabled: true, speed: "lively", petting: false });
    browser.localStorage.setItem = save;
    setCompanionPreferences({ heartPrank: false });
    expect(JSON.parse(entries.get(COMPANION_PREFERENCES_KEY)!)).toEqual({ version: 1, ...DEFAULT_COMPANION_PREFERENCES, enabled: true, speed: "lively", petting: false, heartPrank: false });
  });
  it("lets external stored changes supersede a failed-write override", () => {
    browser.localStorage.setItem = () => { throw new Error("quota exceeded"); };
    setCompanionPreferences({ enabled: true, jump: false });
    entries.set(COMPANION_PREFERENCES_KEY, JSON.stringify({ version: 1, ...DEFAULT_COMPANION_PREFERENCES, personality: "sleepy" }));
    expect(getCompanionPreferences()).toEqual({ ...DEFAULT_COMPANION_PREFERENCES, personality: "sleepy" });
  });
  it("honors another tab's explicit reset even while stale saved bytes are unchanged", () => {
    const listener = vi.fn();
    const stop = subscribeCompanionPreferences(listener);
    browser.localStorage.setItem = () => { throw new Error("quota exceeded"); };
    setCompanionPreferences({ enabled: true, jump: false });
    browser.dispatchEvent(Object.assign(new Event("storage"), { key: null, newValue: null }));
    expect(listener).toHaveBeenLastCalledWith(DEFAULT_COMPANION_PREFERENCES);
    expect(getCompanionPreferences()).toEqual(DEFAULT_COMPANION_PREFERENCES);
    stop();
  });
  it("honors the storage event's new value even when later reads are blocked", () => {
    const listener = vi.fn();
    const stop = subscribeCompanionPreferences(listener);
    browser.localStorage.setItem = () => { throw new Error("quota exceeded"); };
    setCompanionPreferences({ enabled: true, jump: false });
    browser.localStorage.getItem = () => { throw new Error("storage denied"); };
    const external = { ...DEFAULT_COMPANION_PREFERENCES, size: "large", personality: "sleepy" } as const;
    browser.dispatchEvent(Object.assign(new Event("storage"), { key: COMPANION_PREFERENCES_KEY, newValue: JSON.stringify({ version: 1, ...external }) }));
    expect(listener).toHaveBeenLastCalledWith(external);
    expect(getCompanionPreferences()).toEqual(external);
    stop();
  });
  it("returns copies so callers cannot mutate the saved defaults or other consumers", () => {
    getCompanionPreferences().enabled = true;
    expect(getCompanionPreferences().enabled).toBe(false);
    const chosen = setCompanionPreferences({ size: "large" });
    chosen.size = "small";
    expect(getCompanionPreferences().size).toBe("large");
    expect(COMPANION_PREFERENCES_EVENT).toBe("vic:viewer-companion");
  });
});
