import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let preferences: typeof import("@/lib/ui/viewer-companion/preferences");
beforeEach(async () => { vi.resetModules(); preferences = await import("@/lib/ui/viewer-companion/preferences"); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function documentBrowser(entries = new Map<string, string>()) {
  const target = Object.assign(new EventTarget(), { localStorage: {
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { entries.set(key, value); }),
  } });
  vi.stubGlobal("window", target);
  return { target, entries };
}

describe("139 automatic document personality and persistent direct selection", () => {
  it.each(Array.from({ length: 9 }, (_, index) => index))("maps random interval %i to one of all nine equal choices, without writes or automatic human signals", index => {
    const { target, entries } = documentBrowser(), random = vi.spyOn(Math, "random").mockReturnValue((index + .5) / 9);
    const dispatch = vi.spyOn(target, "dispatchEvent"), fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const timeout = vi.spyOn(globalThis, "setTimeout");
    const first = preferences.getCompanionPreferences();
    expect(first.personality).toBe(preferences.COMPANION_PERSONALITIES[index]);
    for (let read = 0; read < 10; read++) expect(preferences.getCompanionPreferences()).toEqual(first);
    expect(random).toHaveBeenCalledTimes(1); expect(target.localStorage.setItem).not.toHaveBeenCalled();
    expect(entries.size).toBe(0); expect(dispatch).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled(); expect(timeout).not.toHaveBeenCalled();
  });

  it("keeps SSR and normalization deterministic, and only samples when a browser document first reads", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(.99); vi.stubGlobal("window", undefined);
    expect(preferences.getCompanionPreferences()).toEqual(preferences.DEFAULT_COMPANION_PREFERENCES);
    expect(preferences.normalizeCompanionPreferences(null)).toEqual(preferences.DEFAULT_COMPANION_PREFERENCES);
    expect(preferences.setCompanionPreferences({ feeding: false })).toMatchObject({ personality: "curious", feeding: false });
    expect(random).not.toHaveBeenCalled();
    const { target } = documentBrowser(); expect(preferences.getCompanionPreferences().personality).toBe("balanced");
    vi.stubGlobal("window", undefined); preferences.getCompanionPreferences();
    vi.stubGlobal("window", target); expect(preferences.getCompanionPreferences().personality).toBe("balanced");
    expect(random).toHaveBeenCalledTimes(1);
  });

  it("keeps legacy personality unpinned but persists a new direct selection across refresh with saved OFF and every other setting", () => {
    const random = vi.spyOn(Math, "random").mockReturnValueOnce(.01).mockReturnValueOnce(.99);
    const saved = { ...preferences.DEFAULT_COMPANION_PREFERENCES, enabled: false, jump: false, feeding: false, petting: false, sleep: false, sound: false, learnFromYou: false, animalMode: "dog", personality: "sleepy" };
    const entries = new Map([[preferences.COMPANION_PREFERENCES_KEY, JSON.stringify({ version: 1, ...saved })]]);
    documentBrowser(entries);
    expect(preferences.getCompanionPreferences()).toEqual({ ...saved, personality: "performer" });
    preferences.setCompanionPreferences({ personality: "affectionate" });
    expect(preferences.getCompanionPreferences()).toEqual({ ...saved, personality: "affectionate" });
    documentBrowser(entries); // New document, with exactly the prior saved bytes.
    expect(preferences.getCompanionPreferences()).toEqual({ ...saved, personality: "affectionate" });
    expect(random).toHaveBeenCalledTimes(1);
    expect(JSON.parse(entries.get(preferences.COMPANION_PREFERENCES_KEY)!)).toEqual({ version: 1, ...saved, personality: "affectionate", personalitySource: "manual" });
  });

  it("shares an immediate manual choice across viewer/studio/preview consumers and remounts without another draw", () => {
    documentBrowser(); const random = vi.spyOn(Math, "random").mockReturnValue(.01);
    preferences.getCompanionPreferences(); const consumers = [vi.fn(), vi.fn(), vi.fn()];
    const stops = consumers.map(listener => preferences.subscribeCompanionPreferences(listener));
    const selected = preferences.setCompanionPreferences({ personality: "tidy" });
    for (const listener of consumers) { expect(listener).toHaveBeenCalledTimes(1); expect(listener).toHaveBeenLastCalledWith(selected); }
    stops.forEach(stop => stop());
    const remounted = vi.fn(), stop = preferences.subscribeCompanionPreferences(remounted);
    preferences.setCompanionPreferences({ sound: false }); preferences.setCompanionPreferences({ enabled: false });
    expect(preferences.getCompanionPreferences()).toMatchObject({ personality: "tidy", sound: false, enabled: false });
    expect(remounted).toHaveBeenCalledTimes(2); expect(random).toHaveBeenCalledTimes(1); stop();
  });

  it("synchronizes another tab's manual personality and OFF settings, then releases the pin on reset", () => {
    const { target, entries } = documentBrowser(); const random = vi.spyOn(Math, "random").mockReturnValueOnce(.01).mockReturnValueOnce(.99);
    preferences.getCompanionPreferences(); preferences.setCompanionPreferences({ personality: "tidy" });
    const listener = vi.fn(), stop = preferences.subscribeCompanionPreferences(listener);
    const external = JSON.stringify({ version: 1, ...preferences.DEFAULT_COMPANION_PREFERENCES, enabled: false, feeding: false, personality: "homebody", personalitySource: "manual" });
    entries.set(preferences.COMPANION_PREFERENCES_KEY, external);
    target.dispatchEvent(Object.assign(new Event("storage"), { key: preferences.COMPANION_PREFERENCES_KEY, newValue: external }));
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false, feeding: false, personality: "homebody" }));
    expect(preferences.getCompanionPreferences()).toMatchObject({ enabled: false, feeding: false, personality: "homebody" });
    entries.clear(); target.dispatchEvent(Object.assign(new Event("storage"), { key: null, newValue: null }));
    expect(preferences.getCompanionPreferences()).toEqual({ ...preferences.DEFAULT_COMPANION_PREFERENCES, personality: "balanced" });
    expect(random).toHaveBeenCalledTimes(2); stop();
  });

  it("does not pin an automatic draw when only OFF, sound or another setting is saved", () => {
    const { entries } = documentBrowser(); const random = vi.spyOn(Math, "random").mockReturnValueOnce(.01).mockReturnValueOnce(.99);
    expect(preferences.getCompanionPreferences().personality).toBe("performer");
    preferences.setCompanionPreferences({ enabled: false, sound: false });
    preferences.setCompanionPreferences({ feeding: false, animalMode: "cat" });
    expect(JSON.parse(entries.get(preferences.COMPANION_PREFERENCES_KEY)!)).not.toHaveProperty("personalitySource");
    documentBrowser(entries);
    expect(preferences.getCompanionPreferences()).toMatchObject({ enabled: false, sound: false, feeding: false, animalMode: "cat", personality: "balanced" });
    expect(random).toHaveBeenCalledTimes(2);
  });

  it("remembers an explicit re-selection of the current automatic personality in a fresh module without another draw", async () => {
    const { target, entries } = documentBrowser(); const random = vi.spyOn(Math, "random").mockReturnValue(.01);
    const first = preferences.getCompanionPreferences(); preferences.setCompanionPreferences({ personality: first.personality });
    const raw = JSON.parse(entries.get(preferences.COMPANION_PREFERENCES_KEY)!);
    expect(raw).toMatchObject({ personality: "performer", personalitySource: "manual" });
    expect(first).not.toHaveProperty("personalitySource");
    const current = preferences.getCompanionPreferences(); expect(current).not.toHaveProperty("personalitySource");
    expect(preferences.companionWorldPreferencesKey(current)).not.toContain("personalitySource");
    vi.resetModules(); preferences = await import("@/lib/ui/viewer-companion/preferences"); vi.stubGlobal("window", target);
    expect(preferences.getCompanionPreferences().personality).toBe("performer"); expect(random).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, null, "not-a-personality", {}, [], 7])("does not pin a malformed personality patch: %j", value => {
    const { entries } = documentBrowser(); const random = vi.spyOn(Math, "random").mockReturnValueOnce(.01).mockReturnValueOnce(.99);
    preferences.getCompanionPreferences();
    preferences.setCompanionPreferences({ personality: value, enabled: false } as unknown as Partial<import("@/lib/ui/viewer-companion/preferences").CompanionPreferences>);
    expect(preferences.getCompanionPreferences()).toMatchObject({ enabled: false, personality: "performer" });
    expect(JSON.parse(entries.get(preferences.COMPANION_PREFERENCES_KEY)!)).not.toHaveProperty("personalitySource");
    documentBrowser(entries); expect(preferences.getCompanionPreferences()).toMatchObject({ enabled: false, personality: "balanced" });
    expect(random).toHaveBeenCalledTimes(2);
  });

  it("requires an own explicit personality field and ignores a forged provenance patch", () => {
    const { entries } = documentBrowser(); vi.spyOn(Math, "random").mockReturnValue(.01);
    preferences.setCompanionPreferences(Object.assign(Object.create({ personality: "tidy" }), { enabled: false, personalitySource: "manual" }));
    expect(preferences.getCompanionPreferences()).toMatchObject({ enabled: false, personality: "performer" });
    expect(JSON.parse(entries.get(preferences.COMPANION_PREFERENCES_KEY)!)).not.toHaveProperty("personalitySource");
  });

  it.each([
    { personality: "tidy" }, { personality: "tidy", personalitySource: true }, { personality: "tidy", personalitySource: "random" },
    { personality: "tidy", personalitySource: {} }, { personalitySource: "manual" }, { personality: "unknown", personalitySource: "manual" },
  ])("rejects an incomplete or malformed saved provenance pair while keeping OFF: %j", source => {
    const entries = new Map([[preferences.COMPANION_PREFERENCES_KEY, JSON.stringify({ version: 1, enabled: false, feeding: false, ...source })]]);
    documentBrowser(entries); const random = vi.spyOn(Math, "random").mockReturnValue(.99);
    expect(preferences.getCompanionPreferences()).toMatchObject({ enabled: false, feeding: false, personality: "balanced" });
    expect(random).toHaveBeenCalledTimes(1);
  });

  it("keeps corrupt versions and malformed enabled fail-closed even when a manual marker is present", () => {
    const { entries } = documentBrowser(); vi.spyOn(Math, "random").mockReturnValue(.99);
    for (const raw of [JSON.stringify({ version: 2, enabled: true, personality: "tidy", personalitySource: "manual" }), "{"]) {
      entries.set(preferences.COMPANION_PREFERENCES_KEY, raw);
      expect(preferences.getCompanionPreferences()).toMatchObject({ enabled: false, personality: "balanced" });
    }
    entries.set(preferences.COMPANION_PREFERENCES_KEY, JSON.stringify({ version: 1, enabled: "true", personality: "tidy", personalitySource: "manual" }));
    expect(preferences.getCompanionPreferences()).toMatchObject({ enabled: false, personality: "tidy" });
  });

  it("preserves a quota-limited manual choice and OFF until ordinary saving can persist its provenance", () => {
    const { target, entries } = documentBrowser(); const random = vi.spyOn(Math, "random").mockReturnValue(.01), save = target.localStorage.setItem.getMockImplementation()!;
    const old = JSON.stringify({ version: 1, ...preferences.DEFAULT_COMPANION_PREFERENCES }); entries.set(preferences.COMPANION_PREFERENCES_KEY, old);
    target.localStorage.setItem.mockImplementation(() => { throw Error("quota"); });
    preferences.setCompanionPreferences({ enabled: false, personality: "gourmet" });
    expect(preferences.getCompanionPreferences()).toMatchObject({ enabled: false, personality: "gourmet" }); expect(entries.get(preferences.COMPANION_PREFERENCES_KEY)).toBe(old);
    target.localStorage.setItem.mockImplementation(save); preferences.setCompanionPreferences({ sound: false });
    expect(JSON.parse(entries.get(preferences.COMPANION_PREFERENCES_KEY)!)).toMatchObject({ enabled: false, sound: false, personality: "gourmet", personalitySource: "manual" });
    documentBrowser(entries); expect(preferences.getCompanionPreferences()).toMatchObject({ enabled: false, sound: false, personality: "gourmet" }); expect(random).toHaveBeenCalledTimes(1);
  });

  it("adopts another tab's valid manual choice and reset even when reads are denied", () => {
    const { target } = documentBrowser(); vi.spyOn(Math, "random").mockReturnValue(.99);
    preferences.setCompanionPreferences({ personality: "gourmet", enabled: false });
    target.localStorage.getItem.mockImplementation(() => { throw Error("blocked"); });
    const listener = vi.fn(), stop = preferences.subscribeCompanionPreferences(listener);
    target.dispatchEvent(Object.assign(new Event("storage"), { key: preferences.COMPANION_PREFERENCES_KEY, newValue: JSON.stringify({ version: 1, enabled: false, personality: "tidy", personalitySource: "manual" }) }));
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false, personality: "tidy" }));
    expect(preferences.getCompanionPreferences()).toMatchObject({ enabled: false, personality: "tidy" });
    target.dispatchEvent(Object.assign(new Event("storage"), { key: null, newValue: null }));
    expect(preferences.getCompanionPreferences()).toEqual({ ...preferences.DEFAULT_COMPANION_PREFERENCES, personality: "balanced" }); stop();
  });

  it("retains the document choice and manual OFF when reads or writes are unavailable", () => {
    const { target } = documentBrowser(); const random = vi.spyOn(Math, "random").mockReturnValue(.99);
    target.localStorage.getItem.mockImplementation(() => { throw Error("blocked"); });
    target.localStorage.setItem.mockImplementation(() => { throw Error("blocked"); });
    expect(preferences.getCompanionPreferences().personality).toBe("balanced");
    preferences.setCompanionPreferences({ enabled: false, personality: "gourmet", feeding: false });
    expect(preferences.getCompanionPreferences()).toMatchObject({ enabled: false, personality: "gourmet", feeding: false });
    expect(random).toHaveBeenCalledTimes(1);
  });

  it("allows a repeated random result on independent refreshes without persisting a new personality history", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(.5), entries = new Map<string, string>();
    documentBrowser(entries); const first = preferences.getCompanionPreferences().personality;
    documentBrowser(entries); expect(preferences.getCompanionPreferences().personality).toBe(first);
    expect(random).toHaveBeenCalledTimes(2); expect(entries.size).toBe(0);
  });
});
