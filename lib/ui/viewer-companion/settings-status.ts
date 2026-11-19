/** Why a companion setting is not taking effect right now, in the user's words.
 *
 * Redesign stage 1 (docs/ux/companion-settings-redesign-proposal.md 3-4, 4-5):
 * the structure and every rule stay as they are; the screen only says which
 * outer setting is in the way and where it lives. Each function returns the
 * single outermost reason. Wording follows the rules that are true *today*:
 * the sound level (off / touch / all) decides the companion's sounds, the
 * radio plays for the user whatever that level is, and the companion starts
 * it by itself only at "all" with "빅타민이 스스로 틀기" on.
 *
 * Pure functions. They never change a setting.
 */
import type { CompanionPreferences } from "./preferences";
import { companionMotionLevel, companionPlayful, companionSoundLevel } from "./settings-levels";
import type { CompanionRadioPreferences } from "./radio-preferences";

/** Site-wide settings that override companion rows, as the runtime reads them. */
export type CompanionSiteGates = Readonly<{ soundOn: boolean; soundVolume: number; reduceMotion: boolean; gfx: string | undefined }>;
/** Where the setting that is in the way lives. */
export const COMPANION_SETTINGS_PLACES = ["site-sound", "site-motion", "site-gfx", "companion-power", "companion-roam", "companion-sound", "companion-radio"] as const;
export type CompanionSettingsPlace = typeof COMPANION_SETTINGS_PLACES[number];
export const COMPANION_SETTINGS_PLACE_LABELS: Readonly<Record<CompanionSettingsPlace, string>> = Object.freeze({
  "site-sound": "소리 설정으로", "site-motion": "움직임 설정으로", "site-gfx": "배경 설정으로",
  "companion-power": "빅타민 켜는 곳으로", "companion-roam": "움직임으로", "companion-sound": "빅타민 소리로", "companion-radio": "집 라디오로",
});
/** `partial`: the row still does most of what it says; the note is shown without dimming it. */
export type CompanionSettingsNote = Readonly<{ text: string; place?: CompanionSettingsPlace; partial?: true }>;
export type CompanionSoundStatus = CompanionSettingsNote & Readonly<{ state: "on" | "partial" | "off" }>;

const gfxResting = (gfx: string | undefined) => gfx === "off" || gfx === "soft";
const gfxWords = (gfx: string | undefined) => gfx === "off" ? "배경 효과가 꺼져 있어" : "이 기기는 배경 효과가 '효과 쉬기'로 맞춰져 있어";
const reduceWords = "사이트의 '생동감 있는 동작'이 꺼져 있어";
const resting: CompanionSettingsNote = { text: "빅타민이 쉬는 중이라 아래 설정은 켜면 적용돼요", place: "companion-power" };

/** One line above the companion sound rows (proposal 4-5). */
export function companionSoundStatus(preferences: Readonly<CompanionPreferences>, site: CompanionSiteGates): CompanionSoundStatus {
  const silent = (reason: string, place?: CompanionSettingsPlace): CompanionSoundStatus => ({ state: "off", text: `지금은 소리가 안 나요 — ${reason}`, place });
  if (!site.soundOn) return silent("사이트 효과음이 꺼져 있어요", "site-sound");
  if (site.soundVolume <= 0) return silent("사이트 음량이 0이에요", "site-sound");
  if (!preferences.enabled) return silent("빅타민이 쉬는 중이에요", "companion-power");
  const level = companionSoundLevel(preferences);
  // Volume 0 reads as off; say which of the two rows to look at.
  if (level === "off") return { state: "off", text: preferences.sound && preferences.soundCare && preferences.soundVolume <= 0 ? "빅타민 음량이 0이에요" : "빅타민 소리를 꺼 두셨어요" };
  if (level === "touch") return { state: "partial", text: "내가 만질 때만 소리가 나요" };
  if (site.reduceMotion) return { state: "partial", text: `지금은 내가 만질 때만 소리가 나요 — ${reduceWords}요`, place: "site-motion" };
  if (gfxResting(site.gfx)) return { state: "partial", text: `지금은 내가 만질 때만 소리가 나요 — ${gfxWords(site.gfx)}요`, place: "site-gfx" };
  return { state: "on", text: "지금 소리가 나요" };
}

/** Rows an outer setting can stop (stage 4: movement is one level, the four pranks one switch). */
export type CompanionBlockedRow = "motion" | "playful" | "panelPrank" | "radioSelfStart";

/** The outer setting that keeps this row from doing anything, if any. The
 * row's own value is not considered: a blocked row keeps its value and stays
 * operable, so the note explains why switching it changes nothing yet. */
export function companionRowBlock(row: CompanionBlockedRow, preferences: Readonly<CompanionPreferences>, site: CompanionSiteGates): CompanionSettingsNote | null {
  if (!preferences.enabled) return resting;
  const what = row === "radioSelfStart" ? "스스로 라디오를 틀지 않아요" : row === "motion" ? "걷거나 뛰지 않아요" : row === "panelPrank" ? "패널을 옮기지 않아요" : "장난을 치지 않아요";
  if (site.reduceMotion) return { text: `${reduceWords} ${what}`, place: "site-motion" };
  if (row === "radioSelfStart" && gfxResting(site.gfx)) return { text: `${gfxWords(site.gfx)} ${what}`, place: "site-gfx" };
  // With the background effect fully off the panel never moves (the "soft" level keeps it).
  if (row === "panelPrank" && site.gfx === "off") return { text: `${gfxWords(site.gfx)} ${what}`, place: "site-gfx" };
  // Standing still it plays no prank and starts no radio. Called to the cushion it still comes home.
  if (row !== "motion" && companionMotionLevel(preferences) === "still") return { text: `움직임이 '가만히'라 ${what}`, place: "companion-roam" };
  // The background effect rests only part of the pranks: the row keeps working, so it is not dimmed.
  // Said only while the pranks are on; with the switch off there is nothing left to rest.
  if (row === "playful" && companionPlayful(preferences) && gfxResting(site.gfx)) return { text: `${gfxWords(site.gfx)} ${site.gfx === "off" ? "소품 묘기와 일정 기울이기를 쉬어요" : "소품 묘기를 쉬어요"}`, place: "site-gfx", partial: true };
  // Starting the radio by itself is one of its own sounds: only at the "all" level.
  if (row === "radioSelfStart" && companionSoundLevel(preferences) !== "all") return { text: `빅타민 소리가 '${companionSoundLevel(preferences) === "off" ? "끔" : "만질 때만"}'이라 ${what}`, place: "companion-sound" };
  return null;
}

/** Why pressing play on the home radio does nothing, outermost first. The
 * companion's own sound level is not a reason any more (stage 2-라). */
export function companionRadioBlock(preferences: Readonly<CompanionPreferences>, radio: Readonly<CompanionRadioPreferences>, site: Pick<CompanionSiteGates, "soundOn" | "soundVolume">): CompanionSettingsNote | null {
  if (!site.soundOn) return { text: "전체 소리가 꺼져 있어요", place: "site-sound" };
  if (site.soundVolume <= 0) return { text: "전체 음량이 0이에요", place: "site-sound" };
  if (!preferences.enabled) return { text: "빅타민이 꺼져 있어요", place: "companion-power" };
  if (!radio.enabled) return { text: "라디오가 꺼져 있어요" };
  if (radio.volume <= 0) return { text: "라디오 음량이 0이에요" };
  return null;
}
