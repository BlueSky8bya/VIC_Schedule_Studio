import type { CompanionAction, CompanionFood } from "./brain";
import type { CompanionPreferences } from "./preferences";
import { companionPlayDuration } from "./timing";

/** A bounded encounter memory, never a timer, forced discovery or food move.
 * Only a genuinely reachable mouth-range meal can earn an inspection beat.
 * Familiar snacks bypass it; repeated real encounters eventually taste it. */
export function createCompanionFoodCuriosity(rng: () => number = Math.random) {
  const encounters = new Map<CompanionFood["kind"], number>();
  return {
    consider(action: CompanionAction, food: CompanionFood | undefined, known: boolean, hunger: number, prefs: CompanionPreferences): CompanionAction {
      if (known || !food || action.kind !== "eat" || action.foodId !== food.id) return action;
      const count = encounters.get(food.kind) ?? 0;
      const limit = hunger >= .92 ? 2 : prefs.animalMode === "cat" ? 7 : prefs.animalMode === "dog" ? 4 : 6;
      const draw = rng();
      if (count >= limit || count >= 2 && Number.isFinite(draw) && draw >= .88) return action;
      encounters.set(food.kind, count + 1);
      const curiosity = count === 0 ? "inspect" : draw < .38 ? "toss" : draw < .76 ? "tease" : "inspect";
      const kind = curiosity === "inspect" ? "sniff" : curiosity === "toss" ? "play" : "look";
      return { ...action, kind, ...(kind === "play" ? { play: "pounce" as const } : {}),
        duration: kind === "play" ? companionPlayDuration("pounce") : curiosity === "inspect" ? 1900 : 1300,
        foodCuriosity: curiosity, ...(action.episode ? { episode: { ...action.episode, phase: "approach" } } : {}) };
    },
  };
}
