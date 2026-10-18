import type { CompanionAction, CompanionFood } from "./brain";
import type { CompanionPreferences } from "./preferences";
import { companionConsumedFoodExperience } from "./food-family";
import { isCompanionFoodKind, type CompanionFoodKind } from "./snacks";
import { companionPlayDuration } from "./timing";

/** First-encounter willingness, before bounded repeated-encounter progress.
 * Hunger changes willingness even with learning OFF; stored family transfer
 * obeys that setting. Exact consumed items retain the existing full trust. */
export function companionFoodAcceptance(kind: CompanionFoodKind, hunger: number, prefs: Pick<CompanionPreferences, "animalMode" | "personality" | "learnFromYou">, consumedFoods: readonly CompanionFoodKind[] = []) {
  const experience = companionConsumedFoodExperience(kind, consumedFoods);
  if (experience.exact) return { chance: 1, maxEncounters: 0, experience: "food" as const };
  const appetite = Math.max(0, Math.min(1, ((Number.isFinite(hunger) ? hunger : 0) - .35) / .55));
  const related = prefs.learnFromYou ? Math.min(3, experience.related) : 0;
  const species = prefs.animalMode === "cat" ? .14 : prefs.animalMode === "dog" ? .62 : .23;
  // Future personalities keep the conservative middle rather than requiring
  // a second exhaustive personality table alongside the main behavior model.
  const disposition = prefs.personality === "gourmet" ? .35 : prefs.personality === "curious" ? .12 : prefs.personality === "sleepy" ? -.035 : prefs.personality === "affectionate" ? .015 : 0;
  const familiarity = related ? (.22 + (related - 1) * .055) * (1 - appetite * .25) : 0;
  const chance = Math.max(.08, Math.min(.96, species + disposition + appetite * .52 + familiarity));
  const baseLimit = prefs.personality === "gourmet" || prefs.animalMode === "dog" ? 1 : prefs.animalMode === "cat" ? 4 : 3;
  const maxEncounters = Math.max(1, baseLimit - (related ? related >= 3 ? 2 : 1 : 0) - (appetite >= .85 ? 2 : appetite >= .45 ? 1 : 0));
  return { chance, maxEncounters, experience: related ? "family" as const : "new" as const };
}

/** A bounded encounter memory, never a timer, forced discovery or food move.
 * Only a genuinely reachable mouth-range meal can earn an inspection beat.
 * Familiar snacks bypass it; repeated real encounters eventually taste it. */
export function createCompanionFoodCuriosity(rng: () => number = Math.random) {
  const encounters = new Map<CompanionFood["kind"], number>();
  return {
    consider(action: CompanionAction, food: CompanionFood | undefined, known: boolean, hunger: number, prefs: CompanionPreferences, consumedFoods: readonly CompanionFoodKind[] = []): CompanionAction {
      if (known || !food || !isCompanionFoodKind(food.kind) || action.kind !== "eat" || action.foodId !== food.id) return action;
      const count = encounters.get(food.kind) ?? 0;
      const policy = companionFoodAcceptance(food.kind, hunger, prefs, consumedFoods);
      if (count >= policy.maxEncounters) return action;
      const draw = rng();
      const chance = Math.min(.97, policy.chance + count * .12);
      if (Number.isFinite(draw) && draw >= 0 && draw < chance) return action;
      encounters.set(food.kind, count + 1);
      const rejected = Number.isFinite(draw) && draw >= 0 && draw < 1 ? (draw - chance) / (1 - chance) : 1;
      const curiosity = count === 0 ? "inspect" : rejected < .38 ? "toss" : rejected < .76 ? "tease" : "inspect";
      const kind = curiosity === "inspect" ? "sniff" : curiosity === "toss" ? "play" : "look";
      return { ...action, kind, ...(kind === "play" ? { play: "pounce" as const } : {}),
        duration: kind === "play" ? companionPlayDuration("pounce") : curiosity === "inspect" ? prefs.animalMode === "dog" || prefs.personality === "gourmet" ? 500 : 1100 : 900,
        foodCuriosity: curiosity, ...(action.episode ? { episode: { ...action.episode, phase: "approach" } } : {}) };
    },
  };
}
