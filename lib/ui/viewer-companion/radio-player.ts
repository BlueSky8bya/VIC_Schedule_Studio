import { connectCompanionMedia, soundEnabled, soundVolume } from "@/lib/ui/sfx";
import { POSTER_AGENDA_QUERY } from "@/lib/ui/breakpoints";
import { getCompanionPreferences, subscribeCompanionPreferences } from "./preferences";
import { COMPANION_RADIO_TRACKS, type CompanionRadioMood, type CompanionRadioTrack } from "./radio-catalog";
import { companionRadioPool, getCompanionRadioPreferences, subscribeCompanionRadioPreferences } from "./radio-preferences";

export type CompanionRadioSnapshot = Readonly<{ generation: number; playing: boolean; trackId: string | null; mood: CompanionRadioMood | null; bpm: number; startedAt: number }>;
let snapshot: CompanionRadioSnapshot = { generation: 0, playing: false, trackId: null, mood: null, bpm: 0, startedAt: 0 };
const listeners = new Set<() => void>();
let media: HTMLAudioElement | null = null;
let output: ReturnType<typeof connectCompanionMedia> = null;
let request = 0;
let teardown: (() => void) | null = null;
let pendingTrackId: string | null = null;
export const getCompanionRadioSnapshot = () => snapshot;
/** The next real toggle also stops an in-flight play request. Activity uses
 * this same intent rather than mistaking a not-yet-playing request for play. */
export const getCompanionRadioToggleIntent = (): "play" | "stop" => snapshot.playing || pendingTrackId !== null ? "stop" : "play";
export function subscribeCompanionRadio(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
function emit(next: CompanionRadioSnapshot) { snapshot = next; for (const listener of listeners) listener(); }
function allowed() {
  if (typeof document === "undefined" || document.hidden || matchMedia(POSTER_AGENDA_QUERY).matches || document.documentElement.hasAttribute("data-showcase") || document.querySelector("[data-companion-premiere-owner]")) return false;
  const companion = getCompanionPreferences(), radio = getCompanionRadioPreferences();
  return companion.enabled && companion.sound && companion.soundVolume > 0 && radio.enabled && radio.volume > 0 && soundEnabled() && soundVolume() > 0;
}
function mix() {
  if (!output) return;
  const companion = getCompanionPreferences(), radio = getCompanionRadioPreferences();
  output.gain.gain.setTargetAtTime(Math.pow(soundVolume() / 100, 1.6) * Math.pow(companion.soundVolume / 100, 1.3) * radio.volume / 100 * .65, output.context.currentTime, .04);
}
/** Stop invalidates pending play/resume/decode before releasing listeners and
 * the stream. Nothing resumes automatically after focus, unmute or remount. */
export function stopCompanionRadio(): void {
  request++;
  pendingTrackId = null;
  teardown?.(); teardown = null;
  if (media) { media.pause(); media.removeAttribute("src"); media.load(); }
  if (output) { output.gain.gain.cancelScheduledValues(output.context.currentTime); output.gain.gain.value = 0; }
  if (snapshot.playing) emit({ ...snapshot, playing: false });
}
function monitor() {
  const changed = () => {
    const track = COMPANION_RADIO_TRACKS.find(item => item.id === (pendingTrackId ?? snapshot.trackId));
    if (!allowed() || track && !companionRadioPool().some(item => item.id === track.id)) stopCompanionRadio(); else mix();
  };
  const unradio = subscribeCompanionRadioPreferences(changed), unpet = subscribeCompanionPreferences(changed);
  const mutation = new MutationObserver(changed);
  mutation.observe(document.documentElement, { attributes: true, attributeFilter: ["data-showcase"] });
  for (const page of document.querySelectorAll(".poster-page,.studio-shell")) mutation.observe(page, { attributes: true, attributeFilter: ["data-companion-premiere-owner"] });
  window.addEventListener("vic:sound", changed); window.addEventListener("storage", changed);
  document.addEventListener("visibilitychange", changed); window.addEventListener("resize", changed); window.addEventListener("pagehide", stopCompanionRadio);
  const context = output?.context;
  const stateChanged = () => { if (context?.state !== "running") stopCompanionRadio(); };
  context?.addEventListener("statechange", stateChanged);
  teardown = () => { unradio(); unpet(); mutation.disconnect(); window.removeEventListener("vic:sound", changed); window.removeEventListener("storage", changed); document.removeEventListener("visibilitychange", changed); window.removeEventListener("resize", changed); window.removeEventListener("pagehide", stopCompanionRadio); context?.removeEventListener("statechange", stateChanged); };
}
async function play(track: CompanionRadioTrack): Promise<boolean> {
  if (!allowed()) { stopCompanionRadio(); return false; }
  stopCompanionRadio();
  const token = request;
  pendingTrackId = track.id;
  media ??= new Audio();
  media.preload = "none";
  output ??= connectCompanionMedia(media);
  if (!output) { stopCompanionRadio(); return false; }
  media.onended = () => { if (snapshot.playing && allowed()) void nextCompanionRadio(); };
  media.onerror = () => { if (token === request) stopCompanionRadio(); };
  monitor();
  try {
    await output.context.resume();
    if (token !== request) return false;
    if (!allowed()) { stopCompanionRadio(); return false; }
    media.src = track.src; mix();
    await media.play();
    if (token !== request) return false;
    if (!allowed()) { stopCompanionRadio(); return false; }
    pendingTrackId = null;
    emit({ generation: snapshot.generation + 1, playing: true, trackId: track.id, mood: track.mood, bpm: track.bpm, startedAt: performance.now() });
    return true;
  } catch { if (token === request) stopCompanionRadio(); return false; }
}
export function playCompanionRadioTrack(id: string): Promise<boolean> {
  const track = companionRadioPool().find(item => item.id === id);
  return track ? play(track) : Promise.resolve(false);
}
export function nextCompanionRadio(): Promise<boolean> {
  const pool = companionRadioPool();
  const choices = pool.length > 1 ? pool.filter(track => track.id !== snapshot.trackId) : pool;
  if (!choices.length) { stopCompanionRadio(); return Promise.resolve(false); }
  return play(choices[Math.floor(Math.random() * choices.length)]);
}
export function toggleCompanionRadio(): Promise<boolean> {
  if (getCompanionRadioToggleIntent() === "stop") { stopCompanionRadio(); return Promise.resolve(false); }
  return nextCompanionRadio();
}
