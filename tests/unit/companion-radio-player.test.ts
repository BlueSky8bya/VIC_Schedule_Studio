import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ enabled: true, volume: 60, companion: { enabled: true, sound: true, soundVolume: 60 }, radio: { enabled: true, volume: 35, react: true, moods: { lively: true, graceful: true, calm: true }, excludedIds: [] as string[] }, gain: { gain: { value: 0, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() } }, resume: vi.fn(), ended: null as null | (() => void), observers: [] as Array<() => void>, prefs: [] as Array<() => void> }));
vi.mock("@/lib/ui/sfx", () => ({ soundEnabled: () => state.enabled, soundVolume: () => state.volume, connectCompanionMedia: vi.fn(() => ({ context: Object.assign(new EventTarget(), { currentTime: 0, state: "running", resume: state.resume }), gain: state.gain })) }));
vi.mock("@/lib/ui/viewer-companion/preferences", () => ({ getCompanionPreferences: () => state.companion, subscribeCompanionPreferences: (fn: () => void) => { state.prefs.push(fn); return () => { state.prefs = state.prefs.filter(item => item !== fn); }; } }));
vi.mock("@/lib/ui/viewer-companion/radio-preferences", async () => { const { COMPANION_RADIO_TRACKS } = await import("@/lib/ui/viewer-companion/radio-catalog"); return { getCompanionRadioPreferences: () => state.radio, subscribeCompanionRadioPreferences: (fn: () => void) => { state.prefs.push(fn); return () => { state.prefs = state.prefs.filter(item => item !== fn); }; }, companionRadioPool: () => COMPANION_RADIO_TRACKS.filter(track => state.radio.moods[track.mood] && !state.radio.excludedIds.includes(track.id)) }; });
let created: FakeAudio[];
let playResolve: (() => void) | null;
let shouldWait = false;
class FakeAudio {
  src = ""; preload = ""; onended: (() => void) | null = null; onerror: (() => void) | null = null;
  pause = vi.fn(); load = vi.fn(); removeAttribute = vi.fn(() => { this.src = ""; });
  constructor() { created.push(this); }
  play = vi.fn(() => shouldWait ? new Promise<void>(resolve => { playResolve = resolve; }) : Promise.resolve());
}
let doc: EventTarget & { hidden: boolean; documentElement: { hasAttribute: () => boolean }; querySelector: () => object | null; querySelectorAll: () => object[] };
let radio: typeof import("@/lib/ui/viewer-companion/radio-player");
beforeEach(async () => {
  vi.resetModules(); created = []; playResolve = null; shouldWait = false; state.enabled = true; state.volume = 60; state.companion.enabled = true; state.companion.sound = true; state.companion.soundVolume = 60;
  state.radio.enabled = true; state.radio.volume = 35; state.radio.excludedIds = []; state.radio.moods = { lively: true, graceful: true, calm: true }; state.observers = []; state.prefs = []; state.resume.mockResolvedValue(undefined);
  doc = Object.assign(new EventTarget(), { hidden: false, documentElement: { hasAttribute: () => false }, querySelector: () => null, querySelectorAll: () => [] });
  vi.stubGlobal("document", doc); vi.stubGlobal("window", new EventTarget()); vi.stubGlobal("Audio", FakeAudio); vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("MutationObserver", class { constructor(fn: () => void) { state.observers.push(fn); } observe() {} disconnect() {} });
  radio = await import("@/lib/ui/viewer-companion/radio-player");
});
afterEach(() => { radio.stopCompanionRadio(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("does no audio construction/preload/autoplay on import and rejects disabled/empty/mobile pools", async () => {
  expect(created).toHaveLength(0); expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
  state.enabled = false; expect(await radio.nextCompanionRadio()).toBe(false); expect(created).toHaveLength(0);
  state.enabled = true; state.radio.moods = { lively: false, graceful: false, calm: false }; expect(await radio.nextCompanionRadio()).toBe(false); expect(created).toHaveLength(0);
  state.radio.moods.lively = true; vi.stubGlobal("matchMedia", () => ({ matches: true })); expect(await radio.nextCompanionRadio()).toBe(false); expect(created).toHaveLength(0);
});
it("uses one streamed element, actual success generations and no immediate repeat", async () => {
  expect(await radio.nextCompanionRadio()).toBe(true); const first = radio.getCompanionRadioSnapshot(); expect(first.generation).toBe(1); expect(created[0].preload).toBe("none");
  expect(await radio.nextCompanionRadio()).toBe(true); expect(created).toHaveLength(1); expect(radio.getCompanionRadioSnapshot().trackId).not.toBe(first.trackId); expect(radio.getCompanionRadioSnapshot().generation).toBe(2);
  expect(await radio.toggleCompanionRadio()).toBe(false); expect(radio.getCompanionRadioSnapshot().playing).toBe(false); expect(state.prefs).toHaveLength(0); expect(created[0].src).toBe("");
});
it("cancels a late play success on hidden without publishing a dance or replaying on focus", async () => {
  shouldWait = true; const pending = radio.nextCompanionRadio(); await Promise.resolve(); await Promise.resolve(); expect(playResolve).not.toBe(null);
  doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange")); playResolve!(); expect(await pending).toBe(false);
  expect(radio.getCompanionRadioSnapshot().generation).toBe(0); expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
  doc.hidden = false; doc.dispatchEvent(new Event("visibilitychange")); expect(created[0].play).toHaveBeenCalledTimes(1);
});
it("a second radio click cancels pending playback even before a playing snapshot exists", async () => {
  expect(radio.getCompanionRadioToggleIntent()).toBe("play");
  shouldWait = true; const pending = radio.toggleCompanionRadio(); await Promise.resolve(); await Promise.resolve();
  expect(playResolve).not.toBe(null); expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
  expect(radio.getCompanionRadioToggleIntent()).toBe("stop");
  expect(await radio.toggleCompanionRadio()).toBe(false); playResolve!(); expect(await pending).toBe(false);
  expect(radio.getCompanionRadioSnapshot().generation).toBe(0); expect(state.prefs).toHaveLength(0); expect(created[0].src).toBe("");
  expect(radio.getCompanionRadioToggleIntent()).toBe("play");
});
it("stops immediately on master/creature/radio/mood changes and premiere entry", async () => {
  await radio.nextCompanionRadio(); state.volume = 0; window.dispatchEvent(new Event("vic:sound")); expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
  state.volume = 60; await radio.nextCompanionRadio(); state.companion.enabled = false; [...state.prefs].forEach(fn => fn()); expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
  state.companion.enabled = true; await radio.nextCompanionRadio(); const id = radio.getCompanionRadioSnapshot().trackId!; state.radio.excludedIds = [id]; [...state.prefs].forEach(fn => fn()); expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
  await radio.nextCompanionRadio(); doc.querySelector = () => ({}); state.observers.forEach(fn => fn()); expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
});
it("rejects unknown/excluded track auditions without disturbing current playback", async () => {
  await radio.nextCompanionRadio(); const before = radio.getCompanionRadioSnapshot(); state.radio.excludedIds = ["radio-01"];
  expect(await radio.playCompanionRadioTrack("private-title")).toBe(false); expect(await radio.playCompanionRadioTrack("radio-01")).toBe(false); expect(radio.getCompanionRadioSnapshot()).toBe(before);
});
