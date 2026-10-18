import { COMPANION_FOOD_KINDS, COMPANION_FOOD_NAMES, isCompanionFoodKind, randomCompanionFood, type CompanionFoodKind } from "./snacks";

export type CompanionLifeReason = "favorite-food" | "new-flavor" | "kind-touch" | "play-together" | "food-mishap" | "cozy-rest" | "discovered-taste" | "variety" | "reassured" | "rested";
export type CompanionLife = {
  seedFood: CompanionFoodKind;
  favoriteFood: CompanionFoodKind;
  foodScores: Record<CompanionFoodKind, number>;
  familiarity: Record<CompanionFoodKind, number>;
  play: number;
  comfort: number;
  social: number;
  curiosity: number;
  credit: number;
  noveltyCredit: number;
  generation: number;
  recent: CompanionLifeReason[];
};
export type CompanionLifeExperience = { kind: "fed" | "food-mishap"; food: CompanionFoodKind } | { kind: "petted" | "played" | "rested" };
const reasons: readonly CompanionLifeReason[] = ["favorite-food", "new-flavor", "kind-touch", "play-together", "food-mishap", "cozy-rest", "discovered-taste", "variety", "reassured", "rested"];
const unit = (value: number) => Math.max(0, Math.min(1, value));
const finite = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? unit(value) : fallback;
const generationOf = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
const scoresFor = (seed: CompanionFoodKind) => Object.fromEntries(COMPANION_FOOD_KINDS.map(kind => [kind, kind === seed ? .62 : .5])) as Record<CompanionFoodKind, number>;
const familiarityFor = () => Object.fromEntries(COMPANION_FOOD_KINDS.map(kind => [kind, 0])) as Record<CompanionFoodKind, number>;

/** Only a new device seed draws randomness. Normalization, reload and resets do
 * not reroll a favorite or infer time spent away. */
export function createCompanionLife(rng: () => number = Math.random, generation = 0): CompanionLife {
  const seedFood = randomCompanionFood(undefined, rng);
  return { seedFood, favoriteFood: seedFood, foodScores: scoresFor(seedFood), familiarity: familiarityFor(), play: .5, comfort: .5, social: .5, curiosity: .5, credit: 1, noveltyCredit: 0, generation: generationOf(generation), recent: [] };
}
export const DEFAULT_COMPANION_LIFE: Readonly<CompanionLife> = Object.freeze({ ...createCompanionLife(() => 0), foodScores: Object.freeze(scoresFor("apple")), familiarity: Object.freeze(familiarityFor()), recent: Object.freeze([]) as unknown as CompanionLifeReason[] });

/** Explicit bounded fields only: no text, dates, accounts, schedules or IDs. */
export function normalizeCompanionLife(value: unknown, base: Readonly<CompanionLife> = DEFAULT_COMPANION_LIFE): CompanionLife {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const seedFood = isCompanionFoodKind(source.seedFood) ? source.seedFood : base.seedFood;
  const scores = source.foodScores && typeof source.foodScores === "object" && !Array.isArray(source.foodScores) ? source.foodScores as Record<string, unknown> : {};
  const foodScores = scoresFor(seedFood);
  const familiarity = familiarityFor(), known = source.familiarity && typeof source.familiarity === "object" && !Array.isArray(source.familiarity) ? source.familiarity as Record<string, unknown> : {};
  let favoriteFood = isCompanionFoodKind(source.favoriteFood) ? source.favoriteFood : seedFood;
  const favoriteScore = finite(scores[favoriteFood], foodScores[favoriteFood]), hasScores = Object.keys(scores).length > 0;
  // Expanded catalogues fill missing entries without a new default food
  // overtaking a valid saved preference. Existing13 scores/seed stay intact.
  for (const kind of COMPANION_FOOD_KINDS) {
    const fallback = base.seedFood === seedFood ? base.foodScores[kind] : foodScores[kind];
    foodScores[kind] = finite(scores[kind], hasScores ? Math.min(fallback, favoriteScore) : fallback);
  }
  for (const kind of COMPANION_FOOD_KINDS) familiarity[kind] = finite(known[kind], base.familiarity[kind]);
  for (const kind of COMPANION_FOOD_KINDS) if (foodScores[kind] > foodScores[favoriteFood]) favoriteFood = kind;
  const recent = Array.isArray(source.recent) ? source.recent.slice(-16).filter((reason): reason is CompanionLifeReason => reasons.includes(reason as CompanionLifeReason)).slice(-4) : [...base.recent];
  return { seedFood, favoriteFood, foodScores, familiarity, play: finite(source.play, base.play), comfort: finite(source.comfort, base.comfort), social: finite(source.social, base.social), curiosity: finite(source.curiosity, base.curiosity), credit: finite(source.credit, base.credit), noveltyCredit: finite(source.noveltyCredit, base.noveltyCredit), generation: generationOf(source.generation ?? base.generation), recent };
}

