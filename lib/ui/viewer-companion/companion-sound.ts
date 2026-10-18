import { playCompanionVoice, playCompanionSample, type CompanionSoundNote } from "@/lib/ui/sfx";
import { getCompanionPreferences, type CompanionPreferences } from "./preferences";

export const COMPANION_SOUND_MOMENTS = ["feed", "land", "eat", "pet", "lift", "dizzy", "tumble", "sleep", "play", "discover", "gift", "equip", "unequip", "cushion"] as const;
export type CompanionSoundMoment = typeof COMPANION_SOUND_MOMENTS[number];
export type CompanionSoundCategory = "care" | "motion" | "keepsakes";
export const COMPANION_SOUND_CATEGORY_NAMES = { care: "돌보기", motion: "움직임", keepsakes: "발견·선물" } as const;
type Cue = Readonly<{ category: CompanionSoundCategory; cooldown: number; notes: readonly CompanionSoundNote[] }>;
const cues: Readonly<Record<CompanionSoundMoment, Cue>> = {
  cushion: { category: "care", cooldown: 450, notes: [{ f: 100, glideTo: 65, tau: .04, vol: .22 }, { f: 180, glideTo: 110, at: .025, tau: .035, vol: .09 }] },
  feed: { category: "care", cooldown: 250, notes: [{ f: 240, glideTo: 330, tau: .025, vol: .22 }, { f: 390, at: .065, tau: .025, vol: .17 }] },
  land: { category: "care", cooldown: 650, notes: [{ f: 150, glideTo: 100, tau: .018, vol: .15 }] },
  eat: { category: "care", cooldown: 1300, notes: [{ f: 340, tau: .02, vol: .15 }, { f: 420, at: .07, tau: .02, vol: .13 }, { f: 510, at: .14, tau: .025, vol: .13 }] },
  pet: { category: "care", cooldown: 1800, notes: [{ f: 330, tau: .045, vol: .18 }, { f: 440, at: .075, tau: .04, vol: .13 }] },
  lift: { category: "motion", cooldown: 600, notes: [{ f: 250, glideTo: 420, tau: .035, vol: .16 }] },
  dizzy: { category: "motion", cooldown: 1800, notes: [{ f: 390, glideTo: 260, tau: .03, vol: .16 }, { f: 320, glideTo: 210, at: .09, tau: .035, vol: .12 }] },
  tumble: { category: "motion", cooldown: 1600, notes: [{ f: 180, glideTo: 120, tau: .025, vol: .17 }, { f: 130, at: .08, tau: .035, vol: .13 }] },
  sleep: { category: "motion", cooldown: 8000, notes: [{ f: 260, glideTo: 195, tau: .05, vol: .12 }] },
  play: { category: "motion", cooldown: 2500, notes: [{ f: 440, tau: .025, vol: .16 }, { f: 660, at: .075, tau: .03, vol: .12 }] },
  discover: { category: "keepsakes", cooldown: 1500, notes: [{ f: 590, tau: .025, vol: .16 }, { f: 880, at: .075, tau: .03, vol: .12 }] },
  gift: { category: "keepsakes", cooldown: 1000, notes: [{ f: 392, tau: .03, vol: .17 }, { f: 494, at: .075, tau: .03, vol: .15 }, { f: 588, at: .15, tau: .04, vol: .13 }] },
  equip: { category: "keepsakes", cooldown: 350, notes: [{ f: 550, tau: .018, vol: .17 }, { f: 825, tau: .016, vol: .08 }] },
  unequip: { category: "keepsakes", cooldown: 350, notes: [{ f: 330, glideTo: 260, tau: .022, vol: .15 }] },
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

function play(moment: CompanionSoundMoment, preferences: CompanionPreferences): boolean {
  if (typeof document === "undefined" || document.hidden || !cues[moment] || !preferences.sound || !preferences.enabled || preferences.soundVolume <= 0) return false;
  const cue = cues[moment], enabled = { care: preferences.soundCare, motion: preferences.soundMotion, keepsakes: preferences.soundKeepsakes }[cue.category];
  if (!enabled || cue.category === "motion" && (document.documentElement.hasAttribute("data-reduce-motion") || ["off", "soft"].includes(document.documentElement.dataset.gfx ?? ""))) return false;
  const now = performance.now();
  if (!budget.allows(moment, now)) return false;
  const sample = moment === "cushion" && playCompanionSample("/companion/audio/cushion.ogg", preferences.soundVolume);
  if (!sample && !playCompanionVoice(cue.notes, preferences.soundVolume)) return false;
  if (moment === "cushion" && !sample) playCompanionSample("/companion/audio/cushion.ogg", 0.001);
  budget.played(moment, now);
  document.documentElement.dataset.companionSfxLast = moment;
  const trace = (window as Window & { __companionSfxTrace?: CompanionSoundMoment[] }).__companionSfxTrace;
  if (Array.isArray(trace)) trace.push(moment);
  return true;
}

/** Runtime callers pass their current preference ref and one actual event. */
export function playCompanionSound(moment: CompanionSoundMoment, preferences: CompanionPreferences = getCompanionPreferences()): boolean {
  return play(moment, preferences);
}
/** Explicit audition uses the same creature, sound and browser gates. */
export function previewCompanionSound(category: CompanionSoundCategory, preferences: CompanionPreferences = getCompanionPreferences()): boolean {
  return play({ care: "pet", motion: "play", keepsakes: "discover" }[category] as CompanionSoundMoment, preferences);
}
