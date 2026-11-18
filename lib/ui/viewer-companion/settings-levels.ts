/** Simplified companion settings, computed from the existing stored fields.
 *
 * The redesign (docs/ux/companion-settings-redesign-proposal.md, 5-1 and
 * appendix C) shows fewer controls without adding a stored value: an older
 * screen that saves once would drop any field it does not know. So each new
 * control is *read* from existing fields and *written* as a patch of existing
 * fields only. Mixed legacy combinations read as the quieter / calmer level.
 *
 * Pure functions only. Nothing here is wired to a screen or to behavior yet.
 */
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "./preferences";

export const COMPANION_SOUND_LEVELS = ["off", "touch", "all"] as const;
export type CompanionSoundLevel = typeof COMPANION_SOUND_LEVELS[number];
export const COMPANION_MOTION_LEVELS = ["still", "walk", "run"] as const;
export type CompanionMotionLevel = typeof COMPANION_MOTION_LEVELS[number];

type SoundFields = Pick<CompanionPreferences, "sound" | "soundVolume" | "soundCare" | "soundMotion" | "soundKeepsakes">;
type MotionFields = Pick<CompanionPreferences, "roam" | "jump">;
type PlayfulFields = Pick<CompanionPreferences, "heartPrank" | "cardPrank" | "ambientPrank" | "rarePrank">;

/** Off: master off, volume 0 or care sounds off. All: master and all three
 * groups on. Anything else: only sounds I cause by touching. */
export function companionSoundLevel(preferences: Readonly<SoundFields>): CompanionSoundLevel {
  if (!preferences.sound || preferences.soundVolume <= 0 || !preferences.soundCare) return "off";
  return preferences.soundMotion && preferences.soundKeepsakes ? "all" : "touch";
}

/** Off writes only the master, so the previous mix returns with an older
 * screen. Choosing an audible level at volume 0 restores the default volume;
 * otherwise the choice would read back as off. */
export function companionSoundLevelPatch(level: CompanionSoundLevel, preferences: Readonly<Pick<CompanionPreferences, "soundVolume">>): Partial<SoundFields> {
  if (level === "off") return { sound: false };
  const patch: Partial<SoundFields> = { sound: true, soundCare: true, soundMotion: level === "all", soundKeepsakes: true };
  if (preferences.soundVolume <= 0) patch.soundVolume = DEFAULT_COMPANION_PREFERENCES.soundVolume;
  return patch;
}

export function companionMotionLevel(preferences: Readonly<MotionFields>): CompanionMotionLevel {
  if (!preferences.roam) return "still";
  return preferences.jump ? "run" : "walk";
}

/** Still writes only `roam`, keeping the earlier jump choice for an older screen. */
export function companionMotionLevelPatch(level: CompanionMotionLevel): Partial<MotionFields> {
  if (level === "still") return { roam: false };
  return { roam: true, jump: level === "run" };
}

/** One switch for the four pranks. The panel-seat prank stays its own row. */
export function companionPlayful(preferences: Readonly<PlayfulFields>): boolean {
  return preferences.heartPrank && preferences.cardPrank && preferences.ambientPrank && preferences.rarePrank;
}

export function companionPlayfulPatch(on: boolean): PlayfulFields {
  return { heartPrank: on, cardPrank: on, ambientPrank: on, rarePrank: on };
}
