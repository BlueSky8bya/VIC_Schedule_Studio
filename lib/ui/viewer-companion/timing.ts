import type { CompanionPlay } from "./brain";

/** Semantic beats share one monotonic renderer clock. These are milliseconds,
 * not a reason to add timers, React state updates or another animation loop. */
export const COMPANION_TIMING = Object.freeze({
  jumpAnticipation: 120,
  jumpLanding: 180,
  sleepYawn: 700,
  sleepWake: 650,
  presenceRest: 700,
  presenceYawn: 700,
  presenceWake: 650,
  lookMin: 550,
  lookRange: 400,
  stretchMin: 850,
  stretchRange: 300,
  shakeMin: 450,
  shakeRange: 200,
  sniffCat: 650,
  sniffDog: 800,
  eat: 2200,
  heart: 1300,
  panelPress: 1100,
  petLoop: 800,
  petReward: 1100,
  reducedPlay: 650,
});

export type CompanionPlayBeat = "impact" | "dizzy" | "checking" | "recover" | "play";
type Beat = Readonly<{ row: number; duration: number; beat: CompanionPlayBeat; cycles?: number }>;
type PlayTiming = Readonly<{ duration: number; beats: readonly Beat[] }>;
const timing = (...beats: Beat[]): PlayTiming => Object.freeze({
  duration: beats.reduce((sum, beat) => sum + beat.duration, 0),
  beats: Object.freeze(beats.map(beat => Object.freeze(beat))),
});

/** Contact happens promptly; the expression is allowed to read afterward.
 * Authored clips with only two/three keys must not spend half a second merely
 * approaching their first reaction. Finite clips always advance forward. */
export const COMPANION_PLAY_TIMING: Readonly<Record<CompanionPlay, PlayTiming>> = Object.freeze({
  dizzy: timing({ row: 22, duration: 520, beat: "dizzy" }, { row: 23, duration: 800, beat: "recover" }),
  "bonk-tears": timing({ row: 25, duration: 100, beat: "impact" }, { row: 27, duration: 900, beat: "checking" }, { row: 23, duration: 280, beat: "recover" }),
  "bonk-sad": timing({ row: 25, duration: 110, beat: "impact" }, { row: 28, duration: 1030, beat: "checking" }, { row: 23, duration: 280, beat: "recover" }),
  tumble: timing({ row: 21, duration: 620, beat: "impact", cycles: 2 }, { row: 22, duration: 300, beat: "dizzy" }, { row: 26, duration: 440, beat: "checking" }, { row: 23, duration: 800, beat: "recover" }),
  "slip-tumble": timing({ row: 24, duration: 180, beat: "impact" }, { row: 21, duration: 620, beat: "impact", cycles: 2 }, { row: 22, duration: 300, beat: "dizzy" }, { row: 26, duration: 320, beat: "checking" }, { row: 23, duration: 800, beat: "recover" }),
  bump: timing({ row: 25, duration: 120, beat: "impact" }, { row: 22, duration: 180, beat: "dizzy" }, { row: 26, duration: 760, beat: "checking" }, { row: 23, duration: 360, beat: "recover" }),
  slip: timing({ row: 24, duration: 220, beat: "impact" }, { row: 27, duration: 560, beat: "checking" }, { row: 26, duration: 440, beat: "checking" }, { row: 23, duration: 320, beat: "recover" }),
  groom: timing({ row: 30, duration: 1560, beat: "play", cycles: 3 }, { row: 23, duration: 320, beat: "recover" }),
  bow: timing({ row: 29, duration: 1060, beat: "play" }, { row: 23, duration: 280, beat: "recover" }),
  pounce: timing({ row: 31, duration: 820, beat: "play" }, { row: 23, duration: 300, beat: "recover" }),
  celebrate: timing({ row: 31, duration: 1100, beat: "play", cycles: 2 }, { row: 23, duration: 280, beat: "recover" }),
});

export function companionPlayDuration(kind: CompanionPlay, reduced = false): number {
  return reduced ? COMPANION_TIMING.reducedPlay : COMPANION_PLAY_TIMING[kind].duration;
}

type ClipTiming = Readonly<{ row: number; name: string; playback: "loop" | "distance" | "phase" | "hold" | "unused"; duration: number | null; frameRate?: number }>;
/** All logical rows, including the intentionally unused legacy row7. Duration
 * is a semantic beat/cycle reference; ballistic travel and support geometry
 * remain renderer-owned. Native frame counts and atlas bytes are unchanged. */
export const COMPANION_THROW_ROW = 32;
export const COMPANION_CLIP_TIMING: readonly ClipTiming[] = Object.freeze([
  { row: 0, name: "idle", playback: "loop", duration: 2000, frameRate: 8 },
  { row: 1, name: "look", playback: "phase", duration: 750 },
  { row: 2, name: "walk", playback: "distance", duration: null, frameRate: 14 },
  { row: 3, name: "crouch", playback: "phase", duration: COMPANION_TIMING.jumpAnticipation },
  { row: 4, name: "rise", playback: "phase", duration: null },
  { row: 5, name: "fall", playback: "phase", duration: null },
  { row: 6, name: "land", playback: "phase", duration: COMPANION_TIMING.jumpLanding },
  { row: 7, name: "legacy-unused", playback: "unused", duration: null },
  { row: 8, name: "held", playback: "loop", duration: 1333, frameRate: 12 },
  { row: 9, name: "happy", playback: "loop", duration: 2000, frameRate: 8 },
  { row: 10, name: "yawn", playback: "hold", duration: COMPANION_TIMING.sleepYawn },
  { row: 11, name: "sleep", playback: "hold", duration: null, frameRate: 6 },
  { row: 12, name: "wake", playback: "phase", duration: COMPANION_TIMING.sleepWake },
  { row: 13, name: "heart", playback: "phase", duration: COMPANION_TIMING.heart },
  { row: 14, name: "hide", playback: "phase", duration: 700 },
  { row: 15, name: "emerge", playback: "hold", duration: 700 },
  { row: 16, name: "stretch", playback: "phase", duration: 1000 },
  { row: 17, name: "shake", playback: "phase", duration: 550 },
  { row: 18, name: "disappointed", playback: "phase", duration: 1400 },
  { row: 19, name: "sulky", playback: "phase", duration: 1600 },
  { row: 20, name: "sprint", playback: "distance", duration: null, frameRate: 14 },
  { row: 21, name: "tumble", playback: "phase", duration: 310 },
  { row: 22, name: "dizzy", playback: "phase", duration: 300 },
  { row: 23, name: "recover", playback: "phase", duration: 280 },
  { row: 24, name: "slip", playback: "phase", duration: 220 },
  { row: 25, name: "bump", playback: "phase", duration: 100 },
  { row: 26, name: "glance", playback: "phase", duration: 440 },
  { row: 27, name: "tears", playback: "phase", duration: 900 },
  { row: 28, name: "sulk", playback: "phase", duration: 1030 },
  { row: 29, name: "bow", playback: "phase", duration: 1060 },
  { row: 30, name: "groom", playback: "phase", duration: 520 },
  { row: 31, name: "pounce", playback: "phase", duration: 820 },
  { row: COMPANION_THROW_ROW, name: "throw", playback: "phase", duration: null },
].map(clip => Object.freeze(clip)) as ClipTiming[]);
