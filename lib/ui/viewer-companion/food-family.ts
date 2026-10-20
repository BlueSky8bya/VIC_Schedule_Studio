import { COMPANION_FOOD_CATEGORY, COMPANION_FOOD_KINDS, isCompanionFoodKind, type CompanionFoodKind } from "./snacks";
import { COMPANION_SNACK_EXPANSION_146 } from "./snack-expansion-146";

/** Culinary resemblance for this pet's learning, not a nutrition or botanical
 * classification. Prepared meals do not all become familiar after one bun. */
export type CompanionFoodFamily = "fruit" | "vegetable" | "bread" | "rice" | "noodle" | "meal" | "dessert";
const establishedCompanionFoodFamilies: Readonly<Record<CompanionFoodFamily, readonly CompanionFoodKind[]>> = Object.freeze({
  fruit: Object.freeze(COMPANION_FOOD_KINDS.filter(kind => COMPANION_FOOD_CATEGORY[kind] === "fruit")),
  vegetable: Object.freeze([...COMPANION_FOOD_KINDS.filter(kind => COMPANION_FOOD_CATEGORY[kind] === "vegetable"), "salad"] as const),
  bread: Object.freeze(["bread", "croissant", "baguette", "bagel", "pretzel", "sandwich", "toast", "pancake", "waffle", "doughnut", "muffin", "cupcake", "salt-bread", "soboro-bread", "melon-bun", "red-bean-bun", "cream-bun", "steamed-bun", "mocha-bun", "garlic-bread", "cheese-bread", "egg-tart", "apple-pie", "cream-puff", "eclair", "canele", "financier", "madeleine", "scone", "churros", "roll-cake", "castella", "bungeoppang", "hotteok", "hodu-gwaja", "croffle", "taco", "burrito", "quesadilla", "cinnamon-roll"] as const),
  rice: Object.freeze(["rice-ball", "rice-cake", "sushi", "gimbap", "bibimbap", "tteokbokki", "fried-rice", "kimchi-fried-rice", "rice-porridge", "scorched-rice", "injeolmi", "songpyeon", "honey-rice-cake", "yubu-sushi", "ssambap", "rice-cracker", "tteok-skewer", "sotteok-skewer", "patjuk"] as const),
  noodle: Object.freeze(["pasta", "japchae", "ramyeon", "udon", "jjajangmyeon", "naengmyeon", "kalguksu", "lasagna"] as const),
  meal: Object.freeze(["dumpling", "pizza", "omelet", "soup", "curry", "boiled-egg", "fish-cake-skewer", "pajeon", "kimchi-pancake", "egg-roll", "seaweed-soup", "hotdog", "burger", "fried-chicken", "corn-dog", "samgyetang", "galbi", "bulgogi", "bossam", "grilled-mackerel", "kimchi-stew", "soybean-stew", "donkatsu", "hamburger-steak", "shrimp-tempura", "squid-tempura", "cheese-stick", "potato-croquette", "takoyaki", "dried-squid", "roasted-seaweed", "corn-cheese", "scallop", "oyster"] as const),
  dessert: Object.freeze(["pudding", "cookie", "macaron", "yakgwa", "dasik", "hangwa", "mochi-icecream", "icecream-cone", "popsicle", "fruit-parfait", "bingsu", "jelly", "yogurt", "cheesecake", "tiramisu", "chocolate", "tornado-potato", "dalgona", "cotton-candy", "tanghulu", "popcorn", "sweet-potato-mattang", "dacquoise", "mille-feuille", "mont-blanc", "crepe", "souffle", "pavlova", "croquembouche", "cannoli", "dorayaki", "banana-split", "marshmallow"] as const),
});
export const COMPANION_FOOD_FAMILIES = Object.freeze(Object.fromEntries(Object.entries(establishedCompanionFoodFamilies).map(([family, kinds]) => [family, Object.freeze([...kinds, ...COMPANION_SNACK_EXPANSION_146.filter(item => item.family === family).map(item => item.id)])]))) as Readonly<Record<CompanionFoodFamily, readonly CompanionFoodKind[]>>;
export const COMPANION_FOOD_FAMILY = Object.freeze(Object.fromEntries(Object.entries(COMPANION_FOOD_FAMILIES).flatMap(([family, kinds]) => kinds.map(kind => [kind, family])))) as Readonly<Record<CompanionFoodKind, CompanionFoodFamily>>;

/** Only the consumed-food ledger is evidence. A default favourite, curiosity,
 * food score or accident-driven familiarity is deliberately not an input. */
export function companionConsumedFoodExperience(kind: CompanionFoodKind, consumedFoods: readonly CompanionFoodKind[] = []) {
  const family = COMPANION_FOOD_FAMILY[kind];
  const consumed = new Set<CompanionFoodKind>();
  for (const food of Array.isArray(consumedFoods) ? consumedFoods : []) if (isCompanionFoodKind(food)) consumed.add(food);
  return { exact: consumed.has(kind), related: family ? [...consumed].filter(food => food !== kind && COMPANION_FOOD_FAMILY[food] === family).length : 0 };
}
