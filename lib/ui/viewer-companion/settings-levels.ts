/** Simplified companion settings, computed from the existing stored fields.
 *
 * The redesign (docs/ux/companion-settings-redesign-proposal.md, 5-1 and
 * appendix C) shows fewer controls without adding a stored value: an older
 * screen that saves once would drop any field it does not know. So each new
 * control is *read* from existing fields and *written* as a patch of existing
 * fields only. Mixed legacy combinations read as the quieter / calmer level.
 *
 * Pure functions only. The sound level has been live since stage 2-나 and the
 * single prank switch since stage 4. Movement is no longer a setting
 * (2026-11-19 owner): the companion always walks and jumps freely, and the
 * stored `roam` / `jump` fields are kept only so older screens still load.
 */
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "./preferences";

export const COMPANION_SOUND_LEVELS = ["off", "touch", "all"] as const;
export type CompanionSoundLevel = typeof COMPANION_SOUND_LEVELS[number];

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

/** One switch for the four pranks. Moving the panel is one more prank with its
 * own row under it: it only happens while this switch is on. */
export function companionPlayful(preferences: Readonly<PlayfulFields>): boolean {
  return preferences.heartPrank && preferences.cardPrank && preferences.ambientPrank && preferences.rarePrank;
}

export function companionPlayfulPatch(on: boolean): PlayfulFields {
  return { heartPrank: on, cardPrank: on, ambientPrank: on, rarePrank: on };
}

/** Screen checks keep the companion standing still with a stored `roam: false`.
 * No setting writes this key; only the visual test config seeds it. */
export function companionQaStoredMotion(): boolean {
  try { return typeof window !== "undefined" && window.localStorage.getItem("vic.qa.companionStoredMotion") === "1"; } catch { return false; }
}

/** The choices the companion acts on. It always roams and jumps: a `roam` or
 * `jump` left off by an older screen is ignored, since no control could turn
 * it back on (`storedMotion` is the screen-check exception above). A
 * partly-off prank mix is off as a whole, and the panel prank follows the
 * prank switch. Stored values are not touched; an unchanged mix is returned
 * as the same object. */
export function companionBehaviorPreferences<T extends MotionFields & PlayfulFields & Pick<CompanionPreferences, "panelPrank">>(preferences: T, storedMotion = false): T {
  const roam = storedMotion ? preferences.roam : true, jump = storedMotion ? roam && preferences.jump : true;
  const playful = companionPlayful(preferences), panelPrank = playful && preferences.panelPrank;
  if (roam === preferences.roam && jump === preferences.jump && panelPrank === preferences.panelPrank && preferences.heartPrank === playful && preferences.cardPrank === playful && preferences.ambientPrank === playful && preferences.rarePrank === playful) return preferences;
  return { ...preferences, roam, jump, panelPrank, ...companionPlayfulPatch(playful) };
}
