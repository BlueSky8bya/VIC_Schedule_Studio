import { COMPANION_MEMORY_ENCOUNTER_HINTS as hints } from "./memory-encounter-hints";
/** Device-local witnessed situations. No calendar/item/identity payload. */
export const COMPANION_SITUATION_IDS = Object.freeze(["hide-found", "heart-blocked", "run-tumble", "food-trip", "landing-mishap", "card-bump", "meal-finished", "home-rested", "petting-comfort", "gift-arrival", "gift-opened", "accessory-trick"] as const);
export type CompanionSituationId = typeof COMPANION_SITUATION_IDS[number];
export const COMPANION_SITUATION_NAMES: Readonly<Record<CompanionSituationId, string>> = Object.freeze({ "hide-found": "찾았다!", "heart-blocked": "하트에 콩!", "run-tumble": "달리다 데굴", "food-trip": "간식에 우당탕", "landing-mishap": "착지 삐끗", "card-bump": "일정에 콩", "meal-finished": "싹싹 냠냠", "home-rested": "집에서 꿀잠", "petting-comfort": "쓰담쓰담", "gift-arrival": "깜짝 선물", "gift-opened": "두근두근 개봉", "accessory-trick": "멋쟁이 빅타민" });
export const COMPANION_SITUATION_HINTS: Readonly<Record<CompanionSituationId, string>> = Object.freeze({ "hide-found": hints["hide-found"], "heart-blocked": hints["heart-blocked"], "run-tumble": hints["run-tumble"], "food-trip": hints["food-trip"], "landing-mishap": hints["landing-mishap"], "card-bump": hints["card-bump"], "meal-finished": hints["meal-finished"], "home-rested": hints["home-rested"], "petting-comfort": hints["petting-comfort"], "gift-arrival": hints["gift-arrival"], "gift-opened": hints["gift-opened"], "accessory-trick": hints["accessory-trick"] });
export type CompanionSituationObservation = { id: CompanionSituationId; occurred: boolean; visible: boolean; decoded: boolean; requestedIndex: number; adoptedIndex?: number; requestedSrc: string; adoptedSrc?: string };
export const isCompanionSituationId = (value: unknown): value is CompanionSituationId => typeof value === "string" && COMPANION_SITUATION_IDS.some(id => value === id);
/** Keep the actual contact cause: a disappeared snack cannot turn into a
 * generic running accident, and ordinary walking is not a running stamp. */
export function companionRunContactSituation(input: { cause: "food" | "stumble"; running: boolean; foodPresent: boolean }): "food-trip" | "run-tumble" | undefined {
  return input.cause === "food" ? input.foodPresent ? "food-trip" : undefined : input.cause === "stumble" && input.running ? "run-tumble" : undefined;
}
/** A context token alone cannot stamp a requested or unavailable drawing. */
export function observedCompanionSituation(value: CompanionSituationObservation): CompanionSituationId | undefined {
  return value.occurred && value.visible && value.decoded && isCompanionSituationId(value.id) && Number.isInteger(value.requestedIndex) && value.requestedIndex >= 0 && value.adoptedIndex === value.requestedIndex && Boolean(value.requestedSrc) && value.requestedSrc === value.adoptedSrc ? value.id : undefined;
}
