import { createCompanionAgentExperience, type CompanionAgentExperienceSnapshot } from "./agent-experience";

export const COMPANION_AGENT_EXPERIENCE_KEY = "vic.companionAgentExperience.v1";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const MAX_BYTES = 24_576;
const validGeneration = (value: number) => Number.isSafeInteger(value) && value >= 0;
const empty = (): CompanionAgentExperienceSnapshot => ({ v: 1, entries: [] });

export function sameCompanionAgentGeneration(ownedGeneration: number, currentGeneration: number): boolean {
  return validGeneration(ownedGeneration) && validGeneration(currentGeneration) && ownedGeneration === currentGeneration;
}

/** Care may discover an external reset before its storage event is delivered.
 * Clear the complete runtime learning owner before adopting that generation. */
export function reconcileCompanionAgentExperienceGeneration(ownedGeneration: number, currentGeneration: number, reset: () => void): number {
  if (!sameCompanionAgentGeneration(ownedGeneration, currentGeneration)) reset();
  return validGeneration(currentGeneration) ? currentGeneration : NaN;
}

function parse(raw: string | null | undefined, generation: number, enabled: boolean): CompanionAgentExperienceSnapshot {
  if (!enabled || !validGeneration(generation) || !raw || raw.length > MAX_BYTES) return empty();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1
      || !("generation" in value) || value.generation !== generation || !("policy" in value)) return empty();
    return createCompanionAgentExperience(value.policy).snapshot();
  } catch { return empty(); }
}

/** Optional same-device aggregate memory. No identities, physical item IDs,
 * schedule contents, timestamps, network, listeners or background timer. The
 * existing care flush/reset owner calls these explicit boundaries. */
export function createCompanionAgentExperienceStore(storage?: Store) {
  let lastWritten: string | undefined;
  return {
    load(generation: number, enabled: boolean): CompanionAgentExperienceSnapshot {
      if (!enabled || !validGeneration(generation)) return empty();
      try {
        return parse(storage?.getItem(COMPANION_AGENT_EXPERIENCE_KEY), generation, enabled);
      } catch { return empty(); }
    },
    synchronize(raw: string | null, generation: number, enabled: boolean) {
      lastWritten = undefined;
      return parse(raw, generation, enabled);
    },
    save(policy: unknown, generation: number, enabled: boolean) {
      if (!enabled || !validGeneration(generation)) return false;
      const clean = createCompanionAgentExperience(policy).snapshot();
      const raw = JSON.stringify({ version: 1, generation, policy: clean });
      if (raw.length > MAX_BYTES || raw === lastWritten || !storage) return false;
      try { storage.setItem(COMPANION_AGENT_EXPERIENCE_KEY, raw); lastWritten = raw; return true; }
      catch { return false; }
    },
    clear() {
      lastWritten = undefined;
      try { storage?.removeItem(COMPANION_AGENT_EXPERIENCE_KEY); } catch { /* In-memory learner still clears. */ }
    },
  };
}
