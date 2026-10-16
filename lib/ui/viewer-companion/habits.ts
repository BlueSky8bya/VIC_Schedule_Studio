/** Small earned, device-local tendencies. Credit advances only through supplied
 * active time; no identity, input history, dates or absence clock belongs here. */
export type CompanionHabits = { sociability: number; playfulness: number; confidence: number; credit: number; generation: number };
export type CompanionExperience = "petted" | "fed" | "played" | "bonked";
export const DEFAULT_COMPANION_HABITS: Readonly<CompanionHabits> = Object.freeze({ sociability: 0, playfulness: 0, confidence: 0, credit: 1, generation: 0 });
const traits = ["sociability", "playfulness", "confidence"] as const;
const fields = [...traits, "credit", "generation"] as const;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const learningRate = .035;
const signals: Readonly<Record<CompanionExperience, Readonly<Pick<CompanionHabits, typeof traits[number]>>>> = Object.freeze({
  petted: Object.freeze({ sociability: 1, playfulness: .15, confidence: .8 }),
  fed: Object.freeze({ sociability: .65, playfulness: .1, confidence: .9 }),
  played: Object.freeze({ sociability: .4, playfulness: 1, confidence: .8 }),
  bonked: Object.freeze({ sociability: -.4, playfulness: -.25, confidence: -1 }),
});

/** Explicit allowlist also keeps serialized care snapshots free of unrelated
 * runtime state or metadata supplied alongside the traits and learning budget.
 * Generation is only a local reset counter, never a date or identity. */
export function normalizeCompanionHabits(value: unknown): CompanionHabits {
  const next = { ...DEFAULT_COMPANION_HABITS };
  if (!value || typeof value !== "object" || Array.isArray(value)) return next;
  const source = value as Record<string, unknown>;
  for (const field of fields) {
    const number = source[field];
    if (field === "generation") {
      if (typeof number === "number" && Number.isSafeInteger(number) && number >= 0) next.generation = number;
      continue;
    }
    if (typeof number === "number" && Number.isFinite(number)) next[field] = clamp(number, field === "credit" ? 0 : -1, 1);
  }
  return next;
}

// Keep ordinary no-ops allocation-free while sanitizing malformed/extra-field
// input. Accepted learning always returns a fresh object and never mutates it.
function currentHabits(value: CompanionHabits | undefined): CompanionHabits {
  if (value && typeof value === "object" && !Array.isArray(value) && Reflect.ownKeys(value).length === fields.length
    && fields.every(field => Object.prototype.hasOwnProperty.call(value, field) && (field === "generation" ? Number.isSafeInteger(value[field]) && value[field] >= 0 : Number.isFinite(value[field]) && value[field] >= (field === "credit" ? 0 : -1) && value[field] <= 1))) return value;
  return normalizeCompanionHabits(value);
}

/** Only the existing active-time needs boundary calls this. Enabling after an
 * absence does not infer elapsed time or change any learned tendency. */
export function advanceCompanionHabits(value: CompanionHabits | undefined, elapsedMs: number, enabled = true): CompanionHabits {
  const current = currentHabits(value);
  if (!enabled || current.credit >= 1) return current;
  const elapsed = clamp(Number.isFinite(elapsedMs) ? elapsedMs : 0, 0, 30000);
  if (!elapsed) return current;
  return { ...current, credit: Math.min(1, current.credit + elapsed / 18000) };
}

/** A confirmed human experience may earn one small update per full credit.
 * Autonomous actions are intentionally absent from the accepted vocabulary. */
export function learnCompanionHabits(value: CompanionHabits | undefined, experience: CompanionExperience, enabled = true): CompanionHabits {
  const current = currentHabits(value);
  if (!enabled || current.credit < 1 - 1e-9 || !Object.prototype.hasOwnProperty.call(signals, experience)) return current;
  const signal = signals[experience];
  const next = { ...current, credit: 0 };
  for (const trait of traits) next[trait] = clamp(current[trait] + learningRate * (signal[trait] - current[trait]), -1, 1);
  return next;
}
