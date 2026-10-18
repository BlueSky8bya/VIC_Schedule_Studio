import { afterEach, beforeEach, expect, it, vi } from "vitest";
let prefs: typeof import("@/lib/ui/viewer-companion/radio-preferences");
let data: Map<string, string>; let fail = false;
beforeEach(async () => {
  vi.resetModules(); data = new Map(); fail = false;
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { if (fail) throw Error("quota"); data.set(key, value); } } }));
  prefs = await import("@/lib/ui/viewer-companion/radio-preferences");
});
afterEach(() => vi.unstubAllGlobals());
it("defaults available with no playback state and validates every saved field", () => {
  expect(prefs.getCompanionRadioPreferences()).toEqual({ enabled: true, volume: 35, react: true, excludedIds: [] });
  expect(prefs.normalizeCompanionRadioPreferences({ volume: 999, react: false, moods: { calm: false }, excludedIds: ["radio-01", "radio-01", "private title"] })).toEqual({ enabled: true, volume: 100, react: false, excludedIds: ["radio-01"] });
  expect(prefs.normalizeCompanionRadioPreferences({ enabled: "false", volume: NaN }).enabled).toBe(true);
});
it("preserves consecutive changes when writes fail over an existing readable value", () => {
  prefs.setCompanionRadioPreferences({ volume: 20 }); fail = true; prefs.setCompanionRadioPreferences({ volume: 45 });
  expect(prefs.getCompanionRadioPreferences().volume).toBe(45); prefs.setCompanionRadioPreferences({ react: false }); expect(prefs.getCompanionRadioPreferences().volume).toBe(45); expect(prefs.getCompanionRadioPreferences().react).toBe(false);
  fail = false; prefs.setCompanionRadioPreferences({ enabled: false }); expect(JSON.parse(data.get(prefs.COMPANION_RADIO_PREFERENCES_KEY)!).volume).toBe(45);
});
it("retires old mood filters while preserving saved exclusions, mute and volume", () => {
  data.set(prefs.COMPANION_RADIO_PREFERENCES_KEY, JSON.stringify({ enabled: false, volume: 15, react: false, moods: { lively: false, graceful: false, calm: false }, excludedIds: ["radio-01"] }));
  expect(prefs.getCompanionRadioPreferences()).toEqual({ enabled: false, volume: 15, react: false, excludedIds: ["radio-01"] });
  expect(new Set(prefs.companionRadioPool().map(track => track.mood))).toEqual(new Set(["lively", "graceful", "calm"]));
  expect(prefs.companionRadioPool().some(track => track.id === "radio-01")).toBe(false);
  const before = prefs.getCompanionRadioPreferences(); before.excludedIds.push("radio-02");
  expect(prefs.getCompanionRadioPreferences().excludedIds).toEqual(["radio-01"]);
  prefs.setCompanionRadioPreferences({ react: true });
  expect(JSON.parse(data.get(prefs.COMPANION_RADIO_PREFERENCES_KEY)!)).toEqual({ enabled: false, volume: 15, react: true, excludedIds: ["radio-01"] });
});
