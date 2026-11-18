import { connectCompanionMedia, soundEnabled, soundVolume } from "@/lib/ui/sfx";
import { POSTER_AGENDA_QUERY } from "@/lib/ui/breakpoints";
import { getCompanionPreferences, subscribeCompanionPreferences } from "./preferences";
import { COMPANION_RADIO_TRACKS, type CompanionRadioMood, type CompanionRadioTrack } from "./radio-catalog";
import { companionRadioPool, getCompanionRadioPreferences, subscribeCompanionRadioPreferences } from "./radio-preferences";
import { companionSoundLevel } from "./settings-levels";

export type CompanionRadioSnapshot = Readonly<{ generation: number; playing: boolean; trackId: string | null; mood: CompanionRadioMood | null; bpm: number; startedAt: number }>;
let snapshot: CompanionRadioSnapshot = { generation: 0, playing: false, trackId: null, mood: null, bpm: 0, startedAt: 0 };
const listeners = new Set<() => void>();
let media: HTMLAudioElement | null = null;
let output: ReturnType<typeof connectCompanionMedia> = null;
let request = 0;
let teardown: (() => void) | null = null;
let pendingTrackId: string | null = null;
let humanPriorityUntil = -Infinity;
type RadioSource = "human" | "companion";
/** Whose playback this is, from the request until it stops (settings redesign
 * 2-라). What the user started is theirs through every following track; the
 * companion can neither take it over nor switch it off. What the companion
 * started becomes the user's the moment they press play, next or a track. */
let owner: RadioSource | null = null;
export const getCompanionRadioOwner = () => owner;
/** The companion may touch the radio: not within the user's 15s lease after a
 * press, and never while the user's own playback is pending or playing. */
export const canCompanionSetRadio = () => typeof document !== "undefined" && performance.now() >= humanPriorityUntil && owner !== "human";
function admit(source: RadioSource) {
  const now = performance.now();
  if (source === "companion" && now < humanPriorityUntil) return false;
  if (source === "human") humanPriorityUntil = now + 15000;
  return true;
}
export const getCompanionRadioSnapshot = () => snapshot;
/** The next real toggle also stops an in-flight play request. Activity uses
 * this same intent rather than mistaking a not-yet-playing request for play. */
export const getCompanionRadioToggleIntent = (): "play" | "stop" => snapshot.playing || pendingTrackId !== null ? "stop" : "play";
export function subscribeCompanionRadio(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
function emit(next: CompanionRadioSnapshot) { snapshot = next; for (const listener of listeners) listener(); }
/** What any playback needs, whoever started it. The companion's own sound
 * level is no longer part of it: the radio is the user's to play whenever the
 * site's sound and the radio switch are on. */
function allowed() {
  if (typeof document === "undefined" || document.hidden || matchMedia(POSTER_AGENDA_QUERY).matches || document.documentElement.hasAttribute("data-showcase") || document.querySelector("[data-companion-premiere-owner]")) return false;
  const companion = getCompanionPreferences(), radio = getCompanionRadioPreferences();
  return companion.enabled && radio.enabled && radio.volume > 0 && soundEnabled() && soundVolume() > 0;
}
/** Starting the radio by itself is one of the companion's own sounds: only at
 * the "all" level and with "빅타민이 스스로 틀기" on. Read fresh each time. */
export function companionMayStartRadio(): boolean {
  return allowed() && companionSoundLevel(getCompanionPreferences()) === "all" && getCompanionRadioPreferences().react;
}
function mix() {
  if (!output) return;
  const radio = getCompanionRadioPreferences();
  // Music has its own fader. Applying the creature's effects fader plus an
  // extra .65 trim attenuated the default stream by another 9.51 dB. Shared
  // mute/zero-volume gates still apply in allowed(), without changing saves.
  output.gain.gain.setTargetAtTime(companionRadioOutputGain(soundVolume(), radio.volume), output.context.currentTime, .04);
}
/** Bounded music fader into the existing single context/master bus. */
export function companionRadioOutputGain(masterVolume: number, radioVolume: number): number {
  const level = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) / 100 : 0;
  return Math.pow(level(masterVolume), 1.6) * level(radioVolume);
}
/** Stop invalidates pending play/resume/decode before releasing listeners and
 * the stream. Nothing resumes automatically after focus, unmute or remount. */
