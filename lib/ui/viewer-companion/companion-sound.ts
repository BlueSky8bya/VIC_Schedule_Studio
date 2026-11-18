import { playCompanionVoice, playCompanionSample, type CompanionSoundNote } from "@/lib/ui/sfx";
import { getCompanionPreferences, type CompanionPreferences } from "./preferences";
import { companionSoundLevel, type CompanionSoundLevel } from "./settings-levels";

export const COMPANION_SOUND_MOMENTS = ["feed", "land", "eat", "pet", "lift", "dizzy", "tumble", "sleep", "play", "discover", "gift", "equip", "unequip", "cushion"] as const;
export type CompanionSoundMoment = typeof COMPANION_SOUND_MOMENTS[number];
/** Who started the sound: "direct" = the reaction to something the user just
 * pressed, held, dropped or opened; "auto" = the companion on its own. A caller
 * that cannot tell says "auto" (the quieter side).
 *
 * The user's one choice is the level (settings redesign 2-나): off = nothing,
 * touch = only "direct" sounds, all = "auto" sounds too. Reduced motion and a
 * resting background effect quiet "auto" sounds only; what the user touches
 * still answers. The old care/motion/keepsakes groups no longer gate anything:
 * they are only how the level is stored (see settings-levels.ts). */
export type CompanionSoundOrigin = "direct" | "auto";
type Cue = Readonly<{ cooldown: number; notes: readonly CompanionSoundNote[] }>;
const cues: Readonly<Record<CompanionSoundMoment, Cue>> = {
  cushion: { cooldown: 450, notes: [{ f: 100, glideTo: 65, tau: .04, vol: .22 }, { f: 180, glideTo: 110, at: .025, tau: .035, vol: .09 }] },
  feed: { cooldown: 250, notes: [{ f: 240, glideTo: 330, tau: .025, vol: .22 }, { f: 390, at: .065, tau: .025, vol: .17 }] },
  land: { cooldown: 650, notes: [{ f: 150, glideTo: 100, tau: .018, vol: .15 }] },
  eat: { cooldown: 1300, notes: [{ f: 340, tau: .02, vol: .15 }, { f: 420, at: .07, tau: .02, vol: .13 }, { f: 510, at: .14, tau: .025, vol: .13 }] },
  pet: { cooldown: 1800, notes: [{ f: 330, tau: .045, vol: .18 }, { f: 440, at: .075, tau: .04, vol: .13 }] },
  lift: { cooldown: 600, notes: [{ f: 250, glideTo: 420, tau: .035, vol: .16 }] },
  dizzy: { cooldown: 1800, notes: [{ f: 390, glideTo: 260, tau: .03, vol: .16 }, { f: 320, glideTo: 210, at: .09, tau: .035, vol: .12 }] },
  tumble: { cooldown: 1600, notes: [{ f: 180, glideTo: 120, tau: .025, vol: .17 }, { f: 130, at: .08, tau: .035, vol: .13 }] },
  sleep: { cooldown: 8000, notes: [{ f: 260, glideTo: 195, tau: .05, vol: .12 }] },
  play: { cooldown: 2500, notes: [{ f: 440, tau: .025, vol: .16 }, { f: 660, at: .075, tau: .03, vol: .12 }] },
  discover: { cooldown: 1500, notes: [{ f: 590, tau: .025, vol: .16 }, { f: 880, at: .075, tau: .03, vol: .12 }] },
  gift: { cooldown: 1000, notes: [{ f: 392, tau: .03, vol: .17 }, { f: 494, at: .075, tau: .03, vol: .15 }, { f: 588, at: .15, tau: .04, vol: .13 }] },
  equip: { cooldown: 350, notes: [{ f: 550, tau: .018, vol: .17 }, { f: 825, tau: .016, vol: .08 }] },
  unequip: { cooldown: 350, notes: [{ f: 330, glideTo: 260, tau: .022, vol: .15 }] },
};

/** A bounded semantic-event budget; no tick, queue, timer or catch-up work. */
export function createCompanionSoundBudget() {
  const last = new Map<CompanionSoundMoment, number>();
  let recent: number[] = [];
  return {
    allows(moment: CompanionSoundMoment, now: number) {
      recent = recent.filter(at => now - at < 1200);
      return Number.isFinite(now) && now - (last.get(moment) ?? -Infinity) >= cues[moment].cooldown && now - (recent.at(-1) ?? -Infinity) >= 120 && recent.length < 3;
    },
    played(moment: CompanionSoundMoment, now: number) { last.set(moment, now); recent.push(now); },
  };
}
const budget = createCompanionSoundBudget();

function play(moment: CompanionSoundMoment, preferences: CompanionPreferences, origin: CompanionSoundOrigin): boolean {
  if (typeof document === "undefined" || document.hidden || !cues[moment] || !preferences.enabled) return false;
  const cue = cues[moment], level = companionSoundLevel(preferences);
  if (level === "off") return false;
  if (origin === "auto" && (level !== "all" || document.documentElement.hasAttribute("data-reduce-motion") || ["off", "soft"].includes(document.documentElement.dataset.gfx ?? ""))) return false;
  const now = performance.now();
  if (!budget.allows(moment, now)) return false;
  const sample = moment === "cushion" && playCompanionSample("/companion/audio/cushion.ogg", preferences.soundVolume);
  if (!sample && !playCompanionVoice(cue.notes, preferences.soundVolume)) return false;
  if (moment === "cushion" && !sample) playCompanionSample("/companion/audio/cushion.ogg", 0.001);
  budget.played(moment, now);
  document.documentElement.dataset.companionSfxLast = moment;
  const trace = (window as Window & { __companionSfxTrace?: CompanionSoundMoment[] }).__companionSfxTrace;
  if (Array.isArray(trace)) trace.push(moment);
  // Passive witness for tests, like the trace above: the mark that reached the gate.
  const origins = (window as Window & { __companionSfxOrigins?: string[] }).__companionSfxOrigins;
  if (Array.isArray(origins)) origins.push(`${moment}:${origin}`);
  return true;
}

/** Runtime callers pass their current preference ref and one actual event. */
export function playCompanionSound(moment: CompanionSoundMoment, preferences: CompanionPreferences = getCompanionPreferences(), origin: CompanionSoundOrigin = "auto"): boolean {
  return play(moment, preferences, origin);
}
/** What a level sounds like, once, when it is chosen or the volume is set: a
 * stroke for "touch", the companion playing by itself for "all". It passes the
 * same gate as the real sound, so off, the site's sound switch, a hidden tab
 * or a resting device are never bypassed. */
export function previewCompanionSoundLevel(level: CompanionSoundLevel, preferences: CompanionPreferences = getCompanionPreferences()): boolean {
  if (level === "off") return false;
  // On a device that rests its own sounds, "all" still sounds when touched: let that be heard instead of silence.
  return level === "all" && play("play", preferences, "auto") || play("pet", preferences, "direct");
}
/** Setting the volume is heard with a stroke, the sound every audible level
 * plays, so the slider answers on a resting device too. Off stays silent. */
export function previewCompanionSoundVolume(preferences: CompanionPreferences = getCompanionPreferences()): boolean {
  return play("pet", preferences, "direct");
}
