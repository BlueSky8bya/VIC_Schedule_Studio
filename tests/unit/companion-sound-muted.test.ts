import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_COMPANION_PREFERENCES, normalizeCompanionPreferences } from "@/lib/ui/viewer-companion/preferences";

const voice = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/lib/ui/sfx", () => ({ playCompanionVoice: voice, playCompanionSample: vi.fn(() => false) }));
import { COMPANION_SOUND_MOMENTS, auditionCompanionSound, companionSoundMuted, companionSoundMutedPatch, playCompanionSound, previewCompanionSoundLevel, previewCompanionSoundVolume } from "@/lib/ui/viewer-companion/companion-sound";

// Owner 2026-11-20: each companion sound can be switched off by itself (a
// streamer asked for the jump-landing thud alone), under the sound level.
let now = 0;
beforeEach(() => {
  now += 20000; voice.mockReset().mockReturnValue(true);
  vi.stubGlobal("document", { hidden: false, documentElement: { dataset: {}, hasAttribute: () => false } });
  vi.stubGlobal("window", {});
  vi.spyOn(performance, "now").mockImplementation(() => now);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("one sound switched off by itself", () => {
  it("starts with nothing off, and a record without the field reads the same", () => {
    expect(DEFAULT_COMPANION_PREFERENCES.soundMuted).toEqual([]);
    expect(normalizeCompanionPreferences({ version: 1, sound: true }).soundMuted).toEqual([]);
  });
  it("keeps only known sounds, once each, in a fixed order", () => {
    expect(normalizeCompanionPreferences({ soundMuted: ["play", "nope", "land", "land", 3] }).soundMuted).toEqual(["land", "play"]);
    // A malformed value keeps the current choice.
    const base = { ...DEFAULT_COMPANION_PREFERENCES, soundMuted: ["land"] as const };
    expect(normalizeCompanionPreferences({ soundMuted: "land" }, base).soundMuted).toEqual(["land"]);
  });
  it("silences exactly that sound and leaves its split siblings alone", () => {
    const preferences = { ...DEFAULT_COMPANION_PREFERENCES, ...companionSoundMutedPatch(DEFAULT_COMPANION_PREFERENCES, "land", true) };
    expect(companionSoundMuted(preferences, "land")).toBe(true);
    expect(playCompanionSound("land", preferences, "direct")).toBe(false);
    expect(voice).not.toHaveBeenCalled();
    for (const moment of ["food-land", "hat-land", "pet"] as const) { now += 20000; expect(playCompanionSound(moment, preferences, "direct"), moment).toBe(true); }
  });
  it("switches one sound on and off without touching the others", () => {
    let preferences = { ...DEFAULT_COMPANION_PREFERENCES };
    preferences = { ...preferences, ...companionSoundMutedPatch(preferences, "scatter", true) };
    preferences = { ...preferences, ...companionSoundMutedPatch(preferences, "land", true) };
    expect(preferences.soundMuted).toEqual(["land", "scatter"]);
    preferences = { ...preferences, ...companionSoundMutedPatch(preferences, "land", false) };
    expect(preferences.soundMuted).toEqual(["scatter"]);
  });
  it("a tile turned back on is heard; a muted one is not", () => {
    const muted = { ...DEFAULT_COMPANION_PREFERENCES, soundMuted: ["land"] as const };
    expect(auditionCompanionSound("land", muted)).toBe(false);
    now += 20000;
    expect(auditionCompanionSound("land", { ...muted, ...companionSoundMutedPatch(muted, "land", false) })).toBe(true);
  });
  it("level and volume previews still sound with every single sound off", () => {
    const all = { ...DEFAULT_COMPANION_PREFERENCES, soundMuted: [...COMPANION_SOUND_MOMENTS] };
    expect(previewCompanionSoundLevel("touch", all)).toBe(true);
    now += 20000;
    expect(previewCompanionSoundVolume(all)).toBe(true);
    now += 20000;
    for (const moment of COMPANION_SOUND_MOMENTS) { now += 20000; expect(playCompanionSound(moment, all, "direct"), moment).toBe(false); }
  });
});
