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
  expect(prefs.getCompanionRadioPreferences()).toEqual({ enabled: true, volume: 35, react: true, moods: { lively: true, graceful: true, calm: true }, excludedIds: [] });
  expect(prefs.normalizeCompanionRadioPreferences({ volume: 999, react: false, moods: { calm: false }, excludedIds: ["radio-01", "radio-01", "private title"] })).toEqual({ enabled: true, volume: 100, react: false, moods: { lively: true, graceful: true, calm: false }, excludedIds: ["radio-01"] });
  expect(prefs.normalizeCompanionRadioPreferences({ enabled: "false", volume: NaN }).enabled).toBe(true);
});
it("preserves consecutive changes when writes fail over an existing readable value", () => {
  prefs.setCompanionRadioPreferences({ volume: 20 }); fail = true; prefs.setCompanionRadioPreferences({ volume: 45 });
  expect(prefs.getCompanionRadioPreferences().volume).toBe(45); prefs.setCompanionRadioPreferences({ react: false }); expect(prefs.getCompanionRadioPreferences().volume).toBe(45); expect(prefs.getCompanionRadioPreferences().react).toBe(false);
  fail = false; prefs.setCompanionRadioPreferences({ enabled: false }); expect(JSON.parse(data.get(prefs.COMPANION_RADIO_PREFERENCES_KEY)!).volume).toBe(45);
});
it("returns fresh mutable data and excludes disabled moods/individual tracks", () => {
  const before = prefs.getCompanionRadioPreferences(); before.moods.calm = false; expect(prefs.getCompanionRadioPreferences().moods.calm).toBe(true);
  prefs.setCompanionRadioPreferences({ moods: { lively: true, graceful: false, calm: false }, excludedIds: ["radio-01"] });
  expect(prefs.companionRadioPool().every(track => track.mood === "lively" && track.id !== "radio-01")).toBe(true);
});
