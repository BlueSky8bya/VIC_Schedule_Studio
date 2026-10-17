import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyPanelSectionPreferences, COMPANION_PANEL_SECTION_PREFERENCES, DEFAULT_PANEL_SECTION_PREFERENCES, getPanelSectionPreferences, normalizePanelSectionPreferences, PANEL_SECTION_BOOTSTRAP, PANEL_SECTION_PREFERENCES_EVENT, PANEL_SECTION_PREFERENCES_KEY, setPanelSectionExpanded, subscribePanelSectionPreferences } from "@/lib/ui/panel-section-preferences";
import { COMPANION_PREFERENCES_KEY, getCompanionPreferences, setCompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { POSTER_AGENDA_QUERY } from "@/lib/ui/breakpoints";

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

describe("companion-aware first-visit disclosures", () => {
  function device(mobile = false) {
    const query = Object.assign(new EventTarget(), { matches: mobile });
    const matchMedia = vi.fn((value: string) => { expect(value).toBe(POSTER_AGENDA_QUERY); return query; });
    Object.assign(browser, { matchMedia });
    return { query, matchMedia };
  }

  it("folds untouched tag and season on an enabled desktop without writing defaults", () => {
    device();
    expect(getPanelSectionPreferences()).toEqual(COMPANION_PANEL_SECTION_PREFERENCES);
    applyPanelSectionPreferences();
    expect(attributes.get("data-panel-sections")).toBe("tag-filter season");
    expect(entries.has(PANEL_SECTION_PREFERENCES_KEY)).toBe(false);
  });

  it("keeps mobile, explicit OFF and malformed companion records open", () => {
    const { query } = device(true);
    expect(getPanelSectionPreferences()).toEqual(DEFAULT_PANEL_SECTION_PREFERENCES);
    query.matches = false;
    for (const raw of ['{"version":1,"enabled":false}', '{', '[]', '{"version":2,"enabled":true}', '{"version":1,"enabled":"true"}']) {
      entries.set(COMPANION_PREFERENCES_KEY, raw);
      expect(getPanelSectionPreferences()).toEqual(DEFAULT_PANEL_SECTION_PREFERENCES);
    }
    entries.set(COMPANION_PREFERENCES_KEY, '{"version":1}');
    expect(getPanelSectionPreferences()).toEqual(COMPANION_PANEL_SECTION_PREFERENCES);
  });

  it("preserves all valid legacy choices instead of resetting them for a release", () => {
    device();
    entries.set(PANEL_SECTION_PREFERENCES_KEY, JSON.stringify({ version: 1, "tag-filter": true, season: true, "companion-home": false }));
    expect(getPanelSectionPreferences()).toEqual({ "tag-filter": true, season: true, "companion-home": false });
  });

  it("stores only actual changes and keeps them through master toggles and reload", () => {
    device(); entries.set(COMPANION_PREFERENCES_KEY, '{"version":1,"enabled":false}');
    setPanelSectionExpanded("tag-filter", false); setPanelSectionExpanded("tag-filter", true);
    expect(JSON.parse(entries.get(PANEL_SECTION_PREFERENCES_KEY)!)).toEqual({ version: 1, "tag-filter": true });
    entries.set(COMPANION_PREFERENCES_KEY, '{"version":1,"enabled":true}');
    expect(getPanelSectionPreferences()).toEqual({ "tag-filter": true, season: false, "companion-home": true });
    setPanelSectionExpanded("season", true); setPanelSectionExpanded("companion-home", false);
    const another = Object.assign(new EventTarget(), { localStorage: browser.localStorage, document: browser.document, matchMedia: () => ({ matches: false }) });
    vi.stubGlobal("window", another);
    expect(getPanelSectionPreferences()).toEqual({ "tag-filter": true, season: true, "companion-home": false });
  });

  it("updates untouched defaults for master/capability changes without rewriting choices", () => {
    const { query } = device(), listener = vi.fn(), stop = subscribePanelSectionPreferences(listener);
    setCompanionPreferences({ enabled: false });
    expect(attributes.has("data-panel-sections")).toBe(false);
    entries.set(COMPANION_PREFERENCES_KEY, '{"version":1,"enabled":true}');
    browser.dispatchEvent(Object.assign(new Event("storage"), { key: COMPANION_PREFERENCES_KEY, newValue: entries.get(COMPANION_PREFERENCES_KEY) }));
    expect(attributes.get("data-panel-sections")).toBe("tag-filter season");
    query.matches = true; query.dispatchEvent(new Event("change"));
    expect(attributes.has("data-panel-sections")).toBe(false);
    expect(listener).toHaveBeenCalledTimes(3); expect(entries.has(PANEL_SECTION_PREFERENCES_KEY)).toBe(false);
    stop(); query.matches = false; query.dispatchEvent(new Event("change")); expect(listener).toHaveBeenCalledTimes(3);
  });

  it("matches prepaint and hydration across capability, master and partial/invalid records", () => {
    const { query, matchMedia } = device();
    for (const mobile of [false, true]) for (const master of [null, '{"version":1,"enabled":true}', '{"version":1,"enabled":false}', '{"version":1}', '{"version":1,"enabled":0}', '{', '{"version":2}']) for (const panel of [null, '{', '{"version":1,"tag-filter":true}', '{"version":1,"season":false,"companion-home":false}', '{"version":1,"season":"false","extra":"<script>canary</script>"}']) {
      query.matches = mobile;
      if (master === null) entries.delete(COMPANION_PREFERENCES_KEY); else entries.set(COMPANION_PREFERENCES_KEY, master);
      if (panel === null) entries.delete(PANEL_SECTION_PREFERENCES_KEY); else entries.set(PANEL_SECTION_PREFERENCES_KEY, panel);
      attributes.clear(); runInNewContext(PANEL_SECTION_BOOTSTRAP, { localStorage: browser.localStorage, document: browser.document, matchMedia });
      const painted = attributes.get("data-panel-sections"); attributes.clear(); applyPanelSectionPreferences();
      expect(attributes.get("data-panel-sections"), `${mobile}/${master}/${panel}`).toBe(painted);
      expect(painted ?? "").not.toContain("canary");
    }
  });

  it("uses the same first-visit desktop defaults when storage is wholly blocked", () => {
    const { matchMedia } = device();
    entries.set(COMPANION_PREFERENCES_KEY, '{"version":1,"enabled":true}'); getCompanionPreferences();
    browser.localStorage.getItem = () => { throw new Error("blocked"); };
    runInNewContext(PANEL_SECTION_BOOTSTRAP, { localStorage: browser.localStorage, document: browser.document, matchMedia });
    expect(attributes.get("data-panel-sections")).toBe("tag-filter season");
    attributes.clear(); applyPanelSectionPreferences();
    expect(attributes.get("data-panel-sections")).toBe("tag-filter season");
  });

  it("consumes a cross-tab master OFF before resolving a failed-write ON fallback", () => {
    device(); entries.set(COMPANION_PREFERENCES_KEY, '{"version":1,"enabled":false}');
    getCompanionPreferences();
    browser.localStorage.setItem = () => { throw new Error("quota"); };
    setCompanionPreferences({ enabled: true });
    const listener = vi.fn(), stop = subscribePanelSectionPreferences(listener);
    applyPanelSectionPreferences(); expect(attributes.get("data-panel-sections")).toBe("tag-filter season");
    browser.dispatchEvent(Object.assign(new Event("storage"), { key: COMPANION_PREFERENCES_KEY, newValue: entries.get(COMPANION_PREFERENCES_KEY) }));
    expect(getCompanionPreferences().enabled).toBe(false);
    expect(attributes.has("data-panel-sections")).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1); stop();
  });
});
