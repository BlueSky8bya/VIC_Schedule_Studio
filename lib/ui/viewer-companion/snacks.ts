/** Device-local visual snacks. No food choice is sent to a server or account. */
export const COMPANION_FOOD_KINDS = Object.freeze([
  "apple", "lemon", "strawberry", "raspberry", "watermelon", "tomato",
  "grapefruit", "peach", "plum", "orange", "persimmon", "apricot", "pear",
] as const);
export type CompanionFoodKind = typeof COMPANION_FOOD_KINDS[number];
export const COMPANION_FOOD_NAMES: Readonly<Record<CompanionFoodKind, string>> = Object.freeze({
  apple: "사과", lemon: "레몬", strawberry: "딸기", raspberry: "라즈베리",
  watermelon: "수박", tomato: "토마토", grapefruit: "자몽", peach: "복숭아",
  plum: "자두", orange: "오렌지", persimmon: "감", apricot: "살구", pear: "배",
});
export function isCompanionFoodKind(value: unknown): value is CompanionFoodKind {
  return typeof value === "string" && COMPANION_FOOD_KINDS.some(kind => kind === value);
}
/** A bounded deterministic draw; the immediately previous fruit is excluded. */
export function randomCompanionFood(previous?: CompanionFoodKind, rng: () => number = Math.random): CompanionFoodKind {
  const candidates = COMPANION_FOOD_KINDS.filter(kind => kind !== previous);
  const sample = rng();
  const fraction = Number.isFinite(sample) ? Math.max(0, Math.min(.999999999, sample)) : 0;
  return candidates[Math.floor(fraction * candidates.length)];
}