export function stopCompanionRadio(source?: RadioSource | Event): void {
  if (source === "human") admit("human");
  request++;
  pendingTrackId = null; owner = null;
  teardown?.(); teardown = null;
  if (media) { media.pause(); media.removeAttribute("src"); media.load(); }
  if (output) { output.gain.gain.cancelScheduledValues(output.context.currentTime); output.gain.gain.value = 0; }
  if (snapshot.playing) emit({ ...snapshot, playing: false });
}
function monitor() {
  const changed = () => {
    const track = COMPANION_RADIO_TRACKS.find(item => item.id === (pendingTrackId ?? snapshot.trackId));
    // Lowering the sound level or switching self-start off ends only what the companion started.
    if (!allowed() || owner === "companion" && !companionMayStartRadio() || track && !companionRadioPool().some(item => item.id === track.id)) stopCompanionRadio(); else mix();
  };
  const unradio = subscribeCompanionRadioPreferences(changed), unpet = subscribeCompanionPreferences(changed);
  const mutation = new MutationObserver(changed);
  mutation.observe(document.documentElement, { attributes: true, attributeFilter: ["data-showcase"] });
  for (const page of document.querySelectorAll(".poster-page,.studio-shell")) mutation.observe(page, { attributes: true, attributeFilter: ["data-companion-premiere-owner"] });
  window.addEventListener("vic:sound", changed); window.addEventListener("storage", changed);
  document.addEventListener("visibilitychange", changed); window.addEventListener("resize", changed); window.addEventListener("pagehide", stopCompanionRadio);
  const context = output?.context;
  // A cold context can report its initial suspended state while resume is
  // pending. Only interrupt an established stream; pending resume/play has
  // its own rejection and cancellation path.
  const stateChanged = () => { if (pendingTrackId === null && context?.state !== "running") stopCompanionRadio(); };
  context?.addEventListener("statechange", stateChanged);
  teardown = () => { unradio(); unpet(); mutation.disconnect(); window.removeEventListener("vic:sound", changed); window.removeEventListener("storage", changed); document.removeEventListener("visibilitychange", changed); window.removeEventListener("resize", changed); window.removeEventListener("pagehide", stopCompanionRadio); context?.removeEventListener("statechange", stateChanged); };
}
async function play(track: CompanionRadioTrack, source: RadioSource): Promise<boolean> {
  if (!allowed() || source === "companion" && !companionMayStartRadio()) { stopCompanionRadio(); return false; }
  stopCompanionRadio();
  const token = request;
  pendingTrackId = track.id; owner = source;
  media ??= new Audio();
  media.preload = "none";
  output ??= connectCompanionMedia(media);
  if (!output) { stopCompanionRadio(); return false; }
  // The next track belongs to whoever owns this one: the user keeps listening, the companion goes on only while it still may.
  media.onended = () => { if (token === request && snapshot.playing && allowed()) void advance(source); };
  media.onerror = () => { if (token === request) stopCompanionRadio(); };
  monitor();
  try {
    // Both browser gates must start inside this same trusted input task. A
    // cold resume may complete in a later task; awaiting it before play()
    // loses the transient activation on browsers with strict media policy.
    media.src = track.src; mix();
    const resumed = output.context.resume(), played = media.play();
    await Promise.all([resumed, played]);
    if (token !== request) return false;
    // Asked again once the stream is really running: the level or the switch may have changed while it was starting.
    if (!allowed() || source === "companion" && !companionMayStartRadio() || output.context.state !== "running") { stopCompanionRadio(); return false; }
    pendingTrackId = null;
    emit({ generation: snapshot.generation + 1, playing: true, trackId: track.id, mood: track.mood, bpm: track.bpm, startedAt: performance.now() });
    return true;
  } catch { if (token === request) stopCompanionRadio(); return false; }
}
/** The companion never replaces the user's playback, pending or playing. */
const refused = (source: RadioSource) => !admit(source) || source === "companion" && owner === "human";
function advance(source: RadioSource): Promise<boolean> {
  const pool = companionRadioPool();
  const choices = pool.length > 1 ? pool.filter(track => track.id !== snapshot.trackId) : pool;
  if (!choices.length) { stopCompanionRadio(); return Promise.resolve(false); }
  return play(choices[Math.floor(Math.random() * choices.length)], source);
}
export function playCompanionRadioTrack(id: string, source: RadioSource = "human"): Promise<boolean> {
  if (refused(source)) return Promise.resolve(false);
  const track = companionRadioPool().find(item => item.id === id);
  return track ? play(track, source) : Promise.resolve(false);
}
export function nextCompanionRadio(source: RadioSource = "human"): Promise<boolean> {
  if (refused(source)) return Promise.resolve(false);
  return advance(source);
}
export function toggleCompanionRadio(source: RadioSource = "human"): Promise<boolean> {
  if (refused(source)) return Promise.resolve(false);
  if (getCompanionRadioToggleIntent() === "stop") { stopCompanionRadio(); return Promise.resolve(false); }
  return nextCompanionRadio(source);
}

/** Actual companion contact may use the existing audio owner. It never
 * overrides mute, a human lease, browser autoplay or a canceled scene. */
export async function setCompanionRadioPlaying(playing: boolean, signal?: AbortSignal): Promise<boolean> {
  // The user's own playback is refused in both directions: it is not switched off, and "on" does not make it the companion's.
  if (!canCompanionSetRadio() || signal?.aborted || playing && !companionMayStartRadio()) return false;
  if (!playing) { stopCompanionRadio(); return true; }
  if (snapshot.playing) return true;
  const pending = nextCompanionRadio("companion"), token = request;
  const abort = () => { if (token === request) stopCompanionRadio(); };
  signal?.addEventListener("abort", abort, { once: true });
  try { return await pending && !signal?.aborted; }
  finally { signal?.removeEventListener("abort", abort); }
}
