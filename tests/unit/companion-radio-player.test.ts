import { COMPANION_RADIO_TRACKS } from "@/lib/ui/viewer-companion/radio-catalog";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ enabled: true, volume: 60, companion: { enabled: true, sound: true, soundVolume: 60, soundCare: true, soundMotion: true, soundKeepsakes: true }, radio: { enabled: true, volume: 35, react: true, moods: { lively: true, graceful: true, calm: true }, excludedIds: [] as string[] }, gain: { gain: { value: 0, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() } }, resume: vi.fn(), ended: null as null | (() => void), observers: [] as Array<() => void>, prefs: [] as Array<() => void> }));
vi.mock("@/lib/ui/sfx", () => ({ soundEnabled: () => state.enabled, soundVolume: () => state.volume, connectCompanionMedia: vi.fn(() => ({ context: Object.assign(new EventTarget(), { currentTime: 0, state: "running", resume: state.resume }), gain: state.gain })) }));
vi.mock("@/lib/ui/viewer-companion/preferences", () => ({ getCompanionPreferences: () => state.companion, subscribeCompanionPreferences: (fn: () => void) => { state.prefs.push(fn); return () => { state.prefs = state.prefs.filter(item => item !== fn); }; } }));
vi.mock("@/lib/ui/viewer-companion/radio-preferences", async () => { const { COMPANION_RADIO_TRACKS } = await import("@/lib/ui/viewer-companion/radio-catalog"); return { getCompanionRadioPreferences: () => state.radio, subscribeCompanionRadioPreferences: (fn: () => void) => { state.prefs.push(fn); return () => { state.prefs = state.prefs.filter(item => item !== fn); }; }, companionRadioPool: () => COMPANION_RADIO_TRACKS.filter(track => !state.radio.excludedIds.includes(track.id)) }; });
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
  vi.resetModules(); created = []; playResolve = null; shouldWait = false; state.enabled = true; state.volume = 60; state.companion.enabled = true; state.companion.sound = true; state.companion.soundVolume = 60; state.companion.soundMotion = true; state.radio.react = true;
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
  state.enabled = true; const { COMPANION_RADIO_TRACKS } = await import("@/lib/ui/viewer-companion/radio-catalog"); state.radio.excludedIds = COMPANION_RADIO_TRACKS.map(track => track.id); expect(await radio.nextCompanionRadio()).toBe(false); expect(created).toHaveLength(0);
  state.radio.excludedIds = []; vi.stubGlobal("matchMedia", () => ({ matches: true })); expect(await radio.nextCompanionRadio()).toBe(false); expect(created).toHaveLength(0);
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
it("stops immediately on master/creature/radio changes and premiere entry", async () => {
  await radio.nextCompanionRadio(); state.volume = 0; window.dispatchEvent(new Event("vic:sound")); expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
  state.volume = 60; await radio.nextCompanionRadio(); state.companion.enabled = false; [...state.prefs].forEach(fn => fn()); expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
  state.companion.enabled = true; await radio.nextCompanionRadio(); const id = radio.getCompanionRadioSnapshot().trackId!; state.radio.excludedIds = [id]; [...state.prefs].forEach(fn => fn()); expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
  await radio.nextCompanionRadio(); doc.querySelector = () => ({}); state.observers.forEach(fn => fn()); expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
});
it("uses the music and master faders once, keeping old levels and every mute gate", async () => {
  const oldDefaultGain = Math.pow(.6, 1.6) * Math.pow(.6, 1.3) * .35 * .65;
  const gain = radio.companionRadioOutputGain(60, 35);
  expect(gain).toBeCloseTo(.15456460379174497, 10);
  expect(20 * Math.log10(gain / oldDefaultGain)).toBeCloseTo(9.509800357168155, 8);
  await radio.nextCompanionRadio();
  expect(state.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(gain, 0, .04);
  state.companion.soundVolume = 15; [...state.prefs].forEach(fn => fn());
  expect(state.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(gain, 0, .04);
  expect(state.radio.volume).toBe(35); expect(state.volume).toBe(60);
  // The radio the user plays no longer follows the companion sound level (redesign 2-ra): it keeps playing and can be started.
  state.companion.soundVolume = 0; [...state.prefs].forEach(fn => fn());
  expect(radio.getCompanionRadioSnapshot().playing).toBe(true);
  state.companion.soundVolume = 60; state.radio.volume = 0; expect(await radio.nextCompanionRadio()).toBe(false);
  state.radio.volume = 35; state.companion.sound = false; expect(await radio.nextCompanionRadio()).toBe(true);
  state.companion.sound = true; state.enabled = false; [...state.prefs].forEach(fn => fn());
  expect(radio.getCompanionRadioSnapshot().playing).toBe(false); state.enabled = true;
  for (const invalid of [NaN, Infinity, -1]) expect(radio.companionRadioOutputGain(invalid, 35)).toBe(0);
  expect(radio.companionRadioOutputGain(100, 100)).toBe(1);
  expect(radio.companionRadioOutputGain(999, 999)).toBe(1);
  expect(radio.companionRadioOutputGain(0, 100)).toBe(0);
});
it("rejects unknown/excluded track auditions without disturbing current playback", async () => {
  await radio.nextCompanionRadio(); const before = radio.getCompanionRadioSnapshot(); state.radio.excludedIds = [COMPANION_RADIO_TRACKS[0].id];
  expect(await radio.playCompanionRadioTrack("private-title")).toBe(false); expect(await radio.playCompanionRadioTrack(COMPANION_RADIO_TRACKS[0].id)).toBe(false); expect(radio.getCompanionRadioSnapshot()).toBe(before);
});

it("starts media play in the original gesture before a cold resume resolves", async () => {
  let resumed: (() => void) | undefined;
  state.resume.mockImplementationOnce(() => new Promise<void>(resolve => { resumed = resolve; }));
  const pending = radio.nextCompanionRadio();
  // No await/microtask is allowed before media.play: this is the original
  // trusted input task even when WebAudio's first resume crosses a task.
  expect(created).toHaveLength(1); expect(created[0].play).toHaveBeenCalledTimes(1);
  expect(created[0].src).not.toBe(""); expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
  resumed!(); expect(await pending).toBe(true);
  expect(radio.getCompanionRadioSnapshot().generation).toBe(1);
});

it("keeps the initial suspended notification pending but stops an established interrupted stream", async () => {
  let resumed: (() => void) | undefined;
  state.resume.mockImplementationOnce(() => new Promise<void>(resolve => { resumed = resolve; }));
  const pending = radio.nextCompanionRadio();
  const { connectCompanionMedia } = await import("@/lib/ui/sfx");
  const output = vi.mocked(connectCompanionMedia).mock.results.at(-1)!.value as { context: AudioContext };
  Object.defineProperty(output.context, "state", { value: "suspended", writable: true });
  output.context.dispatchEvent(new Event("statechange"));
  expect(radio.getCompanionRadioToggleIntent()).toBe("stop");
  Object.defineProperty(output.context, "state", { value: "running", writable: true });
  resumed!(); expect(await pending).toBe(true);
  Object.defineProperty(output.context, "state", { value: "interrupted", writable: true });
  output.context.dispatchEvent(new Event("statechange"));
  expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
  expect(created[0].src).toBe("");
});

it("never publishes a cold stream if the context is interrupted before both gates settle", async () => {
  let resumed: (() => void) | undefined;
  state.resume.mockImplementationOnce(() => new Promise<void>(resolve => { resumed = resolve; }));
  const pending = radio.nextCompanionRadio();
  const { connectCompanionMedia } = await import("@/lib/ui/sfx");
  const output = vi.mocked(connectCompanionMedia).mock.results.at(-1)!.value as { context: AudioContext };
  Object.defineProperty(output.context, "state", { value: "interrupted", writable: true });
  output.context.dispatchEvent(new Event("statechange"));
  resumed!(); expect(await pending).toBe(false);
  expect(radio.getCompanionRadioSnapshot()).toMatchObject({ generation: 0, playing: false });
});

// Settings redesign 2-ra: who started the playback decides who may end or continue it.
const settle = async () => { for (let turn = 0; turn < 6; turn += 1) await Promise.resolve(); };
it("playback the user started stays theirs through the next tracks: the companion can neither stop it nor take it over", async () => {
  expect(await radio.nextCompanionRadio()).toBe(true); expect(radio.getCompanionRadioOwner()).toBe("human");
  vi.spyOn(performance, "now").mockReturnValue(1e9); // long past the 15s lease
  expect(radio.canCompanionSetRadio()).toBe(false);
  const mine = radio.getCompanionRadioSnapshot();
  expect(await radio.setCompanionRadioPlaying(false)).toBe(false); expect(radio.getCompanionRadioSnapshot()).toBe(mine);
  expect(await radio.setCompanionRadioPlaying(true)).toBe(false); expect(radio.getCompanionRadioOwner()).toBe("human");
  expect(await radio.nextCompanionRadio("companion")).toBe(false); expect(radio.getCompanionRadioSnapshot()).toBe(mine);
  // The track ends: the user keeps listening, at any sound level and with self-start off.
  state.companion.sound = false; state.radio.react = false;
  created[0].onended!(); await settle();
  expect(radio.getCompanionRadioSnapshot().playing).toBe(true); expect(radio.getCompanionRadioSnapshot().generation).toBe(mine.generation + 1);
  expect(radio.getCompanionRadioOwner()).toBe("human");
});
it("the companion starts the radio only at the all level with self-start on, and loses it when either goes", async () => {
  state.companion.soundMotion = false; expect(radio.companionMayStartRadio()).toBe(false); expect(await radio.setCompanionRadioPlaying(true)).toBe(false);
  state.companion.soundMotion = true; state.radio.react = false; expect(await radio.setCompanionRadioPlaying(true)).toBe(false);
  state.companion.sound = false; state.radio.react = true; expect(await radio.setCompanionRadioPlaying(true)).toBe(false);
  expect(created).toHaveLength(0);
  state.companion.sound = true; expect(await radio.setCompanionRadioPlaying(true)).toBe(true); expect(radio.getCompanionRadioOwner()).toBe("companion");
  // Lowering the level stops what the companion started, at once.
  state.companion.soundMotion = false; [...state.prefs].forEach(fn => fn());
  expect(radio.getCompanionRadioSnapshot().playing).toBe(false); expect(radio.getCompanionRadioOwner()).toBe(null);
  // Raising it again does not bring the music back by itself.
  state.companion.soundMotion = true; [...state.prefs].forEach(fn => fn());
  expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
  // Self-start switched off while it plays: same.
  expect(await radio.setCompanionRadioPlaying(true)).toBe(true);
  state.radio.react = false; [...state.prefs].forEach(fn => fn());
  expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
});
it("what the companion started becomes the user's on a press of next, and then survives a lower level and the end of the track", async () => {
  expect(await radio.setCompanionRadioPlaying(true)).toBe(true); expect(radio.getCompanionRadioOwner()).toBe("companion");
  expect(await radio.nextCompanionRadio()).toBe(true); expect(radio.getCompanionRadioOwner()).toBe("human");
  state.companion.soundMotion = false; state.radio.react = false; [...state.prefs].forEach(fn => fn());
  expect(radio.getCompanionRadioSnapshot().playing).toBe(true);
  created[0].onended!(); await settle();
  expect(radio.getCompanionRadioSnapshot().playing).toBe(true); expect(radio.getCompanionRadioOwner()).toBe("human");
});
it("a track the companion started continues only while it still may", async () => {
  expect(await radio.setCompanionRadioPlaying(true)).toBe(true); const first = radio.getCompanionRadioSnapshot();
  created[0].onended!(); await settle();
  expect(radio.getCompanionRadioSnapshot().generation).toBe(first.generation + 1); expect(radio.getCompanionRadioOwner()).toBe("companion");
  // The level drops without a preference event reaching the monitor: the end of the track does not start another.
  state.companion.soundMotion = false;
  created[0].onended!(); await settle();
  expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
});
it("must-stop cases end the playback the user started too, and nothing resumes afterwards", async () => {
  expect(await radio.nextCompanionRadio()).toBe(true);
  doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange"));
  expect(radio.getCompanionRadioSnapshot().playing).toBe(false); expect(radio.getCompanionRadioOwner()).toBe(null);
  doc.hidden = false; doc.dispatchEvent(new Event("visibilitychange"));
  expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
  expect(await radio.nextCompanionRadio()).toBe(true); state.companion.enabled = false; [...state.prefs].forEach(fn => fn());
  expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
});
it("while the companion's request is still starting: a lower level cancels it, and a press by the user takes it over for good", async () => {
  shouldWait = true;
  const started = radio.setCompanionRadioPlaying(true); await settle();
  expect(radio.getCompanionRadioOwner()).toBe("companion"); expect(radio.getCompanionRadioToggleIntent()).toBe("stop");
  state.companion.soundMotion = false; [...state.prefs].forEach(fn => fn());
  expect(radio.getCompanionRadioOwner()).toBe(null); playResolve!(); expect(await started).toBe(false);
  expect(radio.getCompanionRadioSnapshot().playing).toBe(false);
  // Again, and this time the user picks a track before it has started.
  state.companion.soundMotion = true;
  const controller = new AbortController(), again = radio.setCompanionRadioPlaying(true, controller.signal); await settle();
  const first = playResolve!, chosen = COMPANION_RADIO_TRACKS[3];
  const mine = radio.playCompanionRadioTrack(chosen.id); await settle();
  expect(radio.getCompanionRadioOwner()).toBe("human");
  first(); expect(await again).toBe(false);
  playResolve!(); expect(await mine).toBe(true);
  // The companion's late cancel arrives after the user took over: it must not touch the user's playback.
  controller.abort(); await settle();
  expect(radio.getCompanionRadioSnapshot()).toMatchObject({ playing: true, trackId: chosen.id }); expect(radio.getCompanionRadioOwner()).toBe("human");
});
it("a request by the user that is still starting goes on when the level drops or self-start is switched off", async () => {
  shouldWait = true;
  const mine = radio.nextCompanionRadio(); await settle();
  state.companion.sound = false; state.radio.react = false; [...state.prefs].forEach(fn => fn());
  expect(radio.getCompanionRadioOwner()).toBe("human");
  playResolve!(); expect(await mine).toBe(true); expect(radio.getCompanionRadioSnapshot().playing).toBe(true);
});
it("the companion's request does not publish if the level dropped silently while it was starting", async () => {
  shouldWait = true;
  const started = radio.setCompanionRadioPlaying(true); await settle();
  state.radio.react = false; // no event reaches the monitor
  playResolve!(); expect(await started).toBe(false);
  expect(radio.getCompanionRadioSnapshot().playing).toBe(false); expect(radio.getCompanionRadioOwner()).toBe(null);
});
