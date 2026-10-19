import type { CompanionPersonality } from "./preferences";

/** UI-only, north-up Later Heaven arrangement. The directional symbolism is
 * traditional; its personality associations are this project's interpretation.
 * Stored IDs and the engine's COMPANION_PERSONALITIES order stay independent. */
export const COMPANION_PERSONALITY_LAYOUT = [
  "curious", "sleepy", "homebody",
  "gourmet", "balanced", "mischievous",
  "affectionate", "performer", "tidy",
] as const satisfies readonly CompanionPersonality[];
