import { COMPANION_FOOD_CATEGORY, COMPANION_FOOD_KINDS, isCompanionFoodKind, type CompanionFoodKind } from "./snacks";

/** Culinary resemblance for this pet's learning, not a nutrition or botanical
 * classification. Prepared meals do not all become familiar after one bun. */
export type CompanionFoodFamily = "fruit" | "vegetable" | "bread" | "rice" | "noodle" | "meal" | "dessert";
export const COMPANION_FOOD_FAMILIES: Readonly<Record<CompanionFoodFamily, readonly CompanionFoodKind[]>> = Object.freeze({
  fruit: Object.freeze(COMPANION_FOOD_KINDS.filter(kind => COMPANION_FOOD_CATEGORY[kind] === "fruit")),
  vegetable: Object.freeze([...COMPANION_FOOD_KINDS.filter(kind => COMPANION_FOOD_CATEGORY[kind] === "vegetable"), "salad"] as const),
  bread: Object.freeze(["bread", "croissant", "baguette", "bagel", "pretzel", "sandwich", "toast", "pancake", "waffle", "doughnut", "muffin", "cupcake", "salt-bread", "soboro-bread", "melon-bun", "red-bean-bun", "cream-bun", "steamed-bun", "mocha-bun", "garlic-bread", "cheese-bread", "egg-tart", "apple-pie", "cream-puff", "eclair", "canele", "financier", "madeleine", "scone", "churros", "roll-cake", "castella", "bungeoppang", "hotteok", "hodu-gwaja", "croffle"] as const),
  rice: Object.freeze(["rice-ball", "rice-cake", "sushi", "gimbap", "bibimbap", "tteokbokki", "fried-rice", "kimchi-fried-rice", "rice-porridge", "scorched-rice", "injeolmi", "songpyeon", "honey-rice-cake"] as const),
  noodle: Object.freeze(["pasta", "japchae", "ramyeon", "udon"] as const),
  meal: Object.freeze(["dumpling", "pizza", "omelet", "soup", "curry", "boiled-egg", "fish-cake-skewer", "pajeon", "kimchi-pancake", "egg-roll", "seaweed-soup", "hotdog", "burger", "fried-chicken", "corn-dog"] as const),
  dessert: Object.freeze(["pudding", "cookie", "macaron", "yakgwa", "dasik", "hangwa", "mochi-icecream", "icecream-cone", "popsicle", "fruit-parfait", "bingsu", "jelly", "yogurt", "cheesecake", "tiramisu", "chocolate"] as const),
});
export const COMPANION_FOOD_FAMILY = Object.freeze(Object.fromEntries(Object.entries(COMPANION_FOOD_FAMILIES).flatMap(([family, kinds]) => kinds.map(kind => [kind, family])))) as Readonly<Record<CompanionFoodKind, CompanionFoodFamily>>;

/** Only the consumed-food ledger is evidence. A default favourite, curiosity,
 * food score or accident-driven familiarity is deliberately not an input. */
export function companionConsumedFoodExperience(kind: CompanionFoodKind, consumedFoods: readonly CompanionFoodKind[] = []) {
  const family = COMPANION_FOOD_FAMILY[kind];
  const consumed = new Set<CompanionFoodKind>();
  for (const food of Array.isArray(consumedFoods) ? consumedFoods : []) if (isCompanionFoodKind(food)) consumed.add(food);
  return { exact: consumed.has(kind), related: family ? [...consumed].filter(food => food !== kind && COMPANION_FOOD_FAMILY[food] === family).length : 0 };
}
