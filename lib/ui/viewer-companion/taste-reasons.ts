import { isCompanionFoodKind, type CompanionFoodKind } from "./snacks";
import type { CompanionLife } from "./life";

export const COMPANION_FOOD_TASTE_REASONS = ["sweet-bite", "fresh-bite", "cozy-bite", "durian-socks", "sharp-sour", "green-bitter", "strong-aroma", "spicy-tickle"] as const;
export type CompanionFoodTasteReason = typeof COMPANION_FOOD_TASTE_REASONS[number];
export type CompanionFoodTasteOutcome = { food: CompanionFoodKind; reaction: "delighted" | "liked" | "disliked"; reason: CompanionFoodTasteReason };
export type CompanionTasteReason = CompanionFoodTasteReason | "toy-fun" | "toy-trip";
export const COMPANION_TASTE_REASON_TEXT: Readonly<Record<CompanionTasteReason, string>> = {
  "sweet-bite": "달콤해서 기분 좋아요", "fresh-bite": "산뜻한 맛이 좋아요", "cozy-bite": "먹으니 마음이 포근해요",
  "durian-socks": "주인 양말 냄새남", "sharp-sour": "너무 셔서 눈이 찡해요", "green-bitter": "쌉쌀한 맛에 깜짝",
  "strong-aroma": "향이 코끝에 오래 남아요", "spicy-tickle": "혀가 따끔따끔해요",
  "toy-fun": "함께 노니 신나요", "toy-trip": "놀다가 걸려 넘어졌어요",
};
const sour: readonly CompanionFoodKind[] = ["lemon", "grapefruit", "yuzu", "kumquat", "kiwi", "pineapple"];
const green: readonly CompanionFoodKind[] = ["broccoli", "bell-pepper", "eggplant", "cabbage"];
const sweet: readonly CompanionFoodKind[] = ["strawberry", "mango", "peach", "banana", "pudding", "cookie", "macaron", "doughnut", "cupcake"];
function sensory(food: CompanionFoodKind): { negative?: CompanionFoodTasteReason; positive: CompanionFoodTasteReason; chance: number } {
  if (food === "durian") return { negative: "durian-socks", positive: "sweet-bite", chance: .48 };
  if (sour.includes(food)) return { negative: "sharp-sour", positive: "fresh-bite", chance: .24 };
  if (green.includes(food)) return { negative: "green-bitter", positive: "fresh-bite", chance: .22 };
  if (food === "curry") return { negative: "spicy-tickle", positive: "cozy-bite", chance: .22 };
  if (food === "coconut") return { negative: "strong-aroma", positive: "sweet-bite", chance: .2 };
  // An ordinary meal does not acquire an invented aversion to an unfamiliar
  // texture. Only the explicit polarizing flavours above permit adversity.
  return { positive: sweet.includes(food) ? "sweet-bite" : "cozy-bite", chance: 0 };
}

/** One impression after a successful real meal. The caller supplies one draw;
 * reading a profile, refusing food or feeling full never evaluates a taste. */
export function evaluateCompanionFoodTaste(food: CompanionFoodKind, life: Pick<CompanionLife, "seedFood" | "foodScores"> | undefined, roll: number): CompanionFoodTasteOutcome {
  const profile = sensory(food), value = Number.isFinite(roll) ? Math.max(0, Math.min(1, roll)) : .5;
  let seed = 0; for (const char of `${life?.seedFood ?? "apple"}:${food}`) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  const stored = life?.foodScores[food], learned = typeof stored === "number" && Number.isFinite(stored) ? Math.max(0, Math.min(1, stored)) : .5;
  const chance = profile.negative ? Math.max(.06, Math.min(.6, profile.chance + (seed % 17 - 8) / 200 - (learned - .5) * .12)) : 0;
  return profile.negative && value < chance ? { food, reaction: "disliked", reason: profile.negative }
    : { food, reaction: value >= Math.max(.64, chance + .3) ? "delighted" : "liked", reason: profile.positive };
}

export function isCompanionFoodTasteOutcome(value: unknown): value is CompanionFoodTasteOutcome {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (!isCompanionFoodKind(item.food)) return false;
  const profile = sensory(item.food);
  return item.reaction === "disliked" ? Boolean(profile.negative && item.reason === profile.negative)
    : ["delighted", "liked"].includes(item.reaction as string) && item.reason === profile.positive;
}
