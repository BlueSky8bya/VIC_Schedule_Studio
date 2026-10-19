import { COMPANION_PERSONALITIES, type CompanionPersonality } from "./preferences";

export const COMPANION_EXPERIENCE_FAMILIES = ["cleanup", "meal", "play", "explore", "social", "rest", "home"] as const;
export type CompanionExperienceFamily = typeof COMPANION_EXPERIENCE_FAMILIES[number];
export type CompanionExperienceContext = "home" | "outside";
export type CompanionExperienceEffect = "ate" | "washed" | "food-stored" | "food-discarded" | "toy-returned" | "toy-played" | "went-out" | "petted" | "slept" | "home-control" | "route-failed";
type Choice = { personality: CompanionPersonality; context: CompanionExperienceContext; family: CompanionExperienceFamily; learn: boolean };
type Entry = Omit<Choice, "learn"> & { count: number; mean: number };
export type CompanionAgentExperienceSnapshot = { v: 1; entries: Entry[] };
const MAX_ENTRIES = 128, MAX_COUNT = 255, DISCOUNT = .985;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const validPersonality = (value: unknown): value is CompanionPersonality => COMPANION_PERSONALITIES.includes(value as CompanionPersonality);
const validContext = (value: unknown): value is CompanionExperienceContext => value === "home" || value === "outside";
const validFamily = (value: unknown): value is CompanionExperienceFamily => COMPANION_EXPERIENCE_FAMILIES.includes(value as CompanionExperienceFamily);
const key = (choice: Omit<Choice, "learn">) => `${choice.personality}:${choice.context}:${choice.family}`;
const effectFamily: Record<Exclude<CompanionExperienceEffect, "route-failed">, CompanionExperienceFamily> = {
  ate: "meal", washed: "cleanup", "food-stored": "cleanup", "food-discarded": "cleanup", "toy-returned": "cleanup", "toy-played": "play", "went-out": "explore", petted: "social", slept: "rest", "home-control": "home",
};

/** A small contextual bandit over anonymous purpose categories. The caller
 * supplies actual effect ACKs; selecting a pose, collecting an item or merely
 * considering a candidate cannot earn reward. This does not own priorities,
 * preferences, targets, clocks, persistence, network or human activity logs. */
export function createCompanionAgentExperience(initial?: unknown) {
  const entries = new Map<string, Entry>();
  const restore = (value: unknown) => {
    entries.clear();
    if (!value || typeof value !== "object" || !("v" in value) || value.v !== 1 || !("entries" in value) || !Array.isArray(value.entries)) return;
    for (const item of value.entries.slice(0, MAX_ENTRIES)) {
      if (!item || typeof item !== "object" || !validPersonality(item.personality) || !validContext(item.context) || !validFamily(item.family)
        || !Number.isFinite(item.count) || item.count <= 0 || !Number.isFinite(item.mean)) continue;
      const entry: Entry = { personality: item.personality, context: item.context, family: item.family,
        count: clamp(item.count, .001, MAX_COUNT), mean: clamp(item.mean, 0, 1) };
      entries.set(key(entry), entry);
    }
  };
  restore(initial);
  return {
    /** A bounded tie-break only. An entirely unobserved context keeps the
     * authored personality prior exactly; learning OFF never reads memory. */
    score(choice: Choice): number {
      if (!choice.learn || !validPersonality(choice.personality) || !validContext(choice.context) || !validFamily(choice.family)) return 0;
      let total = 0;
      for (const entry of entries.values()) if (entry.personality === choice.personality && entry.context === choice.context) total += entry.count;
      if (!total) return 0;
      const entry = entries.get(key(choice)), count = entry?.count ?? 0;
      return clamp(((entry?.mean ?? .5) - .5) * .16 + .08 * Math.sqrt(Math.log(2 + total) / (1 + count)), -.1, .2);
    },
    observe(input: Omit<Choice, "family"> & { effect: CompanionExperienceEffect; family?: CompanionExperienceFamily }): boolean {
      if (!input.learn || !validPersonality(input.personality) || !validContext(input.context)) return false;
      const family = input.effect === "route-failed" ? input.family : effectFamily[input.effect];
      if (!validFamily(family)) return false;
      const identity = { personality: input.personality, context: input.context, family };
      for (const entry of entries.values()) if (entry.personality === input.personality && entry.context === input.context) entry.count = Math.max(.001, entry.count * DISCOUNT);
      const previous = entries.get(key(identity)), reward = input.effect === "route-failed" ? 0 : 1;
      const oldCount = previous?.count ?? 0, count = Math.min(MAX_COUNT, oldCount + 1);
      const mean = clamp(((previous?.mean ?? 0) * Math.min(oldCount, MAX_COUNT - 1) + reward) / count, 0, 1);
      entries.set(key(identity), { ...identity, count, mean });
      return true;
    },
    snapshot(): CompanionAgentExperienceSnapshot { return { v: 1, entries: [...entries.values()].map(entry => ({ ...entry })) }; },
    restore,
    clear() { entries.clear(); },
  };
}

export type CompanionAgentExperience = ReturnType<typeof createCompanionAgentExperience>;
