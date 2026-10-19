import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMPANION_RADIO_TRACKS } from "@/lib/ui/viewer-companion/radio-catalog";

const state = vi.hoisted(() => ({
  now: 0, master: true, masterVolume: 60, companion: { enabled: true, sound: true, soundVolume: 60 }, radio: { enabled: true, volume: 35, react: true, excludedIds: [] as string[] },
  gain: { gain: { value: 0, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() } }, prefs: [] as Array<() => void>, resume: vi.fn(),
}));
vi.mock("@/lib/ui/sfx", () => ({ soundEnabled: () => state.master, soundVolume: () => state.masterVolume, connectCompanionMedia: vi.fn(() => ({ context: Object.assign(new EventTarget(), { currentTime: 0, state: "running", resume: state.resume }), gain: state.gain })) }));
vi.mock("@/lib/ui/viewer-companion/preferences", () => ({ getCompanionPreferences: () => state.companion, subscribeCompanionPreferences: (fn: () => void) => { state.prefs.push(fn); return () => { state.prefs = state.prefs.filter(item => item !== fn); }; } }));
vi.mock("@/lib/ui/viewer-companion/radio-preferences", async () => {
  const { COMPANION_RADIO_TRACKS } = await import("@/lib/ui/viewer-companion/radio-catalog");
  return { getCompanionRadioPreferences: () => state.radio, companionRadioPool: () => COMPANION_RADIO_TRACKS.filter(track => !state.radio.excludedIds.includes(track.id)), subscribeCompanionRadioPreferences: (fn: () => void) => { state.prefs.push(fn); return () => { state.prefs = state.prefs.filter(item => item !== fn); }; } };
});

