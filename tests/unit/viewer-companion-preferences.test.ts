import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { companionWorldPreferencesKey, COMPANION_PREFERENCES_EVENT, COMPANION_PREFERENCES_KEY, DEFAULT_COMPANION_PREFERENCES, getCompanionPreferences, normalizeCompanionPreferences, setCompanionPreferences, subscribeCompanionPreferences } from "@/lib/ui/viewer-companion/preferences";

const entries = new Map<string, string>();
let browser: EventTarget & { localStorage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void } };
beforeEach(() => {
  entries.clear();
  browser = Object.assign(new EventTarget(), { localStorage: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); }
  } });
  vi.stubGlobal("window", browser);
  vi.spyOn(Math, "random").mockReturnValue(1.5 / 9);
  getCompanionPreferences();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("viewer companion device preferences", () => {
  it("keeps the live world stable for sound-only changes and invalidates it for every world choice", () => {
    const base = companionWorldPreferencesKey(DEFAULT_COMPANION_PREFERENCES);
    const sound = new Set(["sound", "soundVolume", "soundCare", "soundMotion", "soundKeepsakes"]);
    for (const [key, value] of Object.entries(DEFAULT_COMPANION_PREFERENCES)) {
      const changed = { ...DEFAULT_COMPANION_PREFERENCES, [key]: typeof value === "boolean" ? !value : typeof value === "number" ? 35 : value === "normal" ? "lively" : value === "large" ? "normal" : value === "default" ? "cat" : "sleepy" };
      if (sound.has(key)) expect(companionWorldPreferencesKey(changed)).toBe(base);
      else expect(companionWorldPreferencesKey(changed)).not.toBe(base);
    }
  });
  it("starts ON for a missing preference without writing or resetting choices, including the SSR default", () => {
    const write = vi.spyOn(browser.localStorage, "setItem");
    expect(getCompanionPreferences()).toEqual(DEFAULT_COMPANION_PREFERENCES);
    expect(getCompanionPreferences().enabled).toBe(true);
    expect(getCompanionPreferences().size).toBe("large");
    expect(entries.has(COMPANION_PREFERENCES_KEY)).toBe(false);
    expect(write).not.toHaveBeenCalled();
    vi.stubGlobal("window", undefined);
    expect(getCompanionPreferences()).toEqual(DEFAULT_COMPANION_PREFERENCES);
  });
  it("preserves saved OFF and detailed choices while the current document owns personality", () => {
    const chosen = { ...DEFAULT_COMPANION_PREFERENCES, enabled: false, jump: false, feeding: false, learnFromYou: false, personality: "sleepy" as const, animalMode: "cat" as const, speed: "relaxed" as const };
    entries.set(COMPANION_PREFERENCES_KEY, JSON.stringify({ version: 1, ...chosen, size: "small" }));
    const current = { ...chosen, personality: "curious" };
    expect(getCompanionPreferences()).toEqual(current);
    expect(getCompanionPreferences()).toEqual(current);
    const remounted = Object.assign(new EventTarget(), { localStorage: browser.localStorage });
    vi.stubGlobal("window", remounted);
    expect(getCompanionPreferences()).toEqual(current);
    setCompanionPreferences({ heartPrank: false });
    expect(getCompanionPreferences()).toEqual({ ...current, heartPrank: false });
    expect(JSON.parse(entries.get(COMPANION_PREFERENCES_KEY)!)).toEqual({ version: 1, ...current, heartPrank: false });
  });
  it("uses ON for a valid legacy record's missing master field while retaining its other settings", () => {
    entries.set(COMPANION_PREFERENCES_KEY, JSON.stringify({ version: 1, jump: false, speed: "lively", animalMode: "dog", learnFromYou: false }));
    expect(getCompanionPreferences()).toEqual({ ...DEFAULT_COMPANION_PREFERENCES, enabled: true, jump: false, speed: "lively", animalMode: "dog", learnFromYou: false });
    expect(JSON.parse(entries.get(COMPANION_PREFERENCES_KEY)!)).not.toHaveProperty("enabled");
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
    const chosen = { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, drag: false, petting: false, feeding: false, learnFromYou: false, sound: false, soundVolume: 35, soundCare: false, soundMotion: false, soundKeepsakes: false, animalMode: "cat", speed: "relaxed", size: "large", personality: "sleepy" } as const;
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
  it("adds sound defaults to old records without rewriting or enabling an explicit saved OFF", () => {
    const legacy = JSON.stringify({ version: 1, enabled: false, feeding: false });
    entries.set(COMPANION_PREFERENCES_KEY, legacy);
    expect(getCompanionPreferences()).toMatchObject({ enabled: false, feeding: false, sound: true, soundVolume: 60, soundCare: true, soundMotion: true, soundKeepsakes: true });
    expect(entries.get(COMPANION_PREFERENCES_KEY)).toBe(legacy);
  });
  it("normalizes bounded sound volume and rejects malformed patches without losing saved choices", () => {
    const base = { ...DEFAULT_COMPANION_PREFERENCES, sound: false, soundVolume: 35, soundCare: false };
    for (const soundVolume of [null, "80", NaN, Infinity, {}, []]) expect(normalizeCompanionPreferences({ soundVolume, sound: "yes", soundCare: 1 }, base)).toEqual(base);
    expect(normalizeCompanionPreferences({ soundVolume: -20 }, base).soundVolume).toBe(0);
    expect(normalizeCompanionPreferences({ soundVolume: 999 }, base).soundVolume).toBe(100);
    expect(normalizeCompanionPreferences({ soundVolume: 42.6 }, base).soundVolume).toBe(43);
    setCompanionPreferences(base);
    setCompanionPreferences({ soundKeepsakes: false });
    expect(getCompanionPreferences()).toMatchObject({ enabled: true, sound: false, soundVolume: 35, soundCare: false, soundMotion: true, soundKeepsakes: false });
  });
  it("extends version1 preferences without resetting existing choices", () => {
    entries.set(COMPANION_PREFERENCES_KEY, JSON.stringify({ version: 1, enabled: true, roam: false, personality: "sleepy", size: "small" }));
    expect(getCompanionPreferences()).toEqual({ ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, personality: "curious", size: "large", animalMode: "default", feeding: true });
    setCompanionPreferences({ animalMode: "dog", feeding: false });
    expect(getCompanionPreferences()).toEqual({ ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, personality: "curious", size: "large", animalMode: "dog", feeding: false });
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
  it("adds rare ornament play for legacy records and persists an explicit OFF independently", () => {
    const legacy = JSON.stringify({ version: 1, enabled: false, cardPrank: false });
    entries.set(COMPANION_PREFERENCES_KEY, legacy);
    expect(getCompanionPreferences()).toMatchObject({ enabled: false, cardPrank: false, rarePrank: true });
    expect(entries.get(COMPANION_PREFERENCES_KEY)).toBe(legacy);
    const listener = vi.fn(), stop = subscribeCompanionPreferences(listener);
    setCompanionPreferences({ rarePrank: false });
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ rarePrank: false, enabled: false }));
    setCompanionPreferences({ enabled: true });
    expect(getCompanionPreferences()).toMatchObject({ enabled: true, cardPrank: false, rarePrank: false });
    expect(JSON.parse(entries.get(COMPANION_PREFERENCES_KEY)!)).toMatchObject({ version: 1, rarePrank: false });
    expect(normalizeCompanionPreferences({ rarePrank: "yes" }, getCompanionPreferences()).rarePrank).toBe(false);
    stop();
  });
  it("fails closed for corrupt or unsupported saved versions", () => {
    for (const raw of ["{", "", "null", "[]", "5", JSON.stringify({ version: 2, enabled: true }), JSON.stringify({ enabled: true })]) {
      entries.set(COMPANION_PREFERENCES_KEY, raw);
      expect(getCompanionPreferences().enabled).toBe(false);
    }
    entries.delete(COMPANION_PREFERENCES_KEY);
    expect(getCompanionPreferences().enabled).toBe(true);
  });
  it("keeps a malformed stored master OFF while ignoring malformed patches against the current base", () => {
    for (const enabled of ["true", "false", 0, 1, null, [], {}]) {
      entries.set(COMPANION_PREFERENCES_KEY, JSON.stringify({ version: 1, enabled, jump: false, animalMode: "cat" }));
      expect(getCompanionPreferences()).toMatchObject({ enabled: false, jump: false, animalMode: "cat" });
      expect(normalizeCompanionPreferences({ enabled }, getCompanionPreferences()).enabled).toBe(false);
    }
    expect(normalizeCompanionPreferences({ enabled: "false" }).enabled).toBe(true);
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
    entries.set(COMPANION_PREFERENCES_KEY, JSON.stringify({ version: 1, enabled: false, heartPrank: false, feeding: false }));
    stored(COMPANION_PREFERENCES_KEY);
    expect(listener).toHaveBeenLastCalledWith({ ...DEFAULT_COMPANION_PREFERENCES, enabled: false, heartPrank: false, feeding: false });
    expect(getCompanionPreferences().enabled).toBe(false);
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
    expect(getCompanionPreferences()).toEqual({ ...DEFAULT_COMPANION_PREFERENCES, enabled: false, jump: false });
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
    expect(getCompanionPreferences()).toEqual({ ...DEFAULT_COMPANION_PREFERENCES, enabled: false, jump: false, size: "large" });
  });
  it("keeps a quota-limited explicit OFF across same-tab consumers, then persists it when writes recover", () => {
    const write = browser.localStorage.setItem;
    const listener = vi.fn(), stop = subscribeCompanionPreferences(listener);
    browser.localStorage.setItem = () => { throw new Error("quota exceeded"); };
    setCompanionPreferences({ enabled: false, animalMode: "dog", petting: false });
    expect(listener).toHaveBeenLastCalledWith({ ...DEFAULT_COMPANION_PREFERENCES, enabled: false, animalMode: "dog", petting: false });
    expect(getCompanionPreferences()).toMatchObject({ enabled: false, animalMode: "dog", petting: false });
    const remountedListener = vi.fn(), stopRemounted = subscribeCompanionPreferences(remountedListener);
    setCompanionPreferences({ jump: false });
    expect(remountedListener).toHaveBeenLastCalledWith({ ...DEFAULT_COMPANION_PREFERENCES, enabled: false, animalMode: "dog", petting: false, jump: false });
    browser.localStorage.setItem = write;
    setCompanionPreferences({ sleep: false });
    expect(JSON.parse(entries.get(COMPANION_PREFERENCES_KEY)!)).toMatchObject({ enabled: false, animalMode: "dog", petting: false, jump: false, sleep: false });
    stop(); stopRemounted();
  });
  it("persists all unwritten local choices once storage recovers", () => {
    const save = browser.localStorage.setItem;
    browser.localStorage.setItem = () => { throw new Error("quota exceeded"); };
    setCompanionPreferences({ enabled: true, speed: "lively", petting: false });
    browser.localStorage.setItem = save;
    setCompanionPreferences({ heartPrank: false });
    expect(JSON.parse(entries.get(COMPANION_PREFERENCES_KEY)!)).toEqual({ version: 1, ...DEFAULT_COMPANION_PREFERENCES, enabled: true, speed: "lively", petting: false, heartPrank: false });
  });
  it("lets external ordinary settings supersede failed writes without replacing this document's personality", () => {
    browser.localStorage.setItem = () => { throw new Error("quota exceeded"); };
    setCompanionPreferences({ enabled: true, jump: false });
    entries.set(COMPANION_PREFERENCES_KEY, JSON.stringify({ version: 1, ...DEFAULT_COMPANION_PREFERENCES, enabled: false, personality: "sleepy" }));
    expect(getCompanionPreferences()).toEqual({ ...DEFAULT_COMPANION_PREFERENCES, enabled: false });
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
    expect(listener).toHaveBeenLastCalledWith({ ...external, personality: "curious" });
    expect(getCompanionPreferences()).toEqual({ ...external, personality: "curious" });
    stop();
  });
  it("returns copies so callers cannot mutate the saved defaults or other consumers", () => {
    getCompanionPreferences().enabled = false;
    expect(getCompanionPreferences().enabled).toBe(true);
    const chosen = setCompanionPreferences({ size: "large" });
    chosen.size = "small";
    expect(getCompanionPreferences().size).toBe("large");
    expect(COMPANION_PREFERENCES_EVENT).toBe("vic:viewer-companion");
  });
});
