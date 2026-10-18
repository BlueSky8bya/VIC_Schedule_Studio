import type { CompanionCare } from "./care";
import { COMPANION_FULL_THRESHOLD } from "./care";
import { DEFAULT_COMPANION_LIFE, type CompanionLife } from "./life";
import type { CompanionPreferences } from "./preferences";

export type CompanionInterest = "food" | "rest" | "social" | "play" | "explore";
/** A picture of current reachable needs, never a daily task, reward or new
 * random personality. The existing action planner remains authoritative. */
export function getCompanionInterest(care: Pick<CompanionCare, "hunger" | "energy" | "affection">, prefs: CompanionPreferences, life?: CompanionLife): CompanionInterest | null {
  if (!prefs.enabled) return null;
  const learned = prefs.learnFromYou ? life ?? DEFAULT_COMPANION_LIFE : DEFAULT_COMPANION_LIFE;
  if (prefs.sleep && care.energy < .3) return "rest";
  if (prefs.feeding && care.hunger >= COMPANION_FULL_THRESHOLD) return "food";
  if (prefs.sleep && care.energy < (prefs.personality === "sleepy" ? .65 : .42)) return "rest";
  if (prefs.petting && learned.social >= .5 && (care.affection < .7 || prefs.personality === "affectionate")) return "social";
  if (prefs.roam && learned.play >= .45 && prefs.animalMode !== "cat" && prefs.personality !== "sleepy") return "play";
  return prefs.roam ? "explore" : prefs.petting ? "social" : null;
}
