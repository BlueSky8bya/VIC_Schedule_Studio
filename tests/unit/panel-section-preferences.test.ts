import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyPanelSectionPreferences, DEFAULT_PANEL_SECTION_PREFERENCES, getPanelSectionPreferences, normalizePanelSectionPreferences, PANEL_SECTION_BOOTSTRAP, PANEL_SECTION_PREFERENCES_EVENT, PANEL_SECTION_PREFERENCES_KEY, setPanelSectionExpanded, subscribePanelSectionPreferences } from "@/lib/ui/panel-section-preferences";

const entries = new Map<string, string>();
const attributes = new Map<string, string>();
let browser: EventTarget & {
  localStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  document: { documentElement: { setAttribute(key: string, value: string): void; removeAttribute(key: string): void } };
};
beforeEach(() => {
  entries.clear(); attributes.clear();
  browser = Object.assign(new EventTarget(), {
    localStorage: { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } },
    document: { documentElement: { setAttribute: (key: string, value: string) => { attributes.set(key, value); }, removeAttribute: (key: string) => { attributes.delete(key); } } }
  });
  vi.stubGlobal("window", browser);
});
afterEach(() => vi.unstubAllGlobals());

describe("shared panel disclosure preferences", () => {
  it("starts expanded and exposes a stable server-safe default", () => {
    expect(getPanelSectionPreferences()).toEqual(DEFAULT_PANEL_SECTION_PREFERENCES);
    setPanelSectionExpanded("season", false);
    vi.stubGlobal("window", undefined);
    expect(getPanelSectionPreferences()).toEqual(DEFAULT_PANEL_SECTION_PREFERENCES);
    expect(() => applyPanelSectionPreferences()).not.toThrow();
    expect(() => subscribePanelSectionPreferences(() => {})()).not.toThrow();
  });

  it("keeps each panel independent and serializes only the three booleans", () => {
    entries.set(PANEL_SECTION_PREFERENCES_KEY, JSON.stringify({ version: 1, season: false, email: "synthetic-canary@example.invalid", event: "synthetic-private-canary" }));
    setPanelSectionExpanded("tag-filter", false);
    setPanelSectionExpanded("companion-home", false);
    setPanelSectionExpanded("season", true);
    expect(getPanelSectionPreferences()).toEqual({ "tag-filter": false, season: true, "companion-home": false });
    expect(JSON.parse(entries.get(PANEL_SECTION_PREFERENCES_KEY)!)).toEqual({ version: 1, "tag-filter": false, season: true, "companion-home": false });
    expect(attributes.get("data-panel-sections")).toBe("tag-filter companion-home");
    setPanelSectionExpanded("tag-filter", true); setPanelSectionExpanded("companion-home", true);
    expect(attributes.has("data-panel-sections")).toBe(false);
  });

  it("restores saved state in a fresh page context without carrying old memory", () => {
    setPanelSectionExpanded("tag-filter", false);
    const anotherWindow = Object.assign(new EventTarget(), { localStorage: browser.localStorage, document: browser.document });
    vi.stubGlobal("window", anotherWindow);
    expect(getPanelSectionPreferences()).toEqual({ ...DEFAULT_PANEL_SECTION_PREFERENCES, "tag-filter": false });
    entries.clear();
    expect(getPanelSectionPreferences()).toEqual(DEFAULT_PANEL_SECTION_PREFERENCES);
  });

  it("rejects invalid booleans, arrays, unknown versions and corrupt JSON", () => {
    expect(normalizePanelSectionPreferences({ "tag-filter": "false", season: false, "companion-home": 0, extra: false })).toEqual({ ...DEFAULT_PANEL_SECTION_PREFERENCES, season: false });
    expect(normalizePanelSectionPreferences([false, false])).toEqual(DEFAULT_PANEL_SECTION_PREFERENCES);
    for (const raw of ["{", "null", "false", "[]", '{"version":2,"season":false}', '{"season":false}']) {
      entries.set(PANEL_SECTION_PREFERENCES_KEY, raw);
      expect(getPanelSectionPreferences()).toEqual(DEFAULT_PANEL_SECTION_PREFERENCES);
    }
  });

  it("updates same-tab subscribers once and releases event listeners", () => {
    const listener = vi.fn(), stop = subscribePanelSectionPreferences(listener);
    setPanelSectionExpanded("season", false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(PANEL_SECTION_PREFERENCES_EVENT).toBe("vic:panel-sections");
    stop(); setPanelSectionExpanded("season", true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("accepts another tab's change/reset and ignores unrelated storage", () => {
    const listener = vi.fn(), stop = subscribePanelSectionPreferences(listener);
    browser.dispatchEvent(Object.assign(new Event("storage"), { key: "unrelated" }));
    expect(listener).not.toHaveBeenCalled();
    const raw = JSON.stringify({ version: 1, "companion-home": false });
    entries.set(PANEL_SECTION_PREFERENCES_KEY, raw);
    browser.dispatchEvent(Object.assign(new Event("storage"), { key: PANEL_SECTION_PREFERENCES_KEY, newValue: raw }));
    expect(getPanelSectionPreferences()).toEqual({ ...DEFAULT_PANEL_SECTION_PREFERENCES, "companion-home": false });
    expect(attributes.get("data-panel-sections")).toBe("companion-home");
    entries.clear(); browser.dispatchEvent(Object.assign(new Event("storage"), { key: null, newValue: null }));
    expect(getPanelSectionPreferences()).toEqual(DEFAULT_PANEL_SECTION_PREFERENCES);
    expect(attributes.has("data-panel-sections")).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2); stop();
  });

  it("keeps controls usable if all storage access is blocked", () => {
    browser.localStorage.getItem = () => { throw new Error("blocked"); };
    browser.localStorage.setItem = () => { throw new Error("blocked"); };
    setPanelSectionExpanded("tag-filter", false); setPanelSectionExpanded("season", false);
    expect(getPanelSectionPreferences()).toEqual({ "tag-filter": false, season: false, "companion-home": true });
    expect(attributes.get("data-panel-sections")).toBe("tag-filter season");
  });

  it("does not undo an unsaved choice when reads work but writes fail", () => {
    const oldRaw = JSON.stringify({ version: 1, ...DEFAULT_PANEL_SECTION_PREFERENCES });
    entries.set(PANEL_SECTION_PREFERENCES_KEY, oldRaw);
    const save = browser.localStorage.setItem;
    browser.localStorage.setItem = () => { throw new Error("quota"); };
    setPanelSectionExpanded("tag-filter", false); setPanelSectionExpanded("season", false);
    expect(getPanelSectionPreferences()).toEqual({ "tag-filter": false, season: false, "companion-home": true });
    expect(entries.get(PANEL_SECTION_PREFERENCES_KEY)).toBe(oldRaw);
    browser.localStorage.setItem = save; setPanelSectionExpanded("companion-home", false);
    expect(JSON.parse(entries.get(PANEL_SECTION_PREFERENCES_KEY)!)).toEqual({ version: 1, "tag-filter": false, season: false, "companion-home": false });
  });

  it("lets an explicit cross-tab reset supersede a blocked-storage fallback", () => {
    const stop = subscribePanelSectionPreferences(() => {});
    browser.localStorage.getItem = () => { throw new Error("blocked"); };
    browser.localStorage.setItem = () => { throw new Error("blocked"); };
    setPanelSectionExpanded("season", false);
    browser.dispatchEvent(Object.assign(new Event("storage"), { key: null, newValue: null }));
    expect(getPanelSectionPreferences()).toEqual(DEFAULT_PANEL_SECTION_PREFERENCES);
    expect(attributes.has("data-panel-sections")).toBe(false); stop();
  });

  it("keeps prepaint and hydrated parsing identical without interpolating stored text", () => {
    for (const raw of [null, "{", "[]", '{"version":2,"season":false}', '{"version":1,"tag-filter":false,"season":"false","companion-home":false,"extra":"<script>canary</script>"}']) {
      if (raw === null) entries.clear(); else entries.set(PANEL_SECTION_PREFERENCES_KEY, raw);
      attributes.clear();
      runInNewContext(PANEL_SECTION_BOOTSTRAP, { localStorage: browser.localStorage, document: browser.document });
      const painted = attributes.get("data-panel-sections");
      attributes.clear(); applyPanelSectionPreferences();
      expect(attributes.get("data-panel-sections")).toBe(painted);
      expect(painted ?? "").not.toContain("canary");
    }
    browser.localStorage.getItem = () => { throw new Error("blocked"); };
    expect(() => runInNewContext(PANEL_SECTION_BOOTSTRAP, { localStorage: browser.localStorage, document: browser.document })).not.toThrow();
  });

  it("returns copies instead of writable shared state", () => {
    getPanelSectionPreferences().season = false;
    expect(getPanelSectionPreferences().season).toBe(true);
  });
});