let delayed = false, created: FakeAudio[], pending: Array<() => void>;
class FakeAudio {
  src = ""; preload = ""; onended: (() => void) | null = null; onerror: (() => void) | null = null;
  pause = vi.fn(); load = vi.fn(); removeAttribute = vi.fn(() => { this.src = ""; });
  play = vi.fn(() => delayed ? new Promise<void>(resolve => { pending.push(resolve); }) : Promise.resolve());
  constructor() { created.push(this); }
}
let radio: typeof import("@/lib/ui/viewer-companion/radio-player");
let doc: EventTarget & { hidden: boolean; documentElement: { hasAttribute: () => boolean }; querySelector: () => object | null; querySelectorAll: () => object[] };
beforeEach(async () => {
  vi.resetModules(); delayed = false; created = []; pending = []; state.now = 0; state.master = true; state.masterVolume = 60;
  state.companion = { enabled: true, sound: true, soundVolume: 60 }; state.radio = { enabled: true, volume: 35, react: true, excludedIds: [] }; state.prefs = []; state.resume.mockReset().mockResolvedValue(undefined);
  vi.spyOn(performance, "now").mockImplementation(() => state.now);
  doc = Object.assign(new EventTarget(), { hidden: false, documentElement: { hasAttribute: () => false }, querySelector: () => null, querySelectorAll: () => [] });
  vi.stubGlobal("document", doc); vi.stubGlobal("window", new EventTarget()); vi.stubGlobal("Audio", FakeAudio); vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("MutationObserver", class { observe() {} disconnect() {} });
  radio = await import("@/lib/ui/viewer-companion/radio-player");
});
afterEach(() => { radio.stopCompanionRadio(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("141 actual radio contact owns its asynchronous media request", () => {
  it("does not start audio on import and a real manual choice keeps15seconds of priority", async () => {
    expect(created).toHaveLength(0); expect(radio.canCompanionSetRadio()).toBe(true);
    expect(await radio.nextCompanionRadio()).toBe(true);
    expect(radio.canCompanionSetRadio()).toBe(false); const manual = radio.getCompanionRadioSnapshot();
    expect(await radio.setCompanionRadioPlaying(false)).toBe(false); expect(radio.getCompanionRadioSnapshot()).toBe(manual);
    state.now = 14999; expect(await radio.setCompanionRadioPlaying(false)).toBe(false);
    state.now = 15000; expect(radio.canCompanionSetRadio()).toBe(true); expect(await radio.setCompanionRadioPlaying(false)).toBe(true);
    expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
  });

  it("a manual stop of a pending autonomous contact invalidates its late success and extends the lease", async () => {
    delayed = true; const started = radio.setCompanionRadioPlaying(true); expect(created[0].play).toHaveBeenCalledTimes(1);
    expect(radio.getCompanionRadioToggleIntent()).toBe("stop"); state.now = 1000;
    expect(await radio.toggleCompanionRadio()).toBe(false); expect(created[0].src).toBe("");
    pending[0](); expect(await started).toBe(false); expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
    state.now = 15999; expect(await radio.setCompanionRadioPlaying(true)).toBe(false); expect(created[0].play).toHaveBeenCalledTimes(1);
    state.now = 16000; expect(radio.canCompanionSetRadio()).toBe(true);
  });

  it("the settings' explicit manual stop owns its lease while lifecycle cleanup creates no human preference", async () => {
    expect(await radio.setCompanionRadioPlaying(true)).toBe(true); state.now = 5000; radio.stopCompanionRadio("human");
    expect(radio.getCompanionRadioSnapshot().playing).toBe(false); expect(radio.canCompanionSetRadio()).toBe(false);
    state.now = 19999; expect(await radio.setCompanionRadioPlaying(true)).toBe(false);
    state.now = 20000; expect(await radio.setCompanionRadioPlaying(true)).toBe(true);
    state.now = 21000; radio.stopCompanionRadio(new Event("pagehide")); expect(radio.canCompanionSetRadio()).toBe(true);
    expect(await radio.setCompanionRadioPlaying(true)).toBe(true); radio.stopCompanionRadio(); expect(radio.canCompanionSetRadio()).toBe(true);
  });

  it("waits for delayed actual media play before publishing success, then removes its abort listener", async () => {
    delayed = true; const controller = new AbortController(), remove = vi.spyOn(controller.signal, "removeEventListener");
    const started = radio.setCompanionRadioPlaying(true, controller.signal); expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
    state.now = 1800; await Promise.resolve(); expect(radio.getCompanionRadioSnapshot().generation).toBe(0);
    pending[0](); expect(await started).toBe(true); expect(radio.getCompanionRadioSnapshot().generation).toBe(1);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function)); controller.abort();
    expect(radio.getCompanionRadioSnapshot().playing).toBe(true); // Completed contact no longer owns the stream.
  });

  it("an aborted contact never publishes its late play and does not resume on focus", async () => {
    delayed = true; const controller = new AbortController(), started = radio.setCompanionRadioPlaying(true, controller.signal);
    controller.abort(); expect(created[0].src).toBe(""); pending[0](); expect(await started).toBe(false);
    expect(radio.getCompanionRadioSnapshot()).toMatchObject({ generation: 0, playing: false });
    doc.dispatchEvent(new Event("visibilitychange")); expect(created[0].play).toHaveBeenCalledTimes(1);
  });

  it("an older autonomous abort/late resolve cannot stop or overwrite a newer human track", async () => {
    delayed = true; const controller = new AbortController(), autonomous = radio.setCompanionRadioPlaying(true, controller.signal);
    const oldSrc = created[0].src, chosen = COMPANION_RADIO_TRACKS.find(track => track.src !== oldSrc)!;
    state.now = 200; const manual = radio.playCompanionRadioTrack(chosen.id); expect(pending).toHaveLength(2);
    pending[1](); expect(await manual).toBe(true); const current = radio.getCompanionRadioSnapshot(); expect(current.trackId).toBe(chosen.id);
    controller.abort(); expect(created[0].src).toBe(chosen.src);
    pending[0](); expect(await autonomous).toBe(false); expect(radio.getCompanionRadioSnapshot()).toBe(current); expect(created[0].src).toBe(chosen.src);
  });

  it.each(["master", "master-volume", "companion", "companion-sound", "companion-volume", "radio", "radio-volume", "hidden", "mobile", "empty"] as const)("%s OFF refuses autonomous playback without constructing/preloading audio", async stateName => {
    if (stateName === "master") state.master = false;
    if (stateName === "master-volume") state.masterVolume = 0;
    if (stateName === "companion") state.companion.enabled = false;
    if (stateName === "companion-sound") state.companion.sound = false;
    if (stateName === "companion-volume") state.companion.soundVolume = 0;
    if (stateName === "radio") state.radio.enabled = false;
    if (stateName === "radio-volume") state.radio.volume = 0;
    if (stateName === "hidden") doc.hidden = true;
    if (stateName === "mobile") vi.stubGlobal("matchMedia", () => ({ matches: true }));
    if (stateName === "empty") state.radio.excludedIds = COMPANION_RADIO_TRACKS.map(track => track.id);
    expect(await radio.setCompanionRadioPlaying(true)).toBe(false); expect(created).toHaveLength(0); expect(radio.getCompanionRadioSnapshot()).toMatchObject({ generation: 0, playing: false });
  });

  it("a mute while play is pending prevents late publish and does not automatically resume after unmute", async () => {
    delayed = true; const started = radio.setCompanionRadioPlaying(true); state.companion.sound = false;
    [...state.prefs].forEach(fn => fn()); pending[0](); expect(await started).toBe(false);
    expect(radio.getCompanionRadioSnapshot()).toMatchObject({ generation: 0, playing: false });
    state.companion.sound = true; [...state.prefs].forEach(fn => fn()); expect(created[0].play).toHaveBeenCalledTimes(1);
  });

  it("a pre-aborted contact has no media side effect", async () => {
    const controller = new AbortController(); controller.abort();
    expect(await radio.setCompanionRadioPlaying(true, controller.signal)).toBe(false); expect(created).toHaveLength(0);
  });
});