export function resetCompanionLife(value: CompanionLife, generation: number): CompanionLife {
  const current = normalizeCompanionLife(value);
  return { ...createCompanionLife(() => 0, generation), seedFood: current.seedFood, favoriteFood: current.seedFood, foodScores: scoresFor(current.seedFood) };
}

/** The existing active-time boundary supplies the learning budget. No wall
 * clock, absence penalty, new loop or passive personality drift is involved. */
export function advanceCompanionLife(value: CompanionLife | undefined, elapsedMs: number, enabled = true): CompanionLife {
  const current = value ?? normalizeCompanionLife(undefined);
  if (!enabled || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return current;
  const elapsed = Math.min(30000, elapsedMs), accumulated = current.noveltyCredit + elapsed / 5000;
  const steps = Math.floor(accumulated), credit = Math.min(1, current.credit + elapsed / 18000), noveltyCredit = accumulated - steps;
  // Most250ms needs samples only advance two scalar budgets. Clone food
  // records once per five active seconds, not on every active/render sample.
  if (!steps) return { ...current, credit, noveltyCredit };
  const next = { ...current, credit, noveltyCredit, foodScores: { ...current.foodScores }, familiarity: { ...current.familiarity } }, noveltyMs = steps * 5000;
  // Gentle active-time novelty/familiarity recovery, much slower than an
  // acknowledged meal. No mount or wall-clock gap supplies elapsed time.
  for (const food of COMPANION_FOOD_KINDS) {
    next.familiarity[food] = Math.max(0, next.familiarity[food] - noveltyMs / 600000);
    const baseline = food === next.seedFood ? .62 : .54;
    next.foodScores[food] += (baseline - next.foodScores[food]) * noveltyMs / 36000000;
  }
  next.curiosity += (.58 - next.curiosity) * noveltyMs / 3600000;
  for (const food of COMPANION_FOOD_KINDS) if (next.foodScores[food] > next.foodScores[next.favoriteFood]) next.favoriteFood = food;
  return next;
}

/** One small earned update; repeat input cannot replace a personality at once.
 * Food events must refer to an actual consumed food or actual food accident. */
export function experienceCompanionLife(value: CompanionLife | undefined, event: CompanionLifeExperience, enabled = true): CompanionLife {
  const current = value ?? normalizeCompanionLife(undefined);
  if (!enabled || current.credit < 1 - 1e-9 || !event || !["fed", "food-mishap", "petted", "played", "rested"].includes(event.kind)) return current;
  if ((event.kind === "fed" || event.kind === "food-mishap") && !isCompanionFoodKind(event.food)) return current;
  const next = normalizeCompanionLife(current);
  next.credit = 0;
  const toward = (key: "play" | "comfort" | "social" | "curiosity", target: number) => { next[key] = unit(next[key] + .025 * (target - next[key])); };
  let reason: CompanionLifeReason;
  if (event.kind === "fed") {
    next.foodScores[event.food] = unit(next.foodScores[event.food] + .025 * (1 - next.foodScores[event.food]) * (1 - .85 * next.familiarity[event.food]));
    next.familiarity[event.food] = unit(next.familiarity[event.food] + .12);
    toward("comfort", .8); toward("social", .75);
    if (event.food !== current.favoriteFood) toward("curiosity", .9);
    reason = event.food === current.favoriteFood ? "favorite-food" : "variety";
  } else if (event.kind === "food-mishap") {
    // An accident only changes temporary familiarity/approach, never removes
    // earned liking or creates a permanent aversion to the fruit.
    next.familiarity[event.food] = unit(next.familiarity[event.food] + .3);
    toward("comfort", .9); reason = "food-mishap";
  } else if (event.kind === "petted") {
    toward("social", 1); toward("comfort", .85); reason = current.recent.at(-1) === "food-mishap" ? "reassured" : "kind-touch";
  } else if (event.kind === "played") {
    toward("play", 1); toward("social", .7); toward("curiosity", .8); reason = "play-together";
  } else {
    toward("comfort", 1); reason = "rested";
  }
  for (const food of COMPANION_FOOD_KINDS) if (next.foodScores[food] > next.foodScores[next.favoriteFood]) next.favoriteFood = food;
  if (next.favoriteFood !== current.favoriteFood) reason = "discovered-taste";
  next.recent = [...next.recent.filter(previous => previous !== reason), reason].slice(-4);
  return next;
}

export function getCompanionFoodPreference(value: CompanionLife | undefined, food: CompanionFoodKind): number {
  return isCompanionFoodKind(food) ? unit(finite(value?.foodScores?.[food], .5) * (1 - .15 * finite(value?.familiarity?.[food], 0))) : .5;
}

export function summarizeCompanionLife(value: CompanionLife | undefined) {
  const current = normalizeCompanionLife(value);
  return { favoriteFood: current.favoriteFood, favoriteLabel: COMPANION_FOOD_NAMES[current.favoriteFood], play: current.play, comfort: current.comfort, social: current.social, curiosity: current.curiosity, recentReason: current.recent.at(-1) ?? null };
}
