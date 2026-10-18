/** Device-local witnessed situations. No calendar/item/identity payload. */
export const COMPANION_SITUATION_IDS = Object.freeze(["hide-found", "heart-blocked", "run-tumble", "food-trip", "landing-mishap", "card-bump", "meal-finished", "home-rested", "petting-comfort", "gift-arrival", "gift-opened", "accessory-trick"] as const);
export type CompanionSituationId = typeof COMPANION_SITUATION_IDS[number];
export const COMPANION_SITUATION_NAMES: Readonly<Record<CompanionSituationId, string>> = Object.freeze({ "hide-found": "찾았다!", "heart-blocked": "하트에 콩!", "run-tumble": "달리다 데굴", "food-trip": "간식에 우당탕", "landing-mishap": "착지 삐끗", "card-bump": "일정에 콩", "meal-finished": "싹싹 냠냠", "home-rested": "집에서 꿀잠", "petting-comfort": "쓰담쓰담", "gift-arrival": "깜짝 선물", "gift-opened": "두근두근 개봉", "accessory-trick": "멋쟁이 빅타민" });
export const COMPANION_SITUATION_HINTS: Readonly<Record<CompanionSituationId, string>> = Object.freeze({ "hide-found": "숨은 일정 열어 보기", "heart-blocked": "하트 장난 지켜보기", "run-tumble": "신나게 달리는 모습 보기", "food-trip": "간식 앞 장난 지켜보기", "landing-mishap": "폴짝 내려오는 모습 보기", "card-bump": "일정 위 장난 지켜보기", "meal-finished": "간식을 끝까지 먹게 하기", "home-rested": "집에서 푹 쉬게 하기", "petting-comfort": "천천히 쓰다듬기", "gift-arrival": "다정하게 함께 지내기", "gift-opened": "가져온 선물 열기", "accessory-trick": "장신구를 쓰고 함께 있기" });
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
