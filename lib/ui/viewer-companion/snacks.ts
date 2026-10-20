import { createBoundedWeightedCatalog } from "./bounded-weighted-catalog";
import { COMPANION_COLLECTION_RARITY_NAMES, type CompanionCollectionRarity } from "./collection-rarity";
import { COMPANION_SNACK_EXPANSION_143, type ExpandedCompanionFoodKind143 } from "./snack-expansion-143";
import { COMPANION_SNACK_EXPANSION, type ExpandedCompanionFoodKind } from "./snack-expansion";

/** Device-local visual snacks. No food choice is sent to a server or account. */
export const LEGACY_COMPANION_FOOD_KINDS = Object.freeze([
  "apple", "lemon", "strawberry", "raspberry", "watermelon", "tomato",
  "grapefruit", "peach", "plum", "orange", "persimmon", "apricot", "pear",
] as const);
export const COMPANION_FOOD_KINDS = Object.freeze([
  ...LEGACY_COMPANION_FOOD_KINDS,
  "banana", "grape", "cherry", "blueberry", "mango", "kiwi", "pineapple", "coconut", "fig", "dragon-fruit", "melon",
  "carrot", "cucumber", "broccoli", "pumpkin", "corn", "sweet-potato", "potato", "cabbage", "eggplant", "bell-pepper", "radish", "peas",
  "bread", "croissant", "baguette", "bagel", "pretzel", "sandwich", "toast", "pancake", "waffle", "doughnut", "muffin", "cupcake",
  "rice-ball", "rice-cake", "dumpling", "pizza", "pasta", "omelet", "soup", "curry", "sushi", "pudding", "cookie", "macaron",
  ...COMPANION_SNACK_EXPANSION.map(item => item.id),
  ...COMPANION_SNACK_EXPANSION_143.map(item => item.id),
] as const);
export type CompanionFoodKind = typeof COMPANION_FOOD_KINDS[number];
export type CompanionFoodRarity = CompanionCollectionRarity;
const expandedNames = Object.fromEntries(COMPANION_SNACK_EXPANSION.map(item => [item.id, item.name])) as Record<ExpandedCompanionFoodKind, string>;
const expandedRarities = Object.fromEntries(COMPANION_SNACK_EXPANSION.map(item => [item.id, item.rarity])) as Record<ExpandedCompanionFoodKind, CompanionFoodRarity>;
export const COMPANION_FOOD_NAMES: Readonly<Record<CompanionFoodKind, string>> = Object.freeze({
  apple: "사과", lemon: "레몬", strawberry: "딸기", raspberry: "라즈베리",
  watermelon: "수박", tomato: "토마토", grapefruit: "자몽", peach: "복숭아",
  plum: "자두", orange: "오렌지", persimmon: "감", apricot: "살구", pear: "배",
  banana: "바나나", grape: "포도", cherry: "체리", blueberry: "블루베리", mango: "망고", kiwi: "키위", pineapple: "파인애플", coconut: "코코넛", fig: "무화과", "dragon-fruit": "용과", melon: "멜론",
  carrot: "당근", cucumber: "오이", broccoli: "브로콜리", pumpkin: "단호박", corn: "옥수수", "sweet-potato": "고구마", potato: "감자", cabbage: "양배추", eggplant: "가지", "bell-pepper": "파프리카", radish: "무", peas: "완두콩",
  bread: "식빵", croissant: "크루아상", baguette: "바게트", bagel: "베이글", pretzel: "프레첼", sandwich: "샌드위치", toast: "토스트", pancake: "팬케이크", waffle: "와플", doughnut: "도넛", muffin: "머핀", cupcake: "컵케이크",
  "rice-ball": "삼각김밥", "rice-cake": "떡", dumpling: "만두", pizza: "피자", pasta: "파스타", omelet: "오믈렛", soup: "수프", curry: "카레", sushi: "초밥", pudding: "푸딩", cookie: "쿠키", macaron: "마카롱",
  ...expandedNames,
  ...Object.fromEntries(COMPANION_SNACK_EXPANSION_143.map(item => [item.id, item.name])) as Record<ExpandedCompanionFoodKind143, string>,
});
export const COMPANION_FOOD_RARITY_NAMES = COMPANION_COLLECTION_RARITY_NAMES;
export const COMPANION_FOOD_RARITY: Readonly<Record<CompanionFoodKind, CompanionFoodRarity>> = Object.freeze({
  apple: "common", lemon: "uncommon", strawberry: "common", raspberry: "uncommon", watermelon: "common", tomato: "common", grapefruit: "uncommon", peach: "common", plum: "uncommon", orange: "common", persimmon: "uncommon", apricot: "uncommon", pear: "common",
  banana: "common", grape: "common", cherry: "uncommon", blueberry: "rare", mango: "rare", kiwi: "uncommon", pineapple: "rare", coconut: "rare", fig: "rare", "dragon-fruit": "rare", melon: "common",
  carrot: "common", cucumber: "common", broccoli: "uncommon", pumpkin: "uncommon", corn: "common", "sweet-potato": "common", potato: "common", cabbage: "common", eggplant: "uncommon", "bell-pepper": "uncommon", radish: "common", peas: "common",
  bread: "common", croissant: "uncommon", baguette: "common", bagel: "common", pretzel: "uncommon", sandwich: "common", toast: "common", pancake: "common", waffle: "uncommon", doughnut: "common", muffin: "common", cupcake: "uncommon",
  "rice-ball": "common", "rice-cake": "common", dumpling: "common", pizza: "uncommon", pasta: "uncommon", omelet: "common", soup: "uncommon", curry: "rare", sushi: "rare", pudding: "rare", cookie: "uncommon", macaron: "rare",
  ...expandedRarities,
  ...Object.fromEntries(COMPANION_SNACK_EXPANSION_143.map(item => [item.id, item.rarity])) as Record<ExpandedCompanionFoodKind143, CompanionFoodRarity>,
});
const vegetables: readonly CompanionFoodKind[] = ["tomato", "carrot", "cucumber", "broccoli", "pumpkin", "corn", "sweet-potato", "potato", "cabbage", "eggplant", "bell-pepper", "radish", "peas"];
const expandedCategories = new Map<string, "fruit" | "vegetable" | "prepared">([...COMPANION_SNACK_EXPANSION, ...COMPANION_SNACK_EXPANSION_143].map(item => [item.id, item.category]));
export const COMPANION_FOOD_CATEGORY = Object.freeze(Object.fromEntries(COMPANION_FOOD_KINDS.map((kind, index) => [kind, expandedCategories.get(kind) ?? (index >= 36 ? "prepared" : vegetables.includes(kind) ? "vegetable" : "fruit")]))) as Readonly<Record<CompanionFoodKind, "fruit" | "vegetable" | "prepared">>;
/** Integer masses: tier totals75%,23%,1.93%,.065%,.005% across240 items.
 * There is no pity counter or rarity gate on any care/scene function. */
export const COMPANION_FOOD_WEIGHTS = Object.freeze(Object.fromEntries(COMPANION_FOOD_KINDS.map(kind => [kind, { common: 825000, uncommon: 253000, rare: 46320, "ultra-rare": 22880, mythic: 5280 }[COMPANION_FOOD_RARITY[kind]]])) as Record<CompanionFoodKind, number>);
const kinds = new Set<string>(COMPANION_FOOD_KINDS);
const foodDraw = createBoundedWeightedCatalog(COMPANION_FOOD_KINDS.map(id => ({ id, mass: COMPANION_FOOD_WEIGHTS[id] })));
/** Base probability without a previous item; a previous exclusion renormalizes it. */
export function companionFoodChance(kind: CompanionFoodKind, previous?: CompanionFoodKind): number {
  return foodDraw.chance(kind, previous);
}
export function isCompanionFoodKind(value: unknown): value is CompanionFoodKind {
  return typeof value === "string" && kinds.has(value);
}
/** Exactly one bounded weighted sample per accepted request, without a retry. */
export function randomCompanionFood(previous?: CompanionFoodKind, rng: () => number = Math.random): CompanionFoodKind {
  return foodDraw.draw(previous, rng);
}
